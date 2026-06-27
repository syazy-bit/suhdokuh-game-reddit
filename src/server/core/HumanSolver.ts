import type { CandidateMap } from "./CandidateEngine";
import type { GridSize } from "./SudokuValidator";

export interface HumanSolverContext {
  board: number[][];
  size: GridSize;
  boxSize: number;
  candidateMap: CandidateMap;
}

export type LogicalMove =
  | {
      type: "assignment";
      technique: "Naked Single" | "Hidden Single";
      row: number;
      col: number;
      value: number;
    }
  | {
      type: "elimination";
      technique: string;
      patternCells: Array<{ row: number; col: number }>;
      eliminations: Array<{
        row: number;
        col: number;
        value: number;
      }>;
    };

export function findNakedSingles(ctx: HumanSolverContext): LogicalMove[] {
  const moves: LogicalMove[] = [];
  const { board, size, candidateMap } = ctx;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row]![col] !== 0) continue;

      const candidates = candidateMap[row]![col]!;

      if (candidates.length === 1) {
        moves.push({
          type: "assignment",
          row,
          col,
          value: candidates[0]!,
          technique: "Naked Single",
        });
      }
    }
  }

  return moves;
}

export function findHiddenSingles(ctx: HumanSolverContext): LogicalMove[] {
  const moves: LogicalMove[] = [];
  const seen = new Set<string>();
  const { board, size, boxSize, candidateMap } = ctx;

  function tryAdd(row: number, col: number, value: number): void {
    const key = `${row}-${col}-${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    moves.push({ type: "assignment", row, col, value, technique: "Hidden Single" });
  }

  // Scan rows
  for (let row = 0; row < size; row++) {
    const counts = new Map<number, number>();
    const cellCandidates: { row: number; col: number; list: number[] }[] = [];

    for (let col = 0; col < size; col++) {
      if (board[row]![col] !== 0) continue;
      const list = candidateMap[row]![col]!;
      cellCandidates.push({ row, col, list });
      for (const v of list) {
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
    }

    for (const { row, col, list } of cellCandidates) {
      for (const v of list) {
        if (counts.get(v) === 1) tryAdd(row, col, v);
      }
    }
  }

  // Scan columns
  for (let col = 0; col < size; col++) {
    const counts = new Map<number, number>();
    const cellCandidates: { row: number; col: number; list: number[] }[] = [];

    for (let row = 0; row < size; row++) {
      if (board[row]![col] !== 0) continue;
      const list = candidateMap[row]![col]!;
      cellCandidates.push({ row, col, list });
      for (const v of list) {
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
    }

    for (const { row, col, list } of cellCandidates) {
      for (const v of list) {
        if (counts.get(v) === 1) tryAdd(row, col, v);
      }
    }
  }

  // Scan boxes
  for (let boxRow = 0; boxRow < size; boxRow += boxSize) {
    for (let boxCol = 0; boxCol < size; boxCol += boxSize) {
      const counts = new Map<number, number>();
      const cellCandidates: { row: number; col: number; list: number[] }[] = [];

      for (let r = boxRow; r < boxRow + boxSize; r++) {
        for (let c = boxCol; c < boxCol + boxSize; c++) {
          if (board[r]![c] !== 0) continue;
          const list = candidateMap[r]![c]!;
          cellCandidates.push({ row: r, col: c, list });
          for (const v of list) {
            counts.set(v, (counts.get(v) ?? 0) + 1);
          }
        }
      }

      for (const { row, col, list } of cellCandidates) {
        for (const v of list) {
          if (counts.get(v) === 1) tryAdd(row, col, v);
        }
      }
    }
  }

  return moves;
}

function candidateKey(list: number[]): string {
  return [...list].sort((a, b) => a - b).join(",");
}

function pairDedupKey(
  a: { row: number; col: number },
  b: { row: number; col: number },
  values: string
): string {
  const p1 = `${a.row},${a.col}`;
  const p2 = `${b.row},${b.col}`;
  return p1 < p2 ? `${p1}-${p2}-${values}` : `${p2}-${p1}-${values}`;
}

function eliminationCellKey(
  row: number,
  col: number,
  value: number
): string {
  return `${row},${col},${value}`;
}

export function findNakedPairs(ctx: HumanSolverContext): LogicalMove[] {
  const { board, size, boxSize, candidateMap } = ctx;
  const pairMap = new Map<
    string,
    {
      patternCells: Array<{ row: number; col: number }>;
      eliminations: Map<string, { row: number; col: number; value: number }>;
    }
  >();

  function processUnit(cells: Array<{ row: number; col: number }>): void {
    const groups = new Map<string, Array<{ row: number; col: number }>>();

    for (const { row, col } of cells) {
      const list = candidateMap[row]![col]!;
      if (list.length !== 2) continue;
      const key = candidateKey(list);
      const group = groups.get(key) ?? [];
      group.push({ row, col });
      groups.set(key, group);
    }

    for (const [candKey, pairCells] of groups) {
      if (pairCells.length !== 2) continue;

      const [a, b] = pairCells;
      const dk = pairDedupKey(a!, b!, candKey);
      let entry = pairMap.get(dk);
      if (!entry) {
        entry = {
          patternCells: [
            { row: a!.row, col: a!.col },
            { row: b!.row, col: b!.col },
          ],
          eliminations: new Map(),
        };
        pairMap.set(dk, entry);
      }

      const values = candKey.split(",").map(Number);

      for (const { row, col } of cells) {
        if (
          (row === a!.row && col === a!.col) ||
          (row === b!.row && col === b!.col)
        )
          continue;

        const list = candidateMap[row]![col]!;
        for (const v of values) {
          if (list.includes(v)) {
            const ek = eliminationCellKey(row, col, v);
            if (!entry.eliminations.has(ek)) {
              entry.eliminations.set(ek, { row, col, value: v });
            }
          }
        }
      }
    }
  }

  // Scan rows
  for (let row = 0; row < size; row++) {
    const cells: Array<{ row: number; col: number }> = [];
    for (let col = 0; col < size; col++) {
      if (board[row]![col] === 0) cells.push({ row, col });
    }
    processUnit(cells);
  }

  // Scan columns
  for (let col = 0; col < size; col++) {
    const cells: Array<{ row: number; col: number }> = [];
    for (let row = 0; row < size; row++) {
      if (board[row]![col] === 0) cells.push({ row, col });
    }
    processUnit(cells);
  }

  // Scan boxes
  for (let boxRow = 0; boxRow < size; boxRow += boxSize) {
    for (let boxCol = 0; boxCol < size; boxCol += boxSize) {
      const cells: Array<{ row: number; col: number }> = [];
      for (let r = boxRow; r < boxRow + boxSize; r++) {
        for (let c = boxCol; c < boxCol + boxSize; c++) {
          if (board[r]![c] === 0) cells.push({ row: r, col: c });
        }
      }
      processUnit(cells);
    }
  }

  const moves: LogicalMove[] = [];
  for (const { patternCells, eliminations } of pairMap.values()) {
    if (eliminations.size === 0) continue;
    moves.push({
      type: "elimination",
      technique: "Naked Pair",
      patternCells,
      eliminations: [...eliminations.values()],
    });
  }
  return moves;
}
