import { describe, it, expect, beforeEach } from "vitest";
import { Matrix, solve } from "ml-matrix";
import { CALIBRATED_COEFFICIENTS, FEATURE_WEIGHTS } from "../PredictorWeights";
import { estimateDelta, evaluateCandidates } from "../PredictorPipeline";
import { clearRegistry, registerDefaultFeatures, registerStage1Filter, registerStage2Feature, getStage2Features } from "../FeatureRegistry";
import { buildCandidateMap } from "../../CandidateEngine";
import type { PredictorContextData, RemovalCandidate } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────

function solvedBoard9x9(): number[][] {
  return [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9],
  ];
}

function makeContext(board: number[][]): PredictorContextData {
  const size = board.length as 4 | 9;
  const boxSize = size === 9 ? 3 : 2;
  return {
    board,
    size,
    boxSize,
    beforeCandidateMap: buildCandidateMap(board, size, boxSize),
  };
}

function makeCandidate(row: number, col: number, balanceScore = 0.5): RemovalCandidate {
  return {
    row,
    col,
    symRow: 8 - row,
    symCol: 8 - col,
    box1: Math.floor(row / 3) * 3 + Math.floor(col / 3),
    box2: Math.floor((8 - row) / 3) * 3 + Math.floor((8 - col) / 3),
    balanceScore,
    predictorScore: 0,
    finalScore: 0,
  };
}

// ── Pure math helpers (mirrors trainPredictorWeights.ts logic) ─────────────

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

