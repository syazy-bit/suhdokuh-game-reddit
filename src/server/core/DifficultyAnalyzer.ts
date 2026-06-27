import { TECHNIQUE_PRIORITY, type Technique } from "./HumanSolverTypes";
import type { SolveResult } from "./HumanSolverPipeline";

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = typeof DIFFICULTIES[number];

export const TECHNIQUE_WEIGHTS: Record<Technique, number> = {
  "Naked Single": 1.0,
  "Hidden Single": 1.5,
  "Naked Pair": 3.0,
  "Hidden Pair": 4.0,
  "Pointing Pair": 5.0,
  "Claiming Pair": 5.5,
  "X-Wing": 7.0,
};

export const DIFFICULTY_THRESHOLDS: Record<Difficulty, number> = {
  easy: 30,
  medium: 52,
  hard: 60,
};

export interface AnalysisResult {
  score: number;
  difficulty: Difficulty;
  hardestTechnique: Technique | null;
  techniqueCounts: Partial<Record<Technique, number>>;
  assignmentCount: number;
  eliminationCount: number;
  totalSteps: number;
}

export function createEmptyAnalysis(): AnalysisResult {
  return {
    score: 0,
    difficulty: "easy",
    hardestTechnique: null,
    techniqueCounts: {},
    assignmentCount: 0,
    eliminationCount: 0,
    totalSteps: 0,
  };
}

export function difficultyFromScore(score: number): Difficulty {
  if (score <= DIFFICULTY_THRESHOLDS.easy) return "easy";
  if (score <= DIFFICULTY_THRESHOLDS.medium) return "medium";
  return "hard";
}

export function analyzeSolveResult(result: SolveResult): AnalysisResult {
  const techniqueCounts: Partial<Record<Technique, number>> = {};
  let score = 0;
  let hardestIdx = -1;
  let hardestTechnique: Technique | null = null;
  let assignmentCount = 0;
  let eliminationCount = 0;

  for (const move of result.moves) {
    const t = move.technique;
    techniqueCounts[t] = (techniqueCounts[t] ?? 0) + 1;
    score += TECHNIQUE_WEIGHTS[t];

    const idx = TECHNIQUE_PRIORITY.indexOf(t);
    if (idx > hardestIdx) {
      hardestIdx = idx;
      hardestTechnique = t;
    }

    switch (move.type) {
      case "assignment":
        assignmentCount++;
        break;
      case "elimination":
        eliminationCount++;
        break;
      default: {
        const _exhaustive: never = move;
        void _exhaustive;
        throw new Error("Unhandled LogicalMove type");
      }
    }
  }

  return {
    score,
    difficulty: difficultyFromScore(score),
    hardestTechnique,
    techniqueCounts,
    assignmentCount,
    eliminationCount,
    totalSteps: result.moves.length,
  };
}
