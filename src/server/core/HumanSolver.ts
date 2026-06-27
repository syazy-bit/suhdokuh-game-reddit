import { getCandidates } from "./CandidateEngine";
import type { GridSize } from "./SudokuValidator";

export interface LogicalMove {
  row: number;
  col: number;
  value: number;
  technique: "Naked Single";
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