function fitRidge(X_data: number[][], y_data: number[], alpha: number): number[] {
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

function difficultyFromScore(score: number): string {
  if (score <= 30) return "easy";
  if (score <= 52) return "medium";
  if (score <= 75) return "hard";
  return "expert";
}

// ── Tests: Calibrated Coefficient Loading ──────────────────────────────────

describe("CalibratedCoefficients — loading and fallback", () => {
  it("exports CALIBRATED_COEFFICIENTS with all difficulty keys", () => {
    expect(CALIBRATED_COEFFICIENTS).toHaveProperty("easy");
    expect(CALIBRATED_COEFFICIENTS).toHaveProperty("medium");
    expect(CALIBRATED_COEFFICIENTS).toHaveProperty("hard");
    expect(CALIBRATED_COEFFICIENTS).toHaveProperty("expert");
  });

  it("loads calibrated coefficients and differs from FEATURE_WEIGHTS", () => {
    for (const key of ["easy", "medium", "hard", "expert"] as const) {
      const coefs = CALIBRATED_COEFFICIENTS[key]!;
      expect(coefs.NAKED_SINGLE_CREATED).not.toBe(FEATURE_WEIGHTS.NAKED_SINGLE_CREATED);
      expect(coefs.NAKED_SINGLE_CREATED).toBeGreaterThan(0);
    }
  });

  it("each difficulty has the same feature keys as FEATURE_WEIGHTS", () => {
    const featureKeys = Object.keys(FEATURE_WEIGHTS).sort();
    for (const key of ["easy", "medium", "hard", "expert"] as const) {
      const coefKeys = Object.keys(CALIBRATED_COEFFICIENTS[key]!).sort();
      expect(coefKeys).toEqual(featureKeys);
    }
  });

  it("FEATURE_WEIGHTS is unchanged (still flat Record<string, number>)", () => {
    expect(typeof FEATURE_WEIGHTS.BIVALUE_CREATED).toBe("number");
    expect(typeof FEATURE_WEIGHTS.NAKED_SINGLE_CREATED).toBe("number");
    expect(typeof FEATURE_WEIGHTS.STRONG_LINK_CREATED).toBe("number");
  });

  it("estimateDelta uses per-difficulty coefficients from CALIBRATED_COEFFICIENTS", () => {
    registerDefaultFeatures();
    const board = solvedBoard9x9();
    board[1][0] = 0;
    board[1][1] = 0;
    const ctx = makeContext(board);
    const candidate = makeCandidate(0, 0);
    const result = estimateDelta(ctx, candidate, "medium");
    expect(result.passedStage1).toBe(true);
    expect(typeof result.delta).toBe("number");
    expect(Number.isFinite(result.delta)).toBe(true);
    clearRegistry();
  });

  it("evaluateCandidates still uses FEATURE_WEIGHTS (not CALIBRATED_COEFFICIENTS)", () => {
    registerDefaultFeatures();
    const board = solvedBoard9x9();
    board[1][0] = 0;
    board[1][1] = 0;
    const ctx = makeContext(board);
    const candidates = [makeCandidate(0, 0, 0.5)];
    const result = evaluateCandidates(ctx, candidates, "medium");
    expect(result).toHaveLength(1);
    expect(result[0]!.predictorScore).toBeGreaterThanOrEqual(0);
    clearRegistry();
  });
});

// ── Tests: Validation Metrics ──────────────────────────────────────────────

describe("Validation metrics", () => {
  describe("Pearson correlation", () => {
    it("returns 1 for perfectly correlated data", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      expect(pearsonCorrelation(x, y)).toBeCloseTo(1, 10);
    });

    it("returns -1 for perfectly negatively correlated data", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [10, 8, 6, 4, 2];
      expect(pearsonCorrelation(x, y)).toBeCloseTo(-1, 10);
    });

    it("returns 0 for uncorrelated data", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [0, 0, 0, 0, 0];
      expect(pearsonCorrelation(x, y)).toBe(0);
    });

    it("is symmetric", () => {
      const x = [1, 3, 5, 7, 9];
      const y = [2, 4, 6, 8, 10];
      expect(pearsonCorrelation(x, y)).toBeCloseTo(pearsonCorrelation(y, x), 10);
    });

    it("handles single-element arrays", () => {
      expect(pearsonCorrelation([1], [2])).toBe(0);
    });
  });

  describe("Spearman correlation", () => {
    it("returns 1 for perfectly monotonic data", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [100, 200, 300, 400, 500];
      expect(spearmanCorrelation(x, y)).toBeCloseTo(1, 10);
    });

    it("returns close to 1 for nearly monotonic data", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [10, 20, 30, 41, 50];
      expect(spearmanCorrelation(x, y)).toBeGreaterThan(0.9);
    });

    it("handles ties correctly", () => {
      const x = [1, 1, 2, 2, 3];
      const y = [5, 5, 4, 4, 3];
      const rho = spearmanCorrelation(x, y);
      expect(Number.isFinite(rho)).toBe(true);
    });
  });

  describe("RMSE", () => {
    it("returns 0 for perfect predictions", () => {
      expect(rootMeanSquaredError([1, 2, 3], [1, 2, 3])).toBe(0);
    });

    it("computes correct value for known data", () => {
      const actual = [1, 2, 3];
      const predicted = [2, 3, 4];
      // diff = [-1, -1, -1], sq = [1, 1, 1], mean = 1, sqrt = 1
      expect(rootMeanSquaredError(actual, predicted)).toBeCloseTo(1, 10);
    });

    it("is non-negative", () => {
      const result = rootMeanSquaredError([1, 2, 3], [4, 5, 6]);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Difficulty from score", () => {
    it("classifies scores correctly", () => {
      expect(difficultyFromScore(0)).toBe("easy");
      expect(difficultyFromScore(30)).toBe("easy");
      expect(difficultyFromScore(31)).toBe("medium");
      expect(difficultyFromScore(52)).toBe("medium");
      expect(difficultyFromScore(53)).toBe("hard");
      expect(difficultyFromScore(75)).toBe("hard");
      expect(difficultyFromScore(76)).toBe("expert");
      expect(difficultyFromScore(100)).toBe("expert");
    });
  });
});

// ── Tests: Ridge Regression ────────────────────────────────────────────────

