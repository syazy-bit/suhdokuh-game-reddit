import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getCandidates } from "../src/server/core/CandidateEngine";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "..", "src", "server", "index.ts");

// ── Parser: extract a JS object literal from source text ───────────────────

function extractObject(source: string, varName: string): string {
  const declIdx = source.indexOf(`const ${varName}`);
  if (declIdx === -1) throw new Error(`Could not find const ${varName}`);

  const eqIdx = source.indexOf("=", declIdx);
  if (eqIdx === -1) throw new Error(`Could not find = for ${varName}`);

  let start = eqIdx + 1;
  while (source[start] === " " || source[start] === "\t" || source[start] === "\n" || source[start] === "\r") start++;

  if (source[start] !== "{") throw new Error(`Expected {{ at start of ${varName} value`);

  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let end = start;

  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    const prev = i > 0 ? source[i - 1] : "";

    if (ch === "'" && !inDouble && prev !== "\\") inSingle = !inSingle;
    else if (ch === '"' && !inSingle && prev !== "\\") inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) { end = i + 1; break; }
      }
    }
  }

  return source.slice(start, end);
}

type Difficulty = "easy" | "medium" | "hard" | "expert";
type PuzzleEntry = { puzzle: number[][]; solution: number[][] };
type Library = Record<Difficulty, PuzzleEntry[]>;

// ── Extract from source and evaluate ───────────────────────────────────────

function loadLibrary(source: string, varName: string): Library {
  const objText = extractObject(source, varName);
  const fn = new Function(`return (${objText})`);
  return fn() as Library;
}

// ── Grid helpers ───────────────────────────────────────────────────────────

function boxSize(size: number): number {
  return size === 4 ? 2 : 3;
}

function cloneGrid<T>(grid: T[][]): T[][] {
  return grid.map((r) => [...r]);
}

// ── Validation ─────────────────────────────────────────────────────────────

function hasDuplicates(arr: number[]): boolean {
  const seen = new Set<number>();
  for (const v of arr) {
    if (v !== 0) {
      if (seen.has(v)) return true;
      seen.add(v);
    }
  }
  return false;
}

function getReasons(solution: number[][], puzzle: number[][], size: number): string[] {
  const reasons: string[] = [];
  const bSize = boxSize(size);

  // Rows
  for (let r = 0; r < size; r++) {
    if (hasDuplicates(solution[r]!)) {
      reasons.push(`solution row ${r} has duplicate values: [${solution[r]}]`);
    }
  }

  // Columns
  for (let c = 0; c < size; c++) {
    const col: number[] = [];
    for (let r = 0; r < size; r++) col.push(solution[r]![c]!);
    if (hasDuplicates(col)) {
      reasons.push(`solution column ${c} has duplicate values: [${col}]`);
    }
  }

  // Boxes
  for (let br = 0; br < size; br += bSize) {
    for (let bc = 0; bc < size; bc += bSize) {
      const box: number[] = [];
      for (let r = br; r < br + bSize; r++) {
        for (let c = bc; c < bc + bSize; c++) {
          box.push(solution[r]![c]!);
        }
      }
      if (hasDuplicates(box)) {
        reasons.push(`solution box (${br},${bc}) has duplicate values: [${box}]`);
      }
    }
  }

  // Value range check
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = solution[r]![c]!;
      if (v < 1 || v > size) {
        reasons.push(`solution cell (${r},${c}) has value ${v}, expected 1-${size}`);
      }
    }
  }

  // Clue matching
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const pv = puzzle[r]![c]!;
      const sv = solution[r]![c]!;
      if (pv !== 0 && pv !== sv) {
        reasons.push(`clue at (${r},${c}) has value ${pv} but solution has ${sv}`);
      }
    }
  }

  // Uniqueness
  const solutions = countSolutions(puzzle, size, 2, 500_000);
  if (solutions === 0) {
    reasons.push(`puzzle has no solutions`);
  } else if (solutions > 1) {
    reasons.push(`puzzle has ${solutions} solutions (must have exactly 1)`);
  }

  return reasons;
}

// ── Solver (backtracking with step limit) ──────────────────────────────────

function countSolutions(grid: number[][], size: number, limit: number, maxSteps: number): number {
  const bSize = boxSize(size) as 2 | 3;

  let count = 0;
  let steps = 0;

  function solve(g: number[][]): void {
    if (count >= limit) return;
    if (steps++ > maxSteps) { count = -1; return; }
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (g[r]![c] === 0) {
          for (const num of getCandidates(g, r, c, size as 4 | 9, bSize)) {
            g[r]![c] = num;
            solve(g);
            g[r]![c] = 0;
          }
          return;
        }
      }
    }
    count++;
  }

  solve(cloneGrid(grid));
  return count;
}

// ── Main ───────────────────────────────────────────────────────────────────

function main(): number {
  const source = readFileSync(serverPath, "utf-8");

  const lib4x4 = loadLibrary(source, "fallbackPuzzles4x4");
  const lib9x9 = loadLibrary(source, "fallbackPuzzles9x9");

  const entries: { name: string; size: number; entry: PuzzleEntry }[] = [];

  for (const diff of ["easy", "medium", "hard"] as Difficulty[]) {
    for (const [i, entry] of lib4x4[diff].entries()) {
      entries.push({ name: `4×4 ${diff} #${i + 1}`, size: 4, entry });
    }
    for (const [i, entry] of lib9x9[diff].entries()) {
      entries.push({ name: `9×9 ${diff} #${i + 1}`, size: 9, entry });
    }
  }

  let passed = 0;
  let failed = 0;

  for (const { name, size, entry } of entries) {
    const reasons = getReasons(entry.solution, entry.puzzle, size);

    if (reasons.length === 0) {
      passed++;
    } else {
      failed++;
      console.log(`\n❌ ${name}`);
      // Deduplicate reasons: keep unique messages
      const unique = [...new Set(reasons)];
      // Group into single-line issues for readability
      const summarized = unique.map((r) => {
        if (r.startsWith("clue at")) return r;
        if (r.startsWith("solution")) return r;
        if (r.startsWith("puzzle")) return r;
        return r;
      });
      for (const r of summarized) {
        console.log(`   ${r}`);
      }
    }
  }

  console.log(`\nChecked: ${entries.length} puzzles`);
  console.log(`Passed:  ${passed}`);
  console.log(`Failed:  ${failed}`);

  return failed > 0 ? 1 : 0;
}

process.exit(main());
