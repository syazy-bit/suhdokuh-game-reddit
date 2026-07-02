import type { PropertyGroup, PropertyContext, PropertyResult } from "../types";
import { randomPartialBoardWithSolution, randomSolvedBoard, cloneBoard } from "../Generators/boardGenerator";
import { getHint } from "../../core/HintEngine";
import { solveStep } from "../../core/HumanSolverPipeline";
import { getTechniqueDescription } from "../../core/TechniqueDescriptions";

function emptyBoard(size: number): number[][] {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

const properties = [
  {
    name: "SolvedReturnsNull",
    fn: (ctx: PropertyContext): PropertyResult => {
      const board = randomSolvedBoard(ctx.size, ctx.rng);
      const hint = getHint(board);
      if (hint !== null) {
        return { pass: false, reason: "getHint returned a hint for a solved board" };
      }
      return { pass: true };
    },
  },
  {
    name: "EmptyReturnsNull",
    fn: (ctx: PropertyContext): PropertyResult => {
      const board = emptyBoard(ctx.size);
      const hint = getHint(board);
      if (hint !== null) {
        return { pass: false, reason: "getHint returned a hint for an empty board" };
      }
      return { pass: true };
    },
  },
  {
    name: "NoSideEffects",
    fn: (ctx: PropertyContext): PropertyResult => {
      const { partial } = randomPartialBoardWithSolution(ctx.size, ctx.rng);
      const snapshot = cloneBoard(partial);
      getHint(partial);
      for (let r = 0; r < ctx.size; r++) {
        for (let c = 0; c < ctx.size; c++) {
          if (partial[r]![c] !== snapshot[r]![c]) {
            return {
              pass: false,
              reason: `board was mutated at (${r},${c}): ${snapshot[r]![c]} -> ${partial[r]![c]}`,
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
      const first = getHint(partial);
      const second = getHint(partial);
      if (JSON.stringify(first) !== JSON.stringify(second)) {
        return {
          pass: false,
          reason: `getHint returned different results on two calls: ${JSON.stringify(first)} vs ${JSON.stringify(second)}`,
        };
      }
      return { pass: true };
    },
  },
  {
    name: "RegistryConsistency",
    fn: (ctx: PropertyContext): PropertyResult => {
      const { partial } = randomPartialBoardWithSolution(ctx.size, ctx.rng);
      const hint = getHint(partial);
      if (hint !== null) {
        const desc = getTechniqueDescription(hint.move.technique);
        if (hint.title !== desc.title) {
          return { pass: false, reason: `title mismatch: "${hint.title}" vs "${desc.title}"` };
        }
        if (hint.summary !== desc.summary) {
          return { pass: false, reason: `summary mismatch: "${hint.summary}" vs "${desc.summary}"` };
        }
        if (hint.explanation !== desc.explanation) {
          return { pass: false, reason: `explanation mismatch: "${hint.explanation}" vs "${desc.explanation}"` };
        }
      }
      return { pass: true };
    },
  },
  {
    name: "SolveStepEquivalence",
    fn: (ctx: PropertyContext): PropertyResult => {
      const { partial } = randomPartialBoardWithSolution(ctx.size, ctx.rng);
      const hint = getHint(partial);
      const step = solveStep(partial);

      if ((hint === null) !== (step === null)) {
        return {
          pass: false,
          reason: `nullability mismatch: hint=${hint !== null}, step=${step !== null}`,
        };
      }

      if (hint !== null && step !== null) {
        if (JSON.stringify(hint.move) !== JSON.stringify(step)) {
          return {
            pass: false,
            reason: `hint.move=${JSON.stringify(hint.move)} does not equal solveStep=${JSON.stringify(step)}`,
          };
        }
      }
      return { pass: true };
    },
  },
];

export const hintEngineGroup: PropertyGroup = { name: "HintEngine", properties };
