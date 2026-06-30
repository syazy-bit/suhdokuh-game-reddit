import type { Stage2FeatureDefinition } from "../types";
import type { AnyDifficulty } from "../../../../shared/types/api";
import { isValidPlacement } from "../../SudokuValidator";

export const bivalueCreatedFeature: Stage2FeatureDefinition = {
  name: "BIVALUE_CREATED",

  enabledForDifficulty: (_difficulty: AnyDifficulty): boolean => true,

  compute: (ctx, candidate): number => {
    const { board, size, boxSize, beforeCandidateMap } = ctx;
    const { row, col, symRow, symCol } = candidate;
    let count = 0;
    const seen = new Array<boolean>(size * size);

    function checkCell(r: number, c: number): void {
      if (seen[r * size + c]) return;
      seen[r * size + c] = true;

      if (board[r]![c] !== 0) return;

      const beforeLen = beforeCandidateMap[r]![c]!.length;
      if (beforeLen === 2) return;

      let afterCount = 0;
      for (let num = 1; num <= size; num++) {
        if (isValidPlacement(board, r, c, num, size, boxSize)) {
          afterCount++;
        }
      }
      if (afterCount === 2) count++;
    }

    function scanRow(r: number): void {
      for (let c = 0; c < size; c++) checkCell(r, c);
    }

    function scanCol(c: number): void {
      for (let r = 0; r < size; r++) checkCell(r, c);
    }

    function scanBox(br: number, bc: number): void {
      for (let r = br; r < br + boxSize; r++) {
        for (let c = bc; c < bc + boxSize; c++) {
          checkCell(r, c);
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

    return count;
  },
};
