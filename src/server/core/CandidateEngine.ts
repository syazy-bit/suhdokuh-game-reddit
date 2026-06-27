import { isValidPlacement, type GridSize } from "./SudokuValidator";

export type CandidateMap = number[][][];

export function buildCandidateMap(
  board: number[][],
  size: GridSize,
  boxSize: number
): CandidateMap {
  const map: CandidateMap = [];
  for (let r = 0; r < size; r++) {
    map[r] = [];
    for (let c = 0; c < size; c++) {
      if (board[r]![c] === 0) {
        map[r]![c] = getCandidates(board, r, c, size, boxSize);
      } else {
        map[r]![c] = [];
      }
    }
  }
  return map;
}

export function getCandidates(
  board: number[][],
  row: number,
  col: number,
  size: GridSize,
  boxSize: number
): number[] {
  const candidates: number[] = [];
  for (let num = 1; num <= size; num++) {
    if (isValidPlacement(board, row, col, num, size, boxSize)) {
      candidates.push(num);
    }
  }
  return candidates;
}

export function getCandidateCount(
  board: number[][],
  row: number,
  col: number,
  size: GridSize,
  boxSize: number
): number {
  let count = 0;
  for (let num = 1; num <= size; num++) {
    if (isValidPlacement(board, row, col, num, size, boxSize)) {
      count++;
    }
  }
  return count;
}

export function hasSingleCandidate(
  board: number[][],
  row: number,
  col: number,
  size: GridSize,
  boxSize: number
): number | null {
  let candidate: number | null = null;
  for (let num = 1; num <= size; num++) {
    if (isValidPlacement(board, row, col, num, size, boxSize)) {
      if (candidate !== null) return null;
      candidate = num;
    }
  }
  return candidate;
}
