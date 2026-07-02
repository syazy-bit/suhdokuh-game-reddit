import type { PropertyGroup, PropertyContext, PropertyResult } from "../types";
import { generateRandomPuzzle } from "../Generators/puzzleGenerator";
import { randomSolvedBoard } from "../Generators/boardGenerator";
import { solve } from "../../core/HumanSolverPipeline";
import { getCandidateCount } from "../../core/CandidateEngine";
import type { GridSize } from "../../core/SudokuValidator";

function hasNoConflicts(board: number[][], size: GridSize): boolean {
  const boxSize = size === 9 ? 3 : 2;

  for (let r = 0; r < size; r++) {
    const seen = new Set<number>();
    for (let c = 0; c < size; c++) {
      const v = board[r]![c]!;
      if (v !== 0) {
        if (seen.has(v)) return false;
        seen.add(v);
      }
    }
  }

  for (let c = 0; c < size; c++) {
    const seen = new Set<number>();
    for (let r = 0; r < size; r++) {
      const v = board[r]![c]!;
      if (v !== 0) {
        if (seen.has(v)) return false;
        seen.add(v);
      }
    }
  }

  for (let br = 0; br < size; br += boxSize) {
    for (let bc = 0; bc < size; bc += boxSize) {
      const seen = new Set<number>();
      for (let r = br; r < br + boxSize; r++) {
        for (let c = bc; c < bc + boxSize; c++) {
          const v = board[r]![c]!;
          if (v !== 0) {
            if (seen.has(v)) return false;
            seen.add(v);
          }
        }
      }
    }
  }

  return true;
}

const properties = [
  {
    name: "True Solution Preservation",
    fn: (ctx: PropertyContext): PropertyResult => {
      const puzzle = generateRandomPuzzle(ctx.size, ctx.rng);
      const result = solve(puzzle.puzzle);
      for (const move of result.moves) {
        if (move.type === "assignment") {
          if (move.value !== puzzle.solution[move.row]![move.col]) {
            return {
              pass: false,
              reason: `assignment at (${move.row},${move.col}) set ${move.value} but oracle solution has ${puzzle.solution[move.row]![move.col]}`,
            };
          }
        } else {
          for (const elim of move.eliminations) {
            if (elim.value === puzzle.solution[elim.row]![elim.col]) {
              return {
                pass: false,
                reason: `elimination at (${elim.row},${elim.col}) removed ${elim.value} which equals the oracle solution`,
              };
            }
          }
        }
      }
      return { pass: true };
    },
  },
  {
    name: "Final State Validity",
    fn: (ctx: PropertyContext): PropertyResult => {
      const puzzle = generateRandomPuzzle(ctx.size, ctx.rng);
      const result = solve(puzzle.puzzle);
      if (result.solved) {
        for (let r = 0; r < ctx.size; r++) {
          for (let c = 0; c < ctx.size; c++) {
            if (result.finalBoard[r]![c] !== puzzle.solution[r]![c]) {
              return {
                pass: false,
                reason: `cell (${r},${c}): solver=${result.finalBoard[r]![c]}, expected=${puzzle.solution[r]![c]}`,
              };
            }
          }
        }
      }
      return { pass: true };
    },
  },
  {
    name: "Clue Immutability",
    fn: (ctx: PropertyContext): PropertyResult => {
      const puzzle = generateRandomPuzzle(ctx.size, ctx.rng);
      const result = solve(puzzle.puzzle);
      for (let r = 0; r < ctx.size; r++) {
        for (let c = 0; c < ctx.size; c++) {
          const clue = puzzle.puzzle[r]![c]!;
          if (clue !== 0 && result.finalBoard[r]![c] !== clue) {
            return {
              pass: false,
              reason: `clue at (${r},${c}) changed from ${clue} to ${result.finalBoard[r]![c]}`,
            };
          }
        }
      }
      return { pass: true };
    },
  },
  {
    name: "Idempotency on Solved Boards",
    fn: (ctx: PropertyContext): PropertyResult => {
      const board = randomSolvedBoard(ctx.size, ctx.rng);
      const result = solve(board);
      if (!result.solved) {
        return { pass: false, reason: "solver failed on an already-solved board" };
      }
      if (result.moves.length !== 0) {
        return {
          pass: false,
          reason: `expected 0 moves for solved board, got ${result.moves.length}`,
        };
      }
      for (let r = 0; r < ctx.size; r++) {
        for (let c = 0; c < ctx.size; c++) {
          if (result.finalBoard[r]![c] !== board[r]![c]) {
            return {
              pass: false,
              reason: `cell (${r},${c}) changed from ${board[r]![c]} to ${result.finalBoard[r]![c]}`,
            };
          }
        }
      }
      return { pass: true };
    },
  },
  {
    name: "Partial State Consistency",
    fn: (ctx: PropertyContext): PropertyResult => {
      const puzzle = generateRandomPuzzle(ctx.size, ctx.rng);
      const result = solve(puzzle.puzzle);
      if (!result.solved) {
        const boxSize = ctx.size === 9 ? 3 : 2;

        for (let r = 0; r < ctx.size; r++) {
          for (let c = 0; c < ctx.size; c++) {
            const v = result.finalBoard[r]![c]!;
            if (v !== 0 && v !== puzzle.solution[r]![c]) {
              return {
                pass: false,
                reason: `partial board cell (${r},${c})=${v} differs from solution ${puzzle.solution[r]![c]}`,
              };
            }
          }
        }

        if (!hasNoConflicts(result.finalBoard, ctx.size)) {
          return { pass: false, reason: "partial board contains duplicate values" };
        }

        for (let r = 0; r < ctx.size; r++) {
          for (let c = 0; c < ctx.size; c++) {
            if (result.finalBoard[r]![c] === 0) {
              const count = getCandidateCount(result.finalBoard, r, c, ctx.size, boxSize);
              if (count === 0) {
                return { pass: false, reason: `cell (${r},${c}) has zero remaining candidates` };
              }
            }
          }
        }
      }
      return { pass: true };
    },
  },
];

export const solverGroup: PropertyGroup = { name: "Solver", properties };
