import type { PropertyGroup, PropertyContext, PropertyResult } from "../types";
import { randomSolvedBoard, randomPartialBoardWithSolution, cloneBoard } from "../Generators/boardGenerator";
import { predictDelta } from "../../core/DifficultyPredictor";
import type { PredictionResult } from "../../core/DifficultyPredictor";

function boxSizeFor(size: number): number {
  return size === 9 ? 3 : 2;
}

function equalResults(a: PredictionResult, b: PredictionResult): boolean {
  return a.score === b.score && a.candidateSurge === b.candidateSurge && a.mrvShift === b.mrvShift;
}

function findFilledCell(board: number[][]): { row: number; col: number } | null {
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board.length; c++) {
      if (board[r]![c] !== 0) return { row: r, col: c };
    }
  }
  return null;
}

function findEmptyCell(board: number[][]): { row: number; col: number } | null {
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board.length; c++) {
      if (board[r]![c] === 0) return { row: r, col: c };
    }
  }
  return null;
}

const properties = [
  {
    name: "BoundedScore",
    fn: (ctx: PropertyContext): PropertyResult => {
      const { partial } = randomPartialBoardWithSolution(ctx.size, ctx.rng);
      const boxSize = boxSizeFor(ctx.size);
      const cell = findFilledCell(partial);
      if (!cell) return { pass: false, reason: "partial board has no filled cells" };

      const result = predictDelta(partial, cell.row, cell.col, ctx.size, boxSize);
      if (result.score < 0 || result.score > 1) {
        return {
          pass: false,
          reason: `score=${result.score}, expected 0 <= score <= 1`,
        };
      }
      return { pass: true };
    },
  },
  {
    name: "BoundedCandidateSurge",
    fn: (ctx: PropertyContext): PropertyResult => {
      const { partial } = randomPartialBoardWithSolution(ctx.size, ctx.rng);
      const boxSize = boxSizeFor(ctx.size);
      const cell = findFilledCell(partial);
      if (!cell) return { pass: false, reason: "partial board has no filled cells" };

      const result = predictDelta(partial, cell.row, cell.col, ctx.size, boxSize);
      if (result.candidateSurge < 0 || result.candidateSurge > 1) {
        return {
          pass: false,
          reason: `candidateSurge=${result.candidateSurge}, expected 0 <= candidateSurge <= 1`,
        };
      }
      return { pass: true };
    },
  },
  {
    name: "BoundedMRVShift",
    fn: (ctx: PropertyContext): PropertyResult => {
      const { partial } = randomPartialBoardWithSolution(ctx.size, ctx.rng);
      const boxSize = boxSizeFor(ctx.size);
      const cell = findFilledCell(partial);
      if (!cell) return { pass: false, reason: "partial board has no filled cells" };

      const result = predictDelta(partial, cell.row, cell.col, ctx.size, boxSize);
      if (result.mrvShift < -1 || result.mrvShift > 1) {
        return {
          pass: false,
          reason: `mrvShift=${result.mrvShift}, expected -1 <= mrvShift <= 1`,
        };
      }
      return { pass: true };
    },
  },
  {
    name: "EmptyCellZero",
    fn: (ctx: PropertyContext): PropertyResult => {
      const { partial } = randomPartialBoardWithSolution(ctx.size, ctx.rng);
      const boxSize = boxSizeFor(ctx.size);
      const cell = findEmptyCell(partial);
      if (!cell) return { pass: false, reason: "partial board has no empty cells" };

      const result = predictDelta(partial, cell.row, cell.col, ctx.size, boxSize);
      if (result.score !== 0) {
        return { pass: false, reason: `score=${result.score}, expected 0 for empty cell` };
      }
      if (result.candidateSurge !== 0) {
        return { pass: false, reason: `candidateSurge=${result.candidateSurge}, expected 0 for empty cell` };
      }
      if (result.mrvShift !== 0) {
        return { pass: false, reason: `mrvShift=${result.mrvShift}, expected 0 for empty cell` };
      }
      return { pass: true };
    },
  },
  {
    name: "NoSideEffects",
    fn: (ctx: PropertyContext): PropertyResult => {
      const { partial } = randomPartialBoardWithSolution(ctx.size, ctx.rng);
      const boxSize = boxSizeFor(ctx.size);
      const cell = findFilledCell(partial);
      if (!cell) return { pass: false, reason: "partial board has no filled cells" };

      const original = cloneBoard(partial);
      predictDelta(partial, cell.row, cell.col, ctx.size, boxSize);

      for (let r = 0; r < ctx.size; r++) {
        for (let c = 0; c < ctx.size; c++) {
          if (partial[r]![c] !== original[r]![c]) {
            return {
              pass: false,
              reason: `cell (${r},${c}) changed from ${original[r]![c]} to ${partial[r]![c]} after predictDelta`,
            };
          }
        }
      }
      return { pass: true };
    },
  },
  {
    name: "Determinism",
    fn: (ctx: PropertyContext): PropertyResult => {
      const { partial } = randomPartialBoardWithSolution(ctx.size, ctx.rng);
      const boxSize = boxSizeFor(ctx.size);
      const cell = findFilledCell(partial);
      if (!cell) return { pass: false, reason: "partial board has no filled cells" };

      const a = predictDelta(partial, cell.row, cell.col, ctx.size, boxSize);
      const b = predictDelta(partial, cell.row, cell.col, ctx.size, boxSize);

      if (!equalResults(a, b)) {
        return {
          pass: false,
          reason: `first call returned (${a.score}, ${a.candidateSurge}, ${a.mrvShift}) but second returned (${b.score}, ${b.candidateSurge}, ${b.mrvShift})`,
        };
      }
      return { pass: true };
    },
  },
  {
    name: "PositiveSurgeOnRemoval",
    fn: (ctx: PropertyContext): PropertyResult => {
      const board = randomSolvedBoard(ctx.size, ctx.rng);
      const boxSize = boxSizeFor(ctx.size);
      const cell = findFilledCell(board);
      if (!cell) return { pass: false, reason: "solved board has no filled cells" };

      const result = predictDelta(board, cell.row, cell.col, ctx.size, boxSize);
      if (result.candidateSurge <= 0) {
        return {
          pass: false,
          reason: `candidateSurge=${result.candidateSurge}, expected > 0 when removing a value from a solved board`,
        };
      }
      return { pass: true };
    },
  },
];

export const difficultyPredictorGroup: PropertyGroup = { name: "DifficultyPredictor", properties };
