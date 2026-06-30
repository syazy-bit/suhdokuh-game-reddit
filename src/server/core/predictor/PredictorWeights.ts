import type { AnyDifficulty } from "../../../shared/types/api";
import calibratedWeights from "../../config/calibrated-weights.json";

export const FEATURE_WEIGHTS: Record<string, number> = {
  BIVALUE_CREATED: 2,
  NAKED_SINGLE_CREATED: -3,
  STRONG_LINK_CREATED: 5,
  LOCAL_CANDIDATE_SURGE: 1,
  SECTOR_CONFLICT: 3,
} as const;

type BlendKey = "easy" | "medium" | "hard" | "expert";
const BLEND_KEYS: BlendKey[] = ["easy", "medium", "hard", "expert"];

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

// ── Calibrated coefficients ────────────────────────────────────────────────
// Per-difficulty coefficients from config/calibrated-weights.json.
// Structure: { difficulty: { featureName: coefficient } }
// Falls back to FEATURE_WEIGHTS for any difficulty/feature not in the file.

const RAW_COEFFICIENTS: Record<string, unknown> | undefined =
  (calibratedWeights as { coefficients?: Record<string, unknown> }).coefficients;

function buildCalibratedCoefficients(): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};

  for (const key of BLEND_KEYS) {
    const difficultyCoefs: Record<string, number> = { ...FEATURE_WEIGHTS };
    const perDifficulty = RAW_COEFFICIENTS?.[key];
    if (perDifficulty && typeof perDifficulty === "object") {
      for (const [name, val] of Object.entries(perDifficulty as Record<string, unknown>)) {
        if (typeof val === "number" && Number.isFinite(val)) {
          difficultyCoefs[name] = val;
        }
      }
    }
    result[key] = difficultyCoefs;
  }

  return result;
}

export const CALIBRATED_COEFFICIENTS: Readonly<Record<string, Readonly<Record<string, number>>>> =
  buildCalibratedCoefficients();

const LAMBDA_VALUES: Record<BlendKey, number> = {
  easy: 0.2,
  medium: 0.4,
  hard: 0.6,
  expert: 0.8,
};

export function getLambda(difficulty: AnyDifficulty): number {
  return LAMBDA_VALUES[normalizeDifficulty(difficulty)];
}

// ── Absolute RMSE ───────────────────────────────────────────────────────────
// Read directly from calibration holdout metrics (already in score units).
// The calibration pipeline computes actualDelta = Score(after) - Score(before),
// so the holdout RMSE is already measured in absolute score space.

const RAW_HOLDOUT_METRICS: Record<string, unknown> | undefined =
  (calibratedWeights as { holdoutMetrics?: Record<string, unknown> }).holdoutMetrics;

const ABSOLUTE_RMSE: Record<string, number> = (() => {
  const result: Record<string, number> = {};
  for (const key of BLEND_KEYS) {
    const metrics = RAW_HOLDOUT_METRICS?.[key] as Record<string, unknown> | undefined;
    const rmse = metrics?.rmse;
    result[key] = typeof rmse === "number" && Number.isFinite(rmse) ? rmse : 0.3;
  }
  return result;
})();

export function getAbsoluteRMSE(difficulty: AnyDifficulty): number {
  return ABSOLUTE_RMSE[normalizeDifficulty(difficulty)] ?? 0.3;
}
