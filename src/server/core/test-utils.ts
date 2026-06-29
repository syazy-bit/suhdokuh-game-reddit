import { cloneGrid, type GridSize } from "./SudokuValidator";
import { getCandidates, getCandidateCount } from "./CandidateEngine";

export type { GridSize } from "./SudokuValidator";

export function hasDuplicateValues(arr: number[]): boolean {
  const seen = new Set<number>();
  for (const v of arr) {
    if (v !== 0) {
      if (seen.has(v)) return true;
      seen.add(v);
    }
  }
  return false;
}

/**
 * Independent uniqueness oracle — intentionally separate from the generator's
 * internal uniqueness check (SudokuSolver). This provides an independent
 * verification that generated puzzles truly have exactly one solution.
 */
export function countSolutions(grid: number[][], size: GridSize, limit: number, maxSteps: number): number {
  const bSize = size === 4 ? 2 : 3;

  let solutionCount = 0;
  let steps = 0;
  let cutoff = false;

  function propagateSingles(g: number[][]): { ok: boolean; filled: Array<{ r: number; c: number }> } {
    const filled: Array<{ r: number; c: number }> = [];
    let progress = true;
    while (progress) {
      progress = false;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (g[r]![c] !== 0) continue;

          const candidates = getCandidates(g, r, c, size, bSize);
          if (candidates.length === 1) {
            g[r]![c] = candidates[0]!;
            filled.push({ r, c });
            progress = true;
          } else if (candidates.length === 0) {
            return { ok: false, filled };
          }
        }
      }
    }
    return { ok: true, filled };
  }

  function solve(g: number[][]): void {
    if (cutoff) return;
    if (solutionCount >= limit) return;
    if (steps++ > maxSteps) { cutoff = true; return; }

    // Constraint propagation: fill Naked Singles repeatedly
    const { ok, filled } = propagateSingles(g);
    if (!ok) {
      for (const { r, c } of filled) g[r]![c] = 0;
      return;
    }

    // MRV: find empty cell with the fewest legal candidates
    let mrvRow = -1;
    let mrvCol = -1;
    let mrvCount = size + 1;

    outer: for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (g[r]![c] !== 0) continue;

        const count = getCandidateCount(g, r, c, size, bSize);

        if (count < mrvCount) {
          mrvCount = count;
          mrvRow = r;
          mrvCol = c;
          if (count <= 1) break outer;
        }
      }
    }

    if (mrvRow === -1) {
      solutionCount++;
    } else if (mrvCount > 0) {
      for (const num of getCandidates(g, mrvRow, mrvCol, size, bSize)) {
        g[mrvRow]![mrvCol] = num;
        solve(g);
        g[mrvRow]![mrvCol] = 0;
      }
    }

    for (const { r, c } of filled) g[r]![c] = 0;
  }

  solve(cloneGrid(grid));
  return cutoff ? -1 : solutionCount;
}

export const difficultyCellsRemoved = {
  easy:     { 9: { min: 25, max: 38 } },
  medium:   { 9: { min: 38, max: 50 } },
  hard:     { 9: { min: 42, max: 55 } },
  expert:   { 9: { min: 48, max: 60 } },
  beginner: { 4: { min: 4, max: 8 } },
  advanced: { 4: { min: 6, max: 10 } },
} as const;
