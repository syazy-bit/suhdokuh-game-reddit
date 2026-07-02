import type { PropertyGroup, PropertyContext, PropertyResult } from "../types";
import { randomPartialBoardWithSolution } from "../Generators/boardGenerator";
import { generateRandomPuzzle } from "../Generators/puzzleGenerator";
import { getCandidates, getCandidateCount, hasSingleCandidate, getMaskCandidates, buildCandidateMap, buildMaskMap } from "../../core/CandidateEngine";
import { toArray } from "../../core/CandidateMask";
import { isValidPlacement } from "../../core/SudokuValidator";

function boxSizeFor(size: number): number {
  return size === 9 ? 3 : 2;
}

function emptyBoard(size: number): number[][] {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function sorted(a: number[]): number[] {
  return [...a].sort((x, y) => x - y);
}

const properties = [
  {
    name: "CandidateValidity",
    fn: (ctx: PropertyContext): PropertyResult => {
      const { partial } = randomPartialBoardWithSolution(ctx.size, ctx.rng);
      const boxSize = boxSizeFor(ctx.size);
      for (let r = 0; r < ctx.size; r++) {
        for (let c = 0; c < ctx.size; c++) {
          if (partial[r]![c] !== 0) continue;
          const candidates = getCandidates(partial, r, c, ctx.size, boxSize);
          for (const v of candidates) {
            if (!isValidPlacement(partial, r, c, v, ctx.size, boxSize)) {
              return {
                pass: false,
                reason: `cell (${r},${c}): getCandidates returned ${v} but isValidPlacement rejects it`,
              };
            }
          }
        }
      }
      return { pass: true };
    },
  },
  {
    name: "CandidateExhaustiveness",
    fn: (ctx: PropertyContext): PropertyResult => {
      const { partial } = randomPartialBoardWithSolution(ctx.size, ctx.rng);
      const boxSize = boxSizeFor(ctx.size);
      for (let r = 0; r < ctx.size; r++) {
        for (let c = 0; c < ctx.size; c++) {
          if (partial[r]![c] !== 0) continue;
          const candidates = getCandidates(partial, r, c, ctx.size, boxSize);
          for (let v = 1; v <= ctx.size; v++) {
            if (isValidPlacement(partial, r, c, v, ctx.size, boxSize) && !candidates.includes(v)) {
              return {
                pass: false,
                reason: `cell (${r},${c}): isValidPlacement accepts ${v} but getCandidates excludes it ([${candidates.join(",")}])`,
              };
            }
          }
        }
      }
      return { pass: true };
    },
  },
  {
    name: "CandidateUniqueness",
    fn: (ctx: PropertyContext): PropertyResult => {
      const { partial } = randomPartialBoardWithSolution(ctx.size, ctx.rng);
      const boxSize = boxSizeFor(ctx.size);
      for (let r = 0; r < ctx.size; r++) {
        for (let c = 0; c < ctx.size; c++) {
          if (partial[r]![c] !== 0) continue;
          const candidates = getCandidates(partial, r, c, ctx.size, boxSize);
          const unique = new Set(candidates);
          if (unique.size !== candidates.length) {
            return {
              pass: false,
              reason: `cell (${r},${c}): getCandidates returned duplicates: [${candidates.join(",")}]`,
            };
          }
        }
      }
      return { pass: true };
    },
  },
  {
    name: "CountConsistency",
    fn: (ctx: PropertyContext): PropertyResult => {
      const { partial } = randomPartialBoardWithSolution(ctx.size, ctx.rng);
      const boxSize = boxSizeFor(ctx.size);
      for (let r = 0; r < ctx.size; r++) {
        for (let c = 0; c < ctx.size; c++) {
          const count = getCandidateCount(partial, r, c, ctx.size, boxSize);
          const candidates = getCandidates(partial, r, c, ctx.size, boxSize);
          if (count !== candidates.length) {
            return {
              pass: false,
              reason: `cell (${r},${c}): getCandidateCount=${count}, getCandidates.length=${candidates.length}`,
            };
          }
        }
      }
      return { pass: true };
    },
  },
  {
    name: "SingleConsistency",
    fn: (ctx: PropertyContext): PropertyResult => {
      const { partial } = randomPartialBoardWithSolution(ctx.size, ctx.rng);
      const boxSize = boxSizeFor(ctx.size);
      for (let r = 0; r < ctx.size; r++) {
        for (let c = 0; c < ctx.size; c++) {
          const single = hasSingleCandidate(partial, r, c, ctx.size, boxSize);
          const count = getCandidateCount(partial, r, c, ctx.size, boxSize);
          if (count === 1 && single === null) {
            return {
              pass: false,
              reason: `cell (${r},${c}): count=1 but hasSingleCandidate returned null`,
            };
          }
          if (count !== 1 && single !== null) {
            return {
              pass: false,
              reason: `cell (${r},${c}): count=${count} but hasSingleCandidate returned ${single}`,
            };
          }
          if (single !== null && single !== getCandidates(partial, r, c, ctx.size, boxSize)[0]) {
            return {
              pass: false,
              reason: `cell (${r},${c}): hasSingleCandidate=${single} but candidate list is [${getCandidates(partial, r, c, ctx.size, boxSize).join(",")}]`,
            };
          }
        }
      }
      return { pass: true };
    },
  },
  {
    name: "OracleCandidatePreservation",
    fn: (ctx: PropertyContext): PropertyResult => {
      const puzzle = generateRandomPuzzle(ctx.size, ctx.rng);
      const boxSize = boxSizeFor(ctx.size);
      for (let r = 0; r < ctx.size; r++) {
        for (let c = 0; c < ctx.size; c++) {
          if (puzzle.puzzle[r]![c] !== 0) continue;
          const candidates = getCandidates(puzzle.puzzle, r, c, ctx.size, boxSize);
          const oracle = puzzle.solution[r]![c]!;
          if (!candidates.includes(oracle)) {
            return {
              pass: false,
              reason: `cell (${r},${c}): oracle value ${oracle} missing from getCandidates ([${candidates.join(",")}])`,
            };
          }
        }
      }
      return { pass: true };
    },
  },
  {
    name: "MaskArrayEquivalence",
    fn: (ctx: PropertyContext): PropertyResult => {
      const { partial } = randomPartialBoardWithSolution(ctx.size, ctx.rng);
      const boxSize = boxSizeFor(ctx.size);
      for (let r = 0; r < ctx.size; r++) {
        for (let c = 0; c < ctx.size; c++) {
          const arrayCandidates = getCandidates(partial, r, c, ctx.size, boxSize);
          const mask = getMaskCandidates(partial, r, c, ctx.size, boxSize);
          const maskCandidates = toArray(mask);
          const sortedArray = sorted(arrayCandidates);
          const sortedMask = sorted(maskCandidates);
          if (JSON.stringify(sortedArray) !== JSON.stringify(sortedMask)) {
            return {
              pass: false,
              reason: `cell (${r},${c}): getCandidates=[${sortedArray.join(",")}] but getMaskCandidates→toArray=[${sortedMask.join(",")}]`,
            };
          }
        }
      }
      return { pass: true };
    },
  },
  {
    name: "BuildMapConsistency",
    fn: (ctx: PropertyContext): PropertyResult => {
      const { partial } = randomPartialBoardWithSolution(ctx.size, ctx.rng);
      const boxSize = boxSizeFor(ctx.size);
      const map = buildCandidateMap(partial, ctx.size, boxSize);
      for (let r = 0; r < ctx.size; r++) {
        for (let c = 0; c < ctx.size; c++) {
          if (partial[r]![c] !== 0) {
            if (map[r]![c]!.length !== 0) {
              return {
                pass: false,
                reason: `cell (${r},${c}): filled cell should have empty candidate list but got [${map[r]![c]!.join(",")}]`,
              };
            }
          } else {
            const expected = getCandidates(partial, r, c, ctx.size, boxSize);
            const actual = map[r]![c]!;
            if (JSON.stringify(sorted(expected)) !== JSON.stringify(sorted(actual))) {
              return {
                pass: false,
                reason: `cell (${r},${c}): buildCandidateMap=[${actual.join(",")}] but getCandidates=[${expected.join(",")}]`,
              };
            }
          }
        }
      }
      return { pass: true };
    },
  },
  {
    name: "BuildMaskMapConsistency",
    fn: (ctx: PropertyContext): PropertyResult => {
      const { partial } = randomPartialBoardWithSolution(ctx.size, ctx.rng);
      const boxSize = boxSizeFor(ctx.size);
      const map = buildMaskMap(partial, ctx.size, boxSize);
      for (let r = 0; r < ctx.size; r++) {
        for (let c = 0; c < ctx.size; c++) {
          if (partial[r]![c] !== 0) {
            if (map[r]![c] !== 0) {
              return {
                pass: false,
                reason: `cell (${r},${c}): filled cell should have mask 0 but got ${map[r]![c]}`,
              };
            }
          } else {
            const expected = getMaskCandidates(partial, r, c, ctx.size, boxSize);
            if (map[r]![c] !== expected) {
              return {
                pass: false,
                reason: `cell (${r},${c}): buildMaskMap=${map[r]![c]} but getMaskCandidates=${expected}`,
              };
            }
          }
        }
      }
      return { pass: true };
    },
  },
  {
    name: "EmptyCellReturnsAll",
    fn: (ctx: PropertyContext): PropertyResult => {
      const board = emptyBoard(ctx.size);
      const boxSize = boxSizeFor(ctx.size);
      for (let r = 0; r < ctx.size; r++) {
        for (let c = 0; c < ctx.size; c++) {
          const count = getCandidateCount(board, r, c, ctx.size, boxSize);
          if (count !== ctx.size) {
            return {
              pass: false,
              reason: `cell (${r},${c}): getCandidateCount=${count}, expected ${ctx.size} for empty board`,
            };
          }
          const candidates = getCandidates(board, r, c, ctx.size, boxSize);
          if (candidates.length !== ctx.size) {
            return {
              pass: false,
              reason: `cell (${r},${c}): getCandidates.length=${candidates.length}, expected ${ctx.size} for empty board`,
            };
          }
          const expected = Array.from({ length: ctx.size }, (_, i) => i + 1);
          if (JSON.stringify(sorted(candidates)) !== JSON.stringify(expected)) {
            return {
              pass: false,
              reason: `cell (${r},${c}): getCandidates=[${candidates.join(",")}], expected [${expected.join(",")}]`,
            };
          }
        }
      }
      return { pass: true };
    },
  },
];

export const candidateEngineGroup: PropertyGroup = { name: "CandidateEngine", properties };
