#!/usr/bin/env tsx

import { Matrix, solve } from "ml-matrix";
import * as fs from "node:fs";
import * as path from "node:path";
import type { AnyDifficulty } from "../src/shared/types/api";
import type { CalibrationSample } from "./generateCalibrationDataset";

const DIFFICULTIES: AnyDifficulty[] = ["easy", "medium", "hard", "expert"];
const ALPHA_CANDIDATES = [0.001, 0.01, 0.1, 1, 10, 100, 1000];
const CV_FOLDS = 5;

interface ValidationMetrics {
  pearsonR: number;
  spearmanRho: number;
  rmse: number;
  difficultyMatchRate: number;
  topKAccuracy: number;
  featureImportance: Record<string, number>;
  sampleCount: number;
}

export interface CalibratedOutput {
  version: number;
  timestamp: string;
  seed: number;
  datasetSize: Record<string, number>;
  holdoutMetrics: Record<string, ValidationMetrics> | null;
  coefficients: Record<string, Record<string, number>>;
}

function pearsonCorrelation(actual: number[], predicted: number[]): number {
  const n = actual.length;
  const meanA = actual.reduce((a, b) => a + b, 0) / n;
  const meanP = predicted.reduce((a, b) => a + b, 0) / n;
  let cov = 0, varA = 0, varP = 0;
  for (let i = 0; i < n; i++) {
    const da = actual[i]! - meanA;
    const dp = predicted[i]! - meanP;
    cov += da * dp;
    varA += da * da;
    varP += dp * dp;
  }
  const denom = Math.sqrt(varA * varP);
  return denom === 0 ? 0 : cov / denom;
}

function spearmanCorrelation(actual: number[], predicted: number[]): number {
  const n = actual.length;
  const indexed = actual.map((a, i) => ({ a, p: predicted[i]!, idx: i }));
  const actualRanked = [...indexed].sort((x, y) => x.a - y.a);
  const predictedRanked = [...indexed].sort((x, y) => x.p - y.p);
  const aRanks = new Array<number>(n);
  const pRanks = new Array<number>(n);
  actualRanked.forEach((v, i) => { aRanks[v.idx] = i; });
  predictedRanked.forEach((v, i) => { pRanks[v.idx] = i; });
  return pearsonCorrelation(aRanks, pRanks);
}

function rootMeanSquaredError(actual: number[], predicted: number[]): number {
  const n = actual.length;
  const sumSq = actual.reduce((sum, a, i) => {
    const diff = a - predicted[i]!;
    return sum + diff * diff;
  }, 0);
  return Math.sqrt(sumSq / n);
}

function difficultyFromScore(score: number): AnyDifficulty {
  if (score <= 30) return "easy";
  if (score <= 52) return "medium";
  if (score <= 75) return "hard";
  return "expert";
}

function computeValidationMetrics(
  actualDeltas: number[],
  predictedDeltas: number[],
  currentScores: number[],
  afterScores: number[],
): ValidationMetrics {
  const pearsonR = pearsonCorrelation(actualDeltas, predictedDeltas);
  const spearmanRho = spearmanCorrelation(actualDeltas, predictedDeltas);
  const rmse = rootMeanSquaredError(actualDeltas, predictedDeltas);

  const n = actualDeltas.length;
  let matchCount = 0;
  for (let i = 0; i < n; i++) {
    const predictedScore = currentScores[i]! + predictedDeltas[i]!;
    const predictedDifficulty = difficultyFromScore(predictedScore);
    const actualDifficulty = difficultyFromScore(afterScores[i]!);
    if (predictedDifficulty === actualDifficulty) matchCount++;
  }
  const difficultyMatchRate = matchCount / n;

  return {
    pearsonR,
    spearmanRho,
    rmse,
    difficultyMatchRate,
    topKAccuracy: 0,
    featureImportance: {},
    sampleCount: n,
  };
}

