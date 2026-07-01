import type { PropertyGroup, PropertyContext, PropertyResult } from "../types";
import { randomSolvedBoard, randomPartialBoardWithSolution, cloneBoard } from "../Generators/boardGenerator";
import { isValidSolution } from "../../core/SudokuValidator";

const properties = [
  {
    name: "randomSolvedBoard always satisfies Sudoku rules",
    fn: (ctx: PropertyContext): PropertyResult => {
      const board = randomSolvedBoard(ctx.size, ctx.rng);
      if (!isValidSolution(board, ctx.size)) {
        return { pass: false, reason: "randomSolvedBoard failed validation" };
      }
      return { pass: true };
    },
  },
  {
    name: "randomPartialBoard never changes existing clues",
    fn: (ctx: PropertyContext): PropertyResult => {
      const { partial, solution } = randomPartialBoardWithSolution(ctx.size, ctx.rng, 0.5);
      for (let r = 0; r < ctx.size; r++) {
        for (let c = 0; c < ctx.size; c++) {
          const clue = partial[r]![c]!;
          if (clue !== 0 && clue !== solution[r]![c]!) {
            return { pass: false, reason: `clue ${clue} at (${r},${c}) does not match solved value ${solution[r]![c]!}` };
          }
        }
      }
      return { pass: true };
    },
  },
  {
    name: "cloneBoard performs a deep copy",
    fn: (ctx: PropertyContext): PropertyResult => {
      const original = randomSolvedBoard(ctx.size, ctx.rng);
      const cloned = cloneBoard(original);

      for (let r = 0; r < ctx.size; r++) {
        for (let c = 0; c < ctx.size; c++) {
          if (cloned[r]![c]! !== original[r]![c]!) {
            return { pass: false, reason: "cloned board values differ from original" };
          }
        }
      }

      cloned[0]![0] = original[0]![0]! + 99;
      if (cloned[0]![0] === original[0]![0]!) {
        return { pass: false, reason: "cloneBoard did not create a deep copy" };
      }
      return { pass: true };
    },
  },
];

export const boardGroup: PropertyGroup = {
  name: "Board",
  properties,
};
