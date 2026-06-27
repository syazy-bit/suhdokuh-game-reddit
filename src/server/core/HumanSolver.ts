import { getCandidates } from "./CandidateEngine";
import type { GridSize } from "./SudokuValidator";

export interface LogicalMove {
  row: number;
  col: number;
  value: number;
  technique: "Naked Single" | "Hidden Single";
}

export function findNakedSingles(
  board: number[][],
  size: GridSize,
  boxSize: number
): LogicalMove[] {
  const moves: LogicalMove[] = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row]![col] !== 0) continue;

      const candidates = getCandidates(board, row, col, size, boxSize);

      if (candidates.length === 1) {
        moves.push({
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

export function findHiddenSingles(
  board: number[][],
  size: GridSize,
  boxSize: number
): LogicalMove[] {
  const moves: LogicalMove[] = [];
  const seen = new Set<string>();

  function tryAdd(row: number, col: number, value: number): void {
    const key = `${row}-${col}-${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    moves.push({ row, col, value, technique: "Hidden Single" });
  }

  // Scan rows
  for (let row = 0; row < size; row++) {
    const counts = new Map<number, number>();
    const cellCandidates: { row: number; col: number; list: number[] }[] = [];

    for (let col = 0; col < size; col++) {
      if (board[row]![col] !== 0) continue;
      const candidates = getCandidates(board, row, col, size, boxSize);
      cellCandidates.push({ row, col, list: candidates });
      for (const v of candidates) {
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
      const candidates = getCandidates(board, row, col, size, boxSize);
      cellCandidates.push({ row, col, list: candidates });
      for (const v of candidates) {
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
          const candidates = getCandidates(board, r, c, size, boxSize);
          cellCandidates.push({ row: r, col: c, list: candidates });
          for (const v of candidates) {
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
