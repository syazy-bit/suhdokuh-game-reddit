import type { Stage2FeatureDefinition } from "../types";
import type { AnyDifficulty } from "../../../../shared/types/api";
import type { GridSize } from "../../SudokuValidator";
import { isValidPlacement } from "../../SudokuValidator";

function countSectorConflictsInBox(
  board: number[][],
  br: number,
  bc: number,
  size: GridSize,
  boxSize: number,
  beforeCandidateMap: number[][][],
): number {
  let conflictCount = 0;

  for (let value = 1; value <= size; value++) {
    let beforeCount = 0;
    let afterCount = 0;

    for (let r = br; r < br + boxSize; r++) {
      for (let c = bc; c < bc + boxSize; c++) {
        if (board[r]![c] !== 0) continue;

        if (beforeCandidateMap[r]![c]!.includes(value)) beforeCount++;
        if (isValidPlacement(board, r, c, value, size, boxSize)) afterCount++;
      }
    }

    if (beforeCount < 3 && afterCount >= 3) conflictCount++;
  }

  return conflictCount;
}

export const sectorConflictFeature: Stage2FeatureDefinition = {
  name: "SECTOR_CONFLICT",

  enabledForDifficulty: (_difficulty: AnyDifficulty): boolean => true,

  compute: (ctx, candidate): number => {
    const { board, size, boxSize, beforeCandidateMap } = ctx;
    const { row, col, symRow, symCol } = candidate;

    let count = 0;

    count += countSectorConflictsInBox(
      board,
      Math.floor(row / boxSize) * boxSize,
      Math.floor(col / boxSize) * boxSize,
      size,
      boxSize,
      beforeCandidateMap,
    );

    if (symRow !== row || symCol !== col) {
      count += countSectorConflictsInBox(
        board,
        Math.floor(symRow / boxSize) * boxSize,
        Math.floor(symCol / boxSize) * boxSize,
        size,
        boxSize,
        beforeCandidateMap,
      );
    }

    return count;
  },
};
