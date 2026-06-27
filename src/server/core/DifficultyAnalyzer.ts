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
  easy: 10,
  medium: 30,
  hard: 60,
};

export interface AnalysisResult {
  score: number;
  difficulty: Difficulty;
  hardestTechnique: Technique | null;
  techniqueCounts: Partial<Record<Technique, number>>;
}

export function createEmptyAnalysis(): AnalysisResult {
  return {
    score: 0,
    difficulty: "easy",
    hardestTechnique: null,
    techniqueCounts: {},
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

  for (const move of result.moves) {
    const t = move.technique;
    techniqueCounts[t] = (techniqueCounts[t] ?? 0) + 1;
    score += TECHNIQUE_WEIGHTS[t];

    const idx = TECHNIQUE_PRIORITY.indexOf(t);
    if (idx > hardestIdx) {
      hardestIdx = idx;
      hardestTechnique = t;
    }
  }

  return {
    score,
    difficulty: difficultyFromScore(score),
    hardestTechnique,
    techniqueCounts,
  };
}
