import type { PropertyGroup, PropertyContext, PropertyResult } from "../types";
import { generateRandomPuzzle } from "../Generators/puzzleGenerator";
import { isValidSolution, areCluesConsistent } from "../../core/SudokuValidator";
import { hasUniqueSolution } from "../../core/SudokuSolver";
function getBoxSize(size: number): number {
  return size === 9 ? 3 : 2;
}

// puzzle.analysis.difficulty is typed as Difficulty ("easy"|"medium"|"hard"|"expert")
// and computed from difficultyFromScore() using the 9×9 thresholds in DifficultyAnalyzer.
// It reports a normalized cross-size classification, NOT the requested generation difficulty.
// 4×4-specific categories ("beginner"/"advanced") never appear in analysis output.
const NORMALIZED_DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;

const properties = [
  {
    name: "generated solution is valid",
    fn: (ctx: PropertyContext): PropertyResult => {
      const puzzle = generateRandomPuzzle(ctx.size, ctx.rng);
      if (!isValidSolution(puzzle.solution, ctx.size)) {
        return { pass: false, reason: "generated solution fails Sudoku validation" };
      }
      return { pass: true };
    },
  },
  {
    name: "puzzle clues are consistent with solution",
    fn: (ctx: PropertyContext): PropertyResult => {
      const puzzle = generateRandomPuzzle(ctx.size, ctx.rng);
      if (!areCluesConsistent(puzzle.puzzle, puzzle.solution, ctx.size)) {
        return { pass: false, reason: "puzzle clues contradict the solution" };
      }
      return { pass: true };
    },
  },
  {
    name: "puzzle has a unique solution",
    fn: (ctx: PropertyContext): PropertyResult => {
      const puzzle = generateRandomPuzzle(ctx.size, ctx.rng);
      const boxSize = getBoxSize(ctx.size);
      if (!hasUniqueSolution(puzzle.puzzle, ctx.size, boxSize)) {
        return { pass: false, reason: "generated puzzle does not have a unique solution" };
      }
      return { pass: true };
    },
  },
  {
    name: "generated difficulty belongs to expected domain",
    fn: (ctx: PropertyContext): PropertyResult => {
      const puzzle = generateRandomPuzzle(ctx.size, ctx.rng);
      const difficulty = puzzle.analysis.difficulty;
      if (!NORMALIZED_DIFFICULTIES.includes(difficulty)) {
        return {
          pass: false,
          reason: `unexpected difficulty "${difficulty}" for ${ctx.size}×${ctx.size}`,
        };
      }
      return { pass: true };
    },
  },
];

export const puzzleGeneratorGroup: PropertyGroup = {
  name: "PuzzleGenerator",
  properties,
};
