import type { Stage2FeatureDefinition } from "../types";
import type { AnyDifficulty } from "../../../../shared/types/api";
import { isValidPlacement } from "../../SudokuValidator";

export const localCandidateSurgeFeature: Stage2FeatureDefinition = {
  name: "LOCAL_CANDIDATE_SURGE",

  enabledForDifficulty: (_difficulty: AnyDifficulty): boolean => true,

  compute: (ctx, candidate): number => {
    const { board, size, boxSize, beforeCandidateMap } = ctx;
    const { row, col, symRow, symCol } = candidate;
    const seen = new Array<boolean>(size * size);

    let beforeTotal = 0;
    let afterTotal = 0;

    function countCell(r: number, c: number): void {
      if (seen[r * size + c]) return;
      seen[r * size + c] = true;

      if (board[r]![c] !== 0) return;

      beforeTotal += beforeCandidateMap[r]![c]!.length;

      let afterCount = 0;
      for (let num = 1; num <= size; num++) {
        if (isValidPlacement(board, r, c, num, size, boxSize)) {
          afterCount++;
        }
      }
      afterTotal += afterCount;
    }

    function scanRow(r: number): void {
      for (let c = 0; c < size; c++) countCell(r, c);
    }

    function scanCol(c: number): void {
      for (let r = 0; r < size; r++) countCell(r, c);
    }

    function scanBox(br: number, bc: number): void {
      for (let r = br; r < br + boxSize; r++) {
        for (let c = bc; c < bc + boxSize; c++) {
          countCell(r, c);
        }
      }
    }

    scanRow(row);
    scanCol(col);
    scanBox(Math.floor(row / boxSize) * boxSize, Math.floor(col / boxSize) * boxSize);

    if (symRow !== row || symCol !== col) {
      scanRow(symRow);
      scanCol(symCol);
      scanBox(
        Math.floor(symRow / boxSize) * boxSize,
        Math.floor(symCol / boxSize) * boxSize,
      );
    }

    if (beforeTotal === 0) return 0;

    const surge = (afterTotal - beforeTotal) / beforeTotal;
    return Math.min(surge, 1);
  },
};
