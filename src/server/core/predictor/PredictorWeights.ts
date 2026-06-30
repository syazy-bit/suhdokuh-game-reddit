import type { AnyDifficulty } from "../../../shared/types/api";

export const FEATURE_WEIGHTS: Record<string, number> = {
  BIVALUE_CREATED: 2,
  NAKED_SINGLE_CREATED: -3,
  STRONG_LINK_CREATED: 5,
  LOCAL_CANDIDATE_SURGE: 1,
  SECTOR_CONFLICT: 3,
} as const;

type BlendKey = "easy" | "medium" | "hard" | "expert";

const BLEND_RATIOS: Record<BlendKey, { balance: number; predictor: number }> = {
  easy:   { balance: 0.7, predictor: 0.3 },
  medium: { balance: 0.5, predictor: 0.5 },
  hard:   { balance: 0.3, predictor: 0.7 },
  expert: { balance: 0.2, predictor: 0.8 },
};

function normalizeDifficulty(difficulty: AnyDifficulty): BlendKey {
  if (difficulty === "beginner" || difficulty === "advanced") return "easy";
  return difficulty as BlendKey;
}

export function getBlendRatios(
  difficulty: AnyDifficulty,
): { balance: number; predictor: number } {
  return BLEND_RATIOS[normalizeDifficulty(difficulty)];
}