function standardize(matrix: number[][]): {
  standardized: number[][];
  means: number[];
  stds: number[];
} {
  const cols = matrix[0]!.length;
  const rows = matrix.length;
  const means = new Array<number>(cols).fill(0);
  const stds = new Array<number>(cols).fill(0);

  for (let j = 0; j < cols; j++) {
    let sum = 0;
    for (let i = 0; i < rows; i++) {
      sum += matrix[i]![j]!;
    }
    means[j] = sum / rows;
  }

  for (let j = 0; j < cols; j++) {
    let sumSq = 0;
    for (let i = 0; i < rows; i++) {
      const diff = matrix[i]![j]! - means[j]!;
      sumSq += diff * diff;
    }
    stds[j] = Math.sqrt(sumSq / rows) || 1;
  }

  const standardized = matrix.map((row) =>
    row.map((val, j) => (val - means[j]!) / stds[j]!),
  );

  return { standardized, means, stds };
}

function fitRidge(
  X_data: number[][],
  y_data: number[],
  alpha: number,
): number[] {
  const X = new Matrix(X_data);
  const y = new Matrix(y_data.map((v) => [v]));

  const Xt = X.transpose();
  const XtX = Xt.mmul(X);
  const I = Matrix.eye(X.columns);
  const reg = XtX.add(I.mul(alpha));
  const Xty = Xt.mmul(y);

  const beta = solve(reg, Xty);
  const result: number[] = [];
  for (let i = 0; i < beta.rows; i++) {
    result.push(beta.get(i, 0));
  }
  return result;
}

function predictRidge(X_data: number[][], coefficients: number[]): number[] {
  return X_data.map((row) =>
    row.reduce((sum, val, j) => sum + val * coefficients[j]!, 0),
  );
}

function crossValidateRidge(
  X_data: number[][],
  y_data: number[],
  alpha: number,
  folds: number,
): { meanRmse: number; stdRmse: number } {
  const n = X_data.length;
  const indices = Array.from({ length: n }, (_, i) => i);
  const foldSize = Math.floor(n / folds);
  const rmses: number[] = [];

  for (let fold = 0; fold < folds; fold++) {
    const testStart = fold * foldSize;
    const testEnd = fold === folds - 1 ? n : testStart + foldSize;
    const testIndices = indices.slice(testStart, testEnd);
    const trainIndices = [
      ...indices.slice(0, testStart),
      ...indices.slice(testEnd),
    ];

    const X_train = trainIndices.map((i) => X_data[i]!);
    const y_train = trainIndices.map((i) => y_data[i]!);
    const X_test = testIndices.map((i) => X_data[i]!);
    const y_test = testIndices.map((i) => y_data[i]!);

    const { standardized: Xs, means, stds } = standardize(X_train);
    const yMean = y_train.reduce((a, b) => a + b, 0) / y_train.length;
    const ys = y_train.map((v) => v - yMean);

    const coefs = fitRidge(Xs, ys, alpha);

    const X_test_s = X_test.map((row) =>
      row.map((val, j) => (val - means[j]!) / stds[j]!),
    );
    const y_pred = predictRidge(X_test_s, coefs).map((v) => v + yMean);
    const rmse = rootMeanSquaredError(y_test, y_pred);
    rmses.push(rmse);
  }

  const meanRmse = rmses.reduce((a, b) => a + b, 0) / rmses.length;
  const stdRmse = Math.sqrt(
    rmses.reduce((sum, v) => sum + (v - meanRmse) * (v - meanRmse), 0) /
      rmses.length,
  );

  return { meanRmse, stdRmse };
}

function trainDifficulty(
  samples: CalibrationSample[],
  alpha: number,
): {
  coefficients: number[];
  featureNames: string[];
} {
  const X_data = samples.map((s) => s.featureVector);
  const y_data = samples.map((s) => s.actualDelta);

  const { standardized: Xs, means, stds } = standardize(X_data);
  const yMean = y_data.reduce((a, b) => a + b, 0) / y_data.length;
  const ys = y_data.map((v) => v - yMean);

  const standardizedCoefs = fitRidge(Xs, ys, alpha);

  const unstandardizedCoefs = standardizedCoefs.map(
    (c, j) => (c / (stds[j] ?? 1)),
  );

  return {
    coefficients: unstandardizedCoefs,
    featureNames: samples[0]?.featureNames ?? [],
  };
}

