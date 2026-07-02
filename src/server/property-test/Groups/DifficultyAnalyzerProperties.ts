import type { PropertyGroup, PropertyContext, PropertyResult } from "../types";
import { generateRandomPuzzle } from "../Generators/puzzleGenerator";
import { solve } from "../../core/HumanSolverPipeline";
import {
  analyzeSolveResult,
  createEmptyAnalysis,
  difficultyFromScore,
  DIFFICULTY_THRESHOLDS,
  DIFFICULTIES,
  TECHNIQUE_WEIGHTS,
} from "../../core/DifficultyAnalyzer";
import { TECHNIQUE_PRIORITY } from "../../core/HumanSolverTypes";
import type { Technique } from "../../core/HumanSolverTypes";

const properties = [
  {
    name: "NonNegativeScore",
    fn: (ctx: PropertyContext): PropertyResult => {
      const puzzle = generateRandomPuzzle(ctx.size, ctx.rng);
      const result = solve(puzzle.puzzle);
      const analysis = analyzeSolveResult(result);
      if (analysis.score < 0) {
        return {
          pass: false,
          reason: `analysis.score = ${analysis.score}, expected >= 0`,
        };
      }
      return { pass: true };
    },
  },
  {
    name: "ScoreDecomposition",
    fn: (ctx: PropertyContext): PropertyResult => {
      const puzzle = generateRandomPuzzle(ctx.size, ctx.rng);
      const result = solve(puzzle.puzzle);
      const analysis = analyzeSolveResult(result);

      const counts: Partial<Record<Technique, number>> = {};
      for (const move of result.moves) {
        counts[move.technique] = (counts[move.technique] ?? 0) + 1;
      }

      for (const [technique, count] of Object.entries(counts)) {
        const t = technique as Technique;
        const actual = analysis.techniqueCounts[t] ?? 0;
        if (actual !== count) {
          return {
            pass: false,
            reason: `analysis.techniqueCounts[${t}]=${actual} but expected ${count} from moves`,
          };
        }
      }

      for (const [technique, count] of Object.entries(analysis.techniqueCounts)) {
        if (!(technique in counts)) {
          return {
            pass: false,
            reason: `analysis.techniqueCounts contains unexpected technique "${technique}" with count ${count}`,
          };
        }
      }

      let expectedScore = 0;
      for (const [technique, count] of Object.entries(counts)) {
        expectedScore += TECHNIQUE_WEIGHTS[technique as Technique] * count!;
      }

      if (analysis.score !== expectedScore) {
        return {
          pass: false,
          reason: `analysis.score=${analysis.score} but sum of weight×count=${expectedScore}`,
        };
      }
      return { pass: true };
    },
  },
  {
    name: "CountConsistency",
    fn: (ctx: PropertyContext): PropertyResult => {
      const puzzle = generateRandomPuzzle(ctx.size, ctx.rng);
      const result = solve(puzzle.puzzle);
      const analysis = analyzeSolveResult(result);

      if (analysis.assignmentCount + analysis.eliminationCount !== analysis.totalSteps) {
        return {
          pass: false,
          reason: `assignments(${analysis.assignmentCount}) + eliminations(${analysis.eliminationCount}) !== totalSteps(${analysis.totalSteps})`,
        };
      }

      if (analysis.totalSteps !== result.moves.length) {
        return {
          pass: false,
          reason: `totalSteps(${analysis.totalSteps}) !== moves.length(${result.moves.length})`,
        };
      }

      return { pass: true };
    },
  },
  {
    name: "DifficultyThresholdConsistency",
    fn: (ctx: PropertyContext): PropertyResult => {
      const puzzle = generateRandomPuzzle(ctx.size, ctx.rng);
      const result = solve(puzzle.puzzle);
      const analysis = analyzeSolveResult(result);

      const expected = difficultyFromScore(analysis.score);
      if (expected !== analysis.difficulty) {
        return {
          pass: false,
          reason: `difficultyFromScore(${analysis.score})=${expected} but analysis.difficulty=${analysis.difficulty}`,
        };
      }
      return { pass: true };
    },
  },
  {
    name: "HardestTechniqueConsistency",
    fn: (ctx: PropertyContext): PropertyResult => {
      const puzzle = generateRandomPuzzle(ctx.size, ctx.rng);
      const result = solve(puzzle.puzzle);
      const analysis = analyzeSolveResult(result);

      if (result.moves.length === 0) {
        if (analysis.hardestTechnique !== null) {
          return {
            pass: false,
            reason: `no moves but analysis.hardestTechnique=${analysis.hardestTechnique}, expected null`,
          };
        }
        return { pass: true };
      }

      let expectedHardest: Technique | null = null;
      let highestIdx = -1;
      for (const move of result.moves) {
        const idx = TECHNIQUE_PRIORITY.indexOf(move.technique);
        if (idx > highestIdx) {
          highestIdx = idx;
          expectedHardest = move.technique;
        }
      }

      if (analysis.hardestTechnique !== expectedHardest) {
        return {
          pass: false,
          reason: `analysis.hardestTechnique=${analysis.hardestTechnique}, expected ${expectedHardest} (highest TECHNIQUE_PRIORITY index among moves)`,
        };
      }

      return { pass: true };
    },
  },
  {
    name: "EmptyAnalysis",
    fn: (_ctx: PropertyContext): PropertyResult => {
      const analysis = createEmptyAnalysis();

      if (analysis.score !== 0) {
        return { pass: false, reason: `score=${analysis.score}, expected 0` };
      }

      if (analysis.difficulty !== "easy") {
        return { pass: false, reason: `difficulty=${analysis.difficulty}, expected easy` };
      }

      if (analysis.hardestTechnique !== null) {
        return { pass: false, reason: `hardestTechnique=${analysis.hardestTechnique}, expected null` };
      }

      if (Object.keys(analysis.techniqueCounts).length !== 0) {
        return { pass: false, reason: `techniqueCounts is not empty` };
      }

      if (analysis.assignmentCount !== 0) {
        return { pass: false, reason: `assignmentCount=${analysis.assignmentCount}, expected 0` };
      }

      if (analysis.eliminationCount !== 0) {
        return { pass: false, reason: `eliminationCount=${analysis.eliminationCount}, expected 0` };
      }

      if (analysis.totalSteps !== 0) {
        return { pass: false, reason: `totalSteps=${analysis.totalSteps}, expected 0` };
      }

      return { pass: true };
    },
  },
  {
    name: "ThresholdBoundary",
    fn: (_ctx: PropertyContext): PropertyResult => {
      const eps = 0.001;

      for (let i = 0; i < DIFFICULTIES.length; i++) {
        const difficulty = DIFFICULTIES[i]!;
        const threshold = DIFFICULTY_THRESHOLDS[difficulty];

        const at = difficultyFromScore(threshold);
        if (at !== difficulty) {
          return {
            pass: false,
            reason: `difficultyFromScore(${threshold}) returned ${at}, expected ${difficulty}`,
          };
        }

        if (i > 0) {
          const prevThreshold = DIFFICULTY_THRESHOLDS[DIFFICULTIES[i - 1]!];
          const above = difficultyFromScore(prevThreshold + eps);
          if (above !== difficulty) {
            return {
              pass: false,
              reason: `difficultyFromScore(${prevThreshold} + ${eps}) returned ${above}, expected ${difficulty}`,
            };
          }
        }

        if (i < DIFFICULTIES.length - 1) {
          const nextDifficulty = DIFFICULTIES[i + 1]!;
          const above = difficultyFromScore(threshold + eps);
          if (above !== nextDifficulty) {
            return {
              pass: false,
              reason: `difficultyFromScore(${threshold + eps}) returned ${above}, expected ${nextDifficulty}`,
            };
          }
        } else {
          const above = difficultyFromScore(threshold + eps);
          if (above !== difficulty) {
            return {
              pass: false,
              reason: `difficultyFromScore(${threshold + eps}) returned ${above}, expected ${difficulty} (highest difficulty)`,
            };
          }
        }
      }

      return { pass: true };
    },
  },
];

export const difficultyAnalyzerGroup: PropertyGroup = { name: "DifficultyAnalyzer", properties };
