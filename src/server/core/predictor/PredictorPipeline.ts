import type { PredictorContextData, RemovalCandidate } from "./types";
import type { AnyDifficulty } from "../../../shared/types/api";
import { getStage1Filters, getStage2Features } from "./FeatureRegistry";
import { getBlendRatios, FEATURE_WEIGHTS, CALIBRATED_COEFFICIENTS } from "./PredictorWeights";

export function evaluateCandidates(
  ctx: PredictorContextData,
  candidates: RemovalCandidate[],
  difficulty: AnyDifficulty,
): RemovalCandidate[] {
  const stage1Filters = getStage1Filters();
  const stage2Features = getStage2Features();
  const blend = getBlendRatios(difficulty);
  const passed: RemovalCandidate[] = [];

  for (const candidate of candidates) {
    let keep = true;
    for (const filter of stage1Filters) {
      if (filter.enabledForDifficulty(difficulty)) {
        if (!filter.filter(ctx, candidate)) {
          keep = false;
          break;
        }
      }
    }
    if (!keep) continue;

    const { board } = ctx;
    const backup1 = board[candidate.row]![candidate.col]!;
    const isSymDifferent = candidate.symRow !== candidate.row || candidate.symCol !== candidate.col;
    const backup2 = isSymDifferent ? board[candidate.symRow]![candidate.symCol]! : 0;

    let predictorScore = 0;
    try {
      board[candidate.row]![candidate.col] = 0;
      if (isSymDifferent) {
        board[candidate.symRow]![candidate.symCol] = 0;
      }
      for (const feature of stage2Features) {
        if (feature.enabledForDifficulty(difficulty)) {
          const raw = feature.compute(ctx, candidate);
          const weight = FEATURE_WEIGHTS[feature.name];
          if (weight !== undefined) {
            predictorScore += raw * weight;
          }
        }
      }
    } finally {
      board[candidate.row]![candidate.col] = backup1;
      if (isSymDifferent) {
        board[candidate.symRow]![candidate.symCol] = backup2;
      }
    }

    candidate.predictorScore = Math.max(0, predictorScore);
    candidate.finalScore =
      blend.balance * candidate.balanceScore +
      blend.predictor * candidate.predictorScore;

    passed.push(candidate);
  }

  passed.sort((a, b) => b.finalScore - a.finalScore);
  return passed;
}

export function estimateDelta(
  ctx: PredictorContextData,
  candidate: RemovalCandidate,
  difficulty: AnyDifficulty,
): { delta: number; predictorScore: number; passedStage1: boolean } {
  const stage1Filters = getStage1Filters();
  const stage2Features = getStage2Features();

  for (const filter of stage1Filters) {
    if (filter.enabledForDifficulty(difficulty)) {
      if (!filter.filter(ctx, candidate)) {
        return { delta: 0, predictorScore: 0, passedStage1: false };
      }
    }
  }

  const { board } = ctx;
  const backup1 = board[candidate.row]![candidate.col]!;
  const isSymDifferent = candidate.symRow !== candidate.row || candidate.symCol !== candidate.col;
  const backup2 = isSymDifferent ? board[candidate.symRow]![candidate.symCol]! : 0;

  let rawScore = 0;
  try {
    board[candidate.row]![candidate.col] = 0;
    if (isSymDifferent) {
      board[candidate.symRow]![candidate.symCol] = 0;
    }
    const difficultyCoefs = CALIBRATED_COEFFICIENTS[difficulty] ?? {};
    for (const feature of stage2Features) {
      if (feature.enabledForDifficulty(difficulty)) {
        const raw = feature.compute(ctx, candidate);
        const coeff = difficultyCoefs[feature.name] ?? CALIBRATED_COEFFICIENTS["easy"]?.[feature.name];
        if (coeff !== undefined) {
          rawScore += raw * coeff;
        }
      }
    }
  } finally {
    board[candidate.row]![candidate.col] = backup1;
    if (isSymDifferent) {
      board[candidate.symRow]![candidate.symCol] = backup2;
    }
  }

  return {
    delta: rawScore,
    predictorScore: Math.max(0, rawScore),
    passedStage1: true,
  };
}
