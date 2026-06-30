import type { GridSize } from "./SudokuValidator";
import { getCandidateCount } from "./CandidateEngine";

export interface PredictionResult {
  score: number;
  candidateSurge: number;
  mrvShift: number;
}

function totalCandidates(
  board: number[][],
  size: GridSize,
  boxSize: number
): number {
  let count = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r]![c] === 0) {
        count += getCandidateCount(board, r, c, size, boxSize);
      }
    }
  }
  return count;
}

function minRemainingValues(
  board: number[][],
  size: GridSize,
  boxSize: number
): number {
  let min = size + 1;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r]![c] === 0) {
        const count = getCandidateCount(board, r, c, size, boxSize);
        if (count < min) min = count;
        if (min === 0) return 0;
      }
    }
  }
  return min > size ? 0 : min;
}

function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row]);
}

export function predictDelta(
  board: number[][],
  row: number,
  col: number,
  size: GridSize,
  boxSize: number
): PredictionResult {
  if (board[row]![col] === 0) {
    return { score: 0, candidateSurge: 0, mrvShift: 0 };
  }

  const beforeTotal = totalCandidates(board, size, boxSize);
  const beforeMRV = minRemainingValues(board, size, boxSize);

  const temp = cloneBoard(board);
  temp[row]![col] = 0;

  const afterTotal = totalCandidates(temp, size, boxSize);
  const afterMRV = minRemainingValues(temp, size, boxSize);

  const candidateSurge = beforeTotal > 0
    ? Math.min((afterTotal - beforeTotal) / beforeTotal, 1)
    : Math.min(afterTotal / (size * size), 1);

  const mrvShift = (afterMRV - beforeMRV) / size;

  const score = 0.5 * candidateSurge + 0.5 * mrvShift;

  return { score, candidateSurge, mrvShift };
}