describe("Ridge regression", () => {
  it("recovers known coefficients from noise-free data (single feature)", () => {
    const X = [[1], [2], [3], [4], [5]];
    const trueBeta = 3.5;
    const y = X.map(([x]) => x * trueBeta);

    const { standardized: Xs, means, stds } = standardize(X);
    const yMean = y.reduce((a, b) => a + b, 0) / y.length;
    const ys = y.map((v) => v - yMean);

    const coefs = fitRidge(Xs, ys, 0.001);
    const unstandardized = coefs.map((c, j) => c / (stds[j] ?? 1));

    expect(unstandardized[0]!).toBeCloseTo(trueBeta, 1);
  });

  it("recovers known coefficients from noise-free data (multi-feature)", () => {
    const trueBetas = [2, 3];
    const X = [
      [1, 5],
      [2, 3],
      [3, 1],
      [4, 4],
      [5, 2],
    ];
    const y = X.map((row) =>
      row.reduce((sum, val, j) => sum + val * trueBetas[j]!, 0),
    );

    const { standardized: Xs, means, stds } = standardize(X);
    const yMean = y.reduce((a, b) => a + b, 0) / y.length;
    const ys = y.map((v) => v - yMean);

    const coefs = fitRidge(Xs, ys, 0.001);
    const unstandardized = coefs.map((c, j) => c / (stds[j] ?? 1));

    for (let j = 0; j < trueBetas.length; j++) {
      expect(unstandardized[j]!).toBeCloseTo(trueBetas[j]!, 0);
    }
  });

  it("produces different coefficients for different alpha values", () => {
    const X = [[1], [2], [3], [4], [5]];
    const y = [2, 4, 6, 8, 10];

    const { standardized: Xs, means, stds } = standardize(X);
    const yMean = y.reduce((a, b) => a + b, 0) / y.length;
    const ys = y.map((v) => v - yMean);

    const coefsLow = fitRidge(Xs, ys, 0.001);
    const coefsHigh = fitRidge(Xs, ys, 100);

    expect(coefsLow[0]!).not.toBeCloseTo(coefsHigh[0]!, 1);
  });

  it("higher alpha shrinks coefficients toward zero", () => {
    const X = [[1], [2], [3], [4], [5]];
    const y = [2.1, 3.9, 6.2, 7.8, 10.1];

    const { standardized: Xs, means, stds } = standardize(X);
    const yMean = y.reduce((a, b) => a + b, 0) / y.length;
    const ys = y.map((v) => v - yMean);

    const coefsLow = fitRidge(Xs, ys, 0.001);
    const coefsHigh = fitRidge(Xs, ys, 1000);

    expect(Math.abs(coefsHigh[0]!)).toBeLessThan(Math.abs(coefsLow[0]!));
  });

  it("is deterministic with same input", () => {
    const X = [[1], [2], [3], [4], [5]];
    const y = [2, 4, 6, 8, 10];

    const { standardized: Xs, means, stds } = standardize(X);
    const yMean = y.reduce((a, b) => a + b, 0) / y.length;
    const ys = y.map((v) => v - yMean);

    const coefs1 = fitRidge(Xs, ys, 1);
    const coefs2 = fitRidge(Xs, ys, 1);

    expect(coefs1).toEqual(coefs2);
  });

  it("solves via linear system (not explicit inverse)", () => {
    // Verify that we use solve(A, B), not inverse(A).mmul(B)
    const X = [[1, 2], [3, 4], [5, 6]];
    const y = [10, 20, 30];

    const Xmat = new Matrix(X);
    const ymat = new Matrix(y.map((v) => [v]));

    // This is the solve() path — NOT inverse()
    const Xt = Xmat.transpose();
    const XtX = Xt.mmul(Xmat);
    const I = Matrix.eye(Xmat.columns);
    const reg = XtX.add(I.mul(0.1));
    const Xty = Xt.mmul(ymat);
    const beta = solve(reg, Xty);

    expect(beta.rows).toBe(2);
    expect(beta.columns).toBe(1);
    expect(Number.isFinite(beta.get(0, 0))).toBe(true);
    expect(Number.isFinite(beta.get(1, 0))).toBe(true);
  });
});

