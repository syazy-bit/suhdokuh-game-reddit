import type { Stage2FeatureDefinition } from "../types";
import type { AnyDifficulty } from "../../../../shared/types/api";
import type { GridSize } from "../../SudokuValidator";
import { isValidPlacement } from "../../SudokuValidator";

function countStrongLinksInRow(
  board: number[][],
  row: number,
  size: GridSize,
  boxSize: number,
  beforeCandidateMap: number[][][],
  value: number,
): { before: number; after: number } {
  let beforeCount = 0;
  let afterCount = 0;
  for (let c = 0; c < size; c++) {
    if (board[row]![c] !== 0) continue;
    if (beforeCandidateMap[row]![c]!.includes(value)) beforeCount++;
    if (isValidPlacement(board, row, c, value, size, boxSize)) afterCount++;
  }
  return { before: beforeCount, after: afterCount };
}

function countStrongLinksInCol(
  board: number[][],
  col: number,
  size: GridSize,
  boxSize: number,
  beforeCandidateMap: number[][][],
  value: number,
): { before: number; after: number } {
  let beforeCount = 0;
  let afterCount = 0;
  for (let r = 0; r < size; r++) {
    if (board[r]![col] !== 0) continue;
    if (beforeCandidateMap[r]![col]!.includes(value)) beforeCount++;
    if (isValidPlacement(board, r, col, value, size, boxSize)) afterCount++;
  }
  return { before: beforeCount, after: afterCount };
}

export const strongLinkCreatedFeature: Stage2FeatureDefinition = {
  name: "STRONG_LINK_CREATED",

  enabledForDifficulty: (_difficulty: AnyDifficulty): boolean => true,

  compute: (ctx, candidate): number => {
    const { board, size, boxSize, beforeCandidateMap } = ctx;
    const { row, col, symRow, symCol } = candidate;
    let count = 0;

    for (let value = 1; value <= size; value++) {
      const rowBeforeAfter = countStrongLinksInRow(
        board, row, size, boxSize, beforeCandidateMap, value,
      );
      if (rowBeforeAfter.before !== 2 && rowBeforeAfter.after === 2) count++;

      const colBeforeAfter = countStrongLinksInCol(
        board, col, size, boxSize, beforeCandidateMap, value,
      );
      if (colBeforeAfter.before !== 2 && colBeforeAfter.after === 2) count++;
    }

    if (symRow !== row || symCol !== col) {
      for (let value = 1; value <= size; value++) {
        const rowBeforeAfter = countStrongLinksInRow(
          board, symRow, size, boxSize, beforeCandidateMap, value,
        );
        if (rowBeforeAfter.before !== 2 && rowBeforeAfter.after === 2) count++;

        const colBeforeAfter = countStrongLinksInCol(
          board, symCol, size, boxSize, beforeCandidateMap, value,
        );
        if (colBeforeAfter.before !== 2 && colBeforeAfter.after === 2) count++;
      }
    }

    return count;
  },
};