function main(): number {
  const dataDir = path.resolve(import.meta.dirname, "..", "data", "calibration");
  const trainingPath = path.join(dataDir, "training.json");
  const holdoutPath = path.join(dataDir, "holdout.json");

  if (!fs.existsSync(trainingPath) || !fs.existsSync(holdoutPath)) {
    console.error("Training/holdout data not found. Run generateCalibrationDataset.ts first.");
    return 1;
  }

  const trainingRaw = JSON.parse(fs.readFileSync(trainingPath, "utf-8"));
  const holdoutRaw = JSON.parse(fs.readFileSync(holdoutPath, "utf-8"));

  const trainingSamples: CalibrationSample[] = trainingRaw.samples;
  const holdoutSamples: CalibrationSample[] = holdoutRaw.samples;

  const featureNames: string[] = trainingRaw.featureNames;

  console.log(`Training samples: ${trainingSamples.length}`);
  console.log(`Holdout samples:  ${holdoutSamples.length}`);
  console.log(`Features:         ${featureNames.length}`);
  console.log(`Feature names:    ${featureNames.join(", ")}`);

  const perDifficultyCoefs: Record<string, Record<string, number>> = {};
  const datasetSize: Record<string, number> = {};

  for (const difficulty of DIFFICULTIES) {
    const subset = trainingSamples.filter((s) => s.difficulty === difficulty);
    if (subset.length === 0) {
      console.log(`\nSkipping ${difficulty} — no training data.`);
      continue;
    }
    datasetSize[difficulty] = subset.length;

    console.log(`\n--- ${difficulty} (${subset.length} samples) ---`);

    let bestAlpha = ALPHA_CANDIDATES[0]!;
    let bestRmse = Infinity;

    for (const alpha of ALPHA_CANDIDATES) {
      const cv = crossValidateRidge(
        subset.map((s) => s.featureVector),
        subset.map((s) => s.actualDelta),
        alpha,
        CV_FOLDS,
      );
      const sigFigs = cv.meanRmse < 1 ? 6 : cv.meanRmse < 100 ? 4 : 2;
      console.log(`  alpha=${alpha.toString().padEnd(6)} CV RMSE=${cv.meanRmse.toFixed(sigFigs)} ±${cv.stdRmse.toFixed(sigFigs)}`);
      if (cv.meanRmse < bestRmse) {
        bestRmse = cv.meanRmse;
        bestAlpha = alpha;
      }
    }

    console.log(`  → Best alpha: ${bestAlpha}`);

    const result = trainDifficulty(subset, bestAlpha);
    const coefs: Record<string, number> = {};
    result.coefficients.forEach((c, i) => {
      const name = featureNames[i] ?? `feature_${i}`;
      coefs[name] = Math.round(c * 10000) / 10000;
    });
    perDifficultyCoefs[difficulty] = coefs;

    console.log("  Coefficients:");
    for (const [name, val] of Object.entries(coefs)) {
      console.log(`    ${name}: ${val}`);
    }
  }

  const holdoutMetrics: Record<string, ValidationMetrics> = {};

  for (const difficulty of DIFFICULTIES) {
    const subset = holdoutSamples.filter((s) => s.difficulty === difficulty);
    if (subset.length === 0 || !perDifficultyCoefs[difficulty]) continue;

    const coefs = perDifficultyCoefs[difficulty]!;
    const predictedDeltas = subset.map((s) =>
      s.featureVector.reduce(
        (sum, val, j) => sum + val * (coefs[featureNames[j]!] ?? 0),
        0,
      ),
    );
    const actualDeltas = subset.map((s) => s.actualDelta);
    const currentScores = subset.map((s) => s.currentScore);
    const afterScores = subset.map((s) => s.afterScore);

    const metrics = computeValidationMetrics(
      actualDeltas,
      predictedDeltas,
      currentScores,
      afterScores,
    );

    const coefMagnitudes: Record<string, number> = {};
    const totalMag = Object.values(coefs).reduce((sum, v) => sum + Math.abs(v), 0);
    for (const [name, val] of Object.entries(coefs)) {
      coefMagnitudes[name] = totalMag > 0 ? Math.abs(val) / totalMag : 0;
    }
    metrics.featureImportance = coefMagnitudes;

    holdoutMetrics[difficulty] = metrics;

    console.log(`\nValidation (${difficulty}, n=${metrics.sampleCount}):`);
    console.log(`  Pearson r:        ${metrics.pearsonR.toFixed(4)}`);
    console.log(`  Spearman ρ:       ${metrics.spearmanRho.toFixed(4)}`);
    console.log(`  RMSE:             ${metrics.rmse.toFixed(4)}`);
    console.log(`  Difficulty match: ${(metrics.difficultyMatchRate * 100).toFixed(1)}%`);
    console.log(`  Top-3 accuracy:   ${(metrics.topKAccuracy * 100).toFixed(1)}%`);
    console.log(`  Feature importance:`);
    for (const [name, imp] of Object.entries(coefMagnitudes).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${name}: ${(imp * 100).toFixed(1)}%`);
    }
  }

  // ── Acceptance gates ─────────────────────────────────────────────────
  const GATES = {
    pearsonR: { threshold: 0.65, label: "Pearson r ≥ 0.65" },
    spearmanRho: { threshold: 0.55, label: "Spearman ρ ≥ 0.55" },
    rmseVsStdRatio: { threshold: 0.6, label: "RMSE ≤ 0.6 × σ(y)" },
    difficultyMatchRate: { threshold: 0.65, label: "Difficulty match rate ≥ 65%" },
  };

  let allPassed = true;
  const results: string[] = [];

  for (const difficulty of DIFFICULTIES) {
    const metrics = holdoutMetrics[difficulty];
    if (!metrics) continue;

    const actualDeltas = holdoutSamples
      .filter((s) => s.difficulty === difficulty)
      .map((s) => s.actualDelta);
    const yStd = Math.sqrt(
      actualDeltas.reduce((sum, v) => sum + (v - actualDeltas.reduce((a, b) => a + b, 0) / actualDeltas.length) ** 2, 0) /
        actualDeltas.length,
    );

    results.push(`\n--- ${difficulty} gates ---`);
    const gates = [
      { name: "pearsonR", passed: metrics.pearsonR >= GATES.pearsonR.threshold, detail: `${metrics.pearsonR.toFixed(4)} ≥ ${GATES.pearsonR.threshold}` },
      { name: "spearmanRho", passed: metrics.spearmanRho >= GATES.spearmanRho.threshold, detail: `${metrics.spearmanRho.toFixed(4)} ≥ ${GATES.spearmanRho.threshold}` },
      { name: "rmse", passed: metrics.rmse <= GATES.rmseVsStdRatio.threshold * yStd, detail: `${metrics.rmse.toFixed(4)} ≤ ${(GATES.rmseVsStdRatio.threshold * yStd).toFixed(4)} (0.6 × ${yStd.toFixed(2)})` },
      { name: "difficultyMatchRate", passed: metrics.difficultyMatchRate >= GATES.difficultyMatchRate.threshold, detail: `${(metrics.difficultyMatchRate * 100).toFixed(1)}% ≥ 65%` },
    ];

    for (const gate of gates) {
      const icon = gate.passed ? "PASS" : "FAIL";
      results.push(`  [${icon}] ${gate.name}: ${gate.detail}`);
      if (!gate.passed) allPassed = false;
    }

    const coefs = perDifficultyCoefs[difficulty]!;
    if (coefs["NAKED_SINGLE_CREATED"] !== undefined && coefs["NAKED_SINGLE_CREATED"] < 0) {
      results.push(`  [FAIL] NAKED_SINGLE_CREATED sign: expected non-negative, got ${coefs["NAKED_SINGLE_CREATED"]}`);
      allPassed = false;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("ACCEPTANCE GATES");
  console.log(`${"=".repeat(60)}`);
  for (const line of results) {
    console.log(line);
  }
  console.log(`\nOverall: ${allPassed ? "ALL GATES PASSED" : "SOME GATES FAILED — weights NOT updated"}`);

  // ── Write output ──────────────────────────────────────────────────────
  const output: CalibratedOutput = {
    version: 1,
    timestamp: new Date().toISOString(),
    seed: trainingRaw.seed ?? 0,
    datasetSize,
    holdoutMetrics: allPassed ? holdoutMetrics : null,
    coefficients: allPassed ? perDifficultyCoefs : {},
  };

  const configDir = path.resolve(import.meta.dirname, "..", "src", "server", "config");
  fs.mkdirSync(configDir, { recursive: true });
  const outputPath = path.join(configDir, "calibrated-weights.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\nWrote: ${outputPath}`);

  return allPassed ? 0 : 1;
}

process.exit(main());