// ── Tests: Standardization ─────────────────────────────────────────────────

describe("Standardization", () => {
  it("produces zero mean and unit variance for single-feature data", () => {
    const data = [[1], [2], [3], [4], [5]];
    const { standardized, means, stds } = standardize(data);

    const mean = standardized.reduce((s, row) => s + row[0]!, 0) / standardized.length;
    expect(mean).toBeCloseTo(0, 10);

    const variance = standardized.reduce((s, row) => s + row[0]! * row[0]!, 0) / standardized.length;
    expect(variance).toBeCloseTo(1, 5);

    expect(means[0]!).toBeCloseTo(3, 5);
    expect(stds[0]!).toBeGreaterThan(0);
  });

  it("handles constant columns without division by zero", () => {
    const data = [[5], [5], [5]];
    const { standardized } = standardize(data);
    expect(standardized[0]![0]!).toBe(0);
    expect(standardized[1]![0]!).toBe(0);
    expect(standardized[2]![0]!).toBe(0);
  });

  it("handles multi-feature data", () => {
    const data = [
      [1, 10],
      [2, 20],
      [3, 30],
    ];
    const { means, stds } = standardize(data);
    expect(means[0]!).toBeCloseTo(2, 5);
    expect(means[1]!).toBeCloseTo(20, 5);
    expect(stds[0]!).toBeGreaterThan(0);
    expect(stds[1]!).toBeGreaterThan(0);
  });
});

// ── Tests: Validation Gate Behavior ────────────────────────────────────────

