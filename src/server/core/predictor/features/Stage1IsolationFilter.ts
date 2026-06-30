import type { Stage1FilterDefinition } from "../types";
import type { AnyDifficulty } from "../../../../shared/types/api";

function countEmptyNeighbors(
  board: number[][],
  row: number,
  col: number,
  size: number,
): number {
  let count = 0;
  if (row > 0 && board[row - 1]![col] === 0) count++;
  if (row < size - 1 && board[row + 1]![col] === 0) count++;
  if (col > 0 && board[row]![col - 1] === 0) count++;
  if (col < size - 1 && board[row]![col + 1] === 0) count++;
  return count;
}

export const isolationFilter: Stage1FilterDefinition = {
  name: "IsolationFilter",

  enabledForDifficulty: (_difficulty: AnyDifficulty): boolean => true,

  filter: (ctx, candidate): boolean => {
    const { board, size } = ctx;
    const { row, col, symRow, symCol } = candidate;

    const primaryNeighbors = countEmptyNeighbors(board, row, col, size);
    if (primaryNeighbors >= 2) return false;

    if (symRow !== row || symCol !== col) {
      const symNeighbors = countEmptyNeighbors(board, symRow, symCol, size);
      if (symNeighbors >= 2) return false;
    }

    return true;
  },
};
