import type { Stage1FilterDefinition } from "../types";
import type { AnyDifficulty } from "../../../../shared/types/api";

export const boxDepletionFilter: Stage1FilterDefinition = {
  name: "BoxDepletionFilter",

  enabledForDifficulty: (_difficulty: AnyDifficulty): boolean => true,

  filter: (ctx, candidate): boolean => {
    const { board, boxSize } = ctx;
    const { row, col, symRow, symCol, box1, box2 } = candidate;

    function countGivensInBox(boxRow: number, boxCol: number): number {
      let count = 0;
      for (let r = boxRow; r < boxRow + boxSize; r++) {
        for (let c = boxCol; c < boxCol + boxSize; c++) {
          if (board[r]![c] !== 0) count++;
        }
      }
      return count;
    }

    const br1 = Math.floor(row / boxSize) * boxSize;
    const bc1 = Math.floor(col / boxSize) * boxSize;
    const givensBox1 = countGivensInBox(br1, bc1);
    if (givensBox1 <= 2) return false;

    if (box1 !== box2) {
      const br2 = Math.floor(symRow / boxSize) * boxSize;
      const bc2 = Math.floor(symCol / boxSize) * boxSize;
      const givensBox2 = countGivensInBox(br2, bc2);
      if (givensBox2 <= 2) return false;
    }

    return true;
  },
};