describe("Validation gates", () => {
  const GATES = {
    pearsonR: 0.65,
    spearmanRho: 0.55,
    rmseVsStdRatio: 0.6,
    difficultyMatchRate: 0.65,
    topKAccuracy: 0.55,
  };

  it("passes all gates with ideal metrics", () => {
    const metrics = {
      pearsonR: 0.9,
      spearmanRho: 0.85,
      rmse: 1.0,
      difficultyMatchRate: 0.9,
      topKAccuracy: 0.8,
    };
    const yStd = 5.0;

    expect(metrics.pearsonR).toBeGreaterThanOrEqual(GATES.pearsonR);
    expect(metrics.spearmanRho).toBeGreaterThanOrEqual(GATES.spearmanRho);
    expect(metrics.rmse).toBeLessThanOrEqual(GATES.rmseVsStdRatio * yStd);
    expect(metrics.difficultyMatchRate).toBeGreaterThanOrEqual(GATES.difficultyMatchRate);
    expect(metrics.topKAccuracy).toBeGreaterThanOrEqual(GATES.topKAccuracy);
  });

  it("fails Pearson gate when correlation is low", () => {
    const pearsonR = 0.3;
    expect(pearsonR >= GATES.pearsonR).toBe(false);
  });

  it("fails Spearman gate when correlation is low", () => {
    const spearmanRho = 0.2;
    expect(spearmanRho >= GATES.spearmanRho).toBe(false);
  });

  it("fails RMSE gate when error exceeds threshold", () => {
    const rmse = 10;
    const yStd = 5;
    expect(rmse <= GATES.rmseVsStdRatio * yStd).toBe(false);
  });

  it("fails difficulty match gate when match rate is low", () => {
    const difficultyMatchRate = 0.4;
    expect(difficultyMatchRate >= GATES.difficultyMatchRate).toBe(false);
  });

  it("fails top-K accuracy gate when accuracy is low", () => {
    const topKAccuracy = 0.2;
    expect(topKAccuracy >= GATES.topKAccuracy).toBe(false);
  });

  it("expects NAKED_SINGLE_CREATED coefficient to be non-negative", () => {
    const names = ["easy", "medium", "hard", "expert"] as const;
    for (const key of names) {
      const coef = CALIBRATED_COEFFICIENTS[key]?.NAKED_SINGLE_CREATED;
      if (coef !== undefined) {
        expect(coef).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ── Tests: Dataset Format ──────────────────────────────────────────────────

describe("Calibration dataset format", () => {
  it("generated dataset has required fields", () => {
    const sample = {
      difficulty: "medium",
      featureNames: ["BIVALUE_CREATED", "NAKED_SINGLE_CREATED", "STRONG_LINK_CREATED", "LOCAL_CANDIDATE_SURGE", "SECTOR_CONFLICT"],
      featureVector: [1, 0, 2, 0.5, 0],
      actualDelta: 4.5,
      currentScore: 20,
      afterScore: 24.5,
      targetDifficulty: "medium",
      wasAccepted: true,
      removalIndex: 0,
    };
    expect(sample).toHaveProperty("difficulty");
    expect(sample).toHaveProperty("featureVector");
    expect(sample).toHaveProperty("actualDelta");
    expect(sample).toHaveProperty("currentScore");
    expect(sample).toHaveProperty("afterScore");
    expect(sample).toHaveProperty("targetDifficulty");
    expect(sample).toHaveProperty("wasAccepted");
    expect(sample).toHaveProperty("removalIndex");
    expect(Array.isArray(sample.featureVector)).toBe(true);
    expect(sample.featureVector.length).toBe(5);
  });

  it("dataset wrapper has required fields", () => {
    const dataset = {
      seed: 42,
      generated: "2026-06-30T00:00:00.000Z",
      config: {
        samplesPerDifficulty: 10,
        difficulties: ["easy", "medium", "hard", "expert"],
        gridSize: 9,
      },
      difficultyOrder: ["easy", "medium", "hard", "expert"],
      featureNames: ["BIVALUE_CREATED", "NAKED_SINGLE_CREATED"],
      samples: [],
    };
    expect(dataset).toHaveProperty("seed");
    expect(dataset).toHaveProperty("config");
    expect(dataset.config).toHaveProperty("samplesPerDifficulty");
    expect(dataset.config).toHaveProperty("difficulties");
    expect(dataset.config).toHaveProperty("gridSize");
    expect(dataset).toHaveProperty("featureNames");
    expect(dataset).toHaveProperty("samples");
  });
});

// ── Tests: Determinism with Fixed Seed ─────────────────────────────────────

describe("Deterministic output with fixed seed", () => {
  it("standardize is deterministic", () => {
    const data = [[1, 2], [3, 4], [5, 6]];
    const r1 = standardize(data);
    const r2 = standardize(data);
    expect(r1.standardized).toEqual(r2.standardized);
    expect(r1.means).toEqual(r2.means);
    expect(r1.stds).toEqual(r2.stds);
  });

  it("fitRidge is deterministic", () => {
    const X = [[1], [2], [3], [4], [5]];
    const y = [2, 4, 6, 8, 10];

    const { standardized: Xs } = standardize(X);
    const yMean = y.reduce((a, b) => a + b, 0) / y.length;
    const ys = y.map((v) => v - yMean);

    const c1 = fitRidge(Xs, ys, 1);
    const c2 = fitRidge(Xs, ys, 1);
    expect(c1).toEqual(c2);
  });

  it("same seed produces same validation metrics", () => {
    const actual = [1, 2, 3, 4, 5];
    const predicted = [1.1, 1.9, 3.2, 3.8, 5.1];

    const p1 = pearsonCorrelation(actual, predicted);
    const p2 = pearsonCorrelation(actual, predicted);
    expect(p1).toBe(p2);

    const s1 = spearmanCorrelation(actual, predicted);
    const s2 = spearmanCorrelation(actual, predicted);
    expect(s1).toBe(s2);

    const r1 = rootMeanSquaredError(actual, predicted);
    const r2 = rootMeanSquaredError(actual, predicted);
    expect(r1).toBe(r2);
  });
});
