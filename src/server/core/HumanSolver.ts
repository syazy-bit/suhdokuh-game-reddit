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
