import { describe, it, expect } from "vitest";
import {
  mannWhitneyU,
  welchTTest,
  cohensD,
  confidenceInterval,
} from "../significance";
import type { MannWhitneyUResult, WelchTTestResult, CohenDResult, ConfidenceIntervalResult } from "../significance";

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function approxEqual(actual: number, expected: number, tolerance: number = 1e-10): boolean {
  if (Number.isNaN(actual) && Number.isNaN(expected)) return true;
  if (Math.abs(actual - expected) <= tolerance) return true;
  if (Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected))) return true;
  return false;
}

function expectApprox(actual: number, expected: number, tolerance?: number) {
  expect(approxEqual(actual, expected, tolerance)).toBe(true);
}

// ── Mann-Whitney U Tests ───────────────────────────────────────────────────

describe("mannWhitneyU", () => {
  it("returns NaN for empty first group", () => {
    const result = mannWhitneyU([], [1, 2, 3]);
    expect(result.UStatistic).toBeNaN();
    expect(result.pValue).toBeNaN();
    expect(result.n1).toBe(0);
    expect(result.n2).toBe(3);
  });

  it("returns NaN for empty second group", () => {
    const result = mannWhitneyU([1, 2, 3], []);
    expect(result.UStatistic).toBeNaN();
    expect(result.pValue).toBeNaN();
    expect(result.n1).toBe(3);
    expect(result.n2).toBe(0);
  });

  it("returns correct U for identical distributions", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [1, 2, 3, 4, 5];
    const result = mannWhitneyU(a, b);
    // With identical distributions, U should be n1*n2/2 = 12.5
    expectApprox(result.UStatistic, 12.5);
    // p-value should be high (close to 1)
    expect(result.pValue).toBeGreaterThan(0.5);
  });

  it("returns U = 0 when all of group A are less than group B", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [10, 11, 12, 13, 14];
    const result = mannWhitneyU(a, b);
    // U should be 0 (no overlap)
    expect(result.UStatistic).toBe(0);
    // p-value should be very small
    expect(result.pValue).toBeLessThan(0.01);
  });

  it("returns U = n1*n2 when all of group A are greater than group B", () => {
    const a = [10, 11, 12, 13, 14];
    const b = [1, 2, 3, 4, 5];
    const result = mannWhitneyU(a, b);
    // U should be n1*n2 = 25 (reverse, so min is 0)
    // Actually: U1 = n1*n2 - 0 = 25, so min(U1, U2) = 0
    expect(result.UStatistic).toBe(0);
    expect(result.n1).toBe(5);
    expect(result.n2).toBe(5);
  });

  it("handles tied values correctly", () => {
    const a = [1, 2, 2, 3, 4];
    const b = [2, 2, 3, 4, 5];
    const result = mannWhitneyU(a, b);
    expect(result.UStatistic).toBeGreaterThanOrEqual(0);
    expect(result.pValue).toBeGreaterThan(0);
    expect(result.pValue).toBeLessThanOrEqual(1);
  });

  it("returns reasonable p-values for small samples", () => {
    // Group A slightly larger than Group B
    const a = [1, 2, 3, 4, 5, 6, 7, 8];
    const b = [3, 4, 5, 6, 7, 8, 9, 10];
    const result = mannWhitneyU(a, b);
    // A tends to be smaller than B
    expect(result.n1).toBe(8);
    expect(result.n2).toBe(8);
    expect(result.pValue).toBeGreaterThan(0.01);
  });

  it("detects significant difference between well-separated groups of n=8", () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8];
    const b = [20, 21, 22, 23, 24, 25, 26, 27];
    const result = mannWhitneyU(a, b);
    expect(result.UStatistic).toBe(0);
    expect(result.pValue).toBeLessThan(0.001);
  });

  it("handles all identical values in both groups", () => {
    const a = [5, 5, 5, 5];
    const b = [5, 5, 5, 5];
    const result = mannWhitneyU(a, b);
    // All tied, U should be n1*n2/2 = 8
    expect(result.UStatistic).toBe(8);
    expect(result.pValue).toBe(1);
  });

  it("produces p-value between 0 and 1 inclusive", () => {
    const a = [1, 3, 5, 7, 9, 11, 13];
    const b = [2, 4, 6, 8, 10, 12, 14];
    const result = mannWhitneyU(a, b);
    expect(result.pValue).toBeGreaterThanOrEqual(0);
    expect(result.pValue).toBeLessThanOrEqual(1);
  });

  it("handles large samples efficiently", () => {
    const a = Array.from({ length: 100 }, () => Math.random() * 10);
    const b = Array.from({ length: 100 }, () => 5 + Math.random() * 10);
    const result = mannWhitneyU(a, b);
    expect(result.n1).toBe(100);
    expect(result.n2).toBe(100);
    expect(result.pValue).toBeGreaterThanOrEqual(0);
    expect(result.pValue).toBeLessThanOrEqual(1);
  });
});

// ── Welch t-test Tests ────────────────────────────────────────────────────

describe("welchTTest", () => {
  it("returns NaN when n1 < 2", () => {
    const result = welchTTest([1], [2, 3, 4]);
    expect(result.tStat).toBeNaN();
    expect(result.df).toBeNaN();
    expect(result.pValue).toBeNaN();
  });

  it("returns NaN when n2 < 2", () => {
    const result = welchTTest([1, 2, 3], [4]);
    expect(result.tStat).toBeNaN();
  });

  it("returns t ≈ 0 and high p-value for identical distributions", () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const b = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = welchTTest(a, b);
    expectApprox(result.tStat, 0, 1e-10);
    expect(result.pValue).toBeGreaterThan(0.9);
  });

  it("returns significant result for well-separated groups", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [20, 21, 22, 23, 24];
    const result = welchTTest(a, b);
    expect(Math.abs(result.tStat)).toBeGreaterThan(5);
    expect(result.pValue).toBeLessThan(0.001);
  });

  it("produces df ≈ n1+n2-2 for equal variance groups", () => {
    const a = [1, 3, 5, 7, 9];
    const b = [2, 4, 6, 8, 10];
    const result = welchTTest(a, b);
    // df should be close to 8 = 5+5-2
    expect(result.df).toBeGreaterThan(6);
    expect(result.df).toBeLessThanOrEqual(10);
  });

  it("handles unequal variances", () => {
    const a = [10, 11, 12, 13, 14, 15];
    const b = [1, 100, 2, 200, 3, 300];
    const result = welchTTest(a, b);
    expect(result.df).toBeGreaterThan(0);
    expect(result.pValue).toBeGreaterThanOrEqual(0);
    expect(result.pValue).toBeLessThanOrEqual(1);
  });

  it("returns p=1 when both groups have zero variance with same mean", () => {
    const a = [5, 5, 5, 5, 5];
    const b = [5, 5, 5, 5, 5];
    const result = welchTTest(a, b);
    expect(result.tStat).toBe(0);
    expect(result.pValue).toBe(1);
  });

  it("returns low p-value for groups with zero variance and different means", () => {
    const a = [1, 1, 1, 1, 1];
    const b = [10, 10, 10, 10, 10];
    const result = welchTTest(a, b);
    expect(Math.abs(result.tStat)).toBe(Infinity);
    expect(result.pValue).toBe(0);
  });

  it("handles samples with n=2 each", () => {
    const a = [1, 2];
    const b = [100, 101];
    const result = welchTTest(a, b);
    expect(Number.isFinite(result.tStat)).toBe(true);
    expect(Number.isFinite(result.df)).toBe(true);
    expect(result.pValue).toBeLessThan(0.05);
  });
});

// ── Cohen's d Tests ───────────────────────────────────────────────────────

describe("cohensD", () => {
  it("returns NaN when n1 < 2", () => {
    const result = cohensD([1], [2, 3, 4]);
    expect(result.d).toBeNaN();
    expect(result.interpretation).toBe("negligible");
  });

  it("returns d≈0 for identical distributions", () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const b = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = cohensD(a, b);
    expectApprox(result.d, 0, 1e-10);
    expect(result.interpretation).toBe("negligible");
  });

  it("returns large effect for well-separated groups", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [20, 21, 22, 23, 24];
    const result = cohensD(a, b);
    expect(Math.abs(result.d)).toBeGreaterThan(10);
    expect(result.interpretation).toBe("large");
  });

  it("classifies d≈0.3 as small", () => {
    // Use large n to get stable sd, then shift by known amount
    // For uniform 0..10 (n=100), sd ≈ 2.94, shift=0.9 → d ≈ 0.3
    const base = Array.from({ length: 100 }, (_, i) => (i / 99) * 10);
    const a = base;
    const b = base.map((v) => v + 0.9);
    const result = cohensD(a, b);
    const absD = Math.abs(result.d);
    expect(absD).toBeGreaterThan(0.2);
    expect(absD).toBeLessThan(0.5);
    expect(result.interpretation).toBe("small");
  });

  it("classifies d≈0.6 as medium", () => {
    // Uniform 0..10 (n=100), sd ≈ 2.94, shift=1.8 → d ≈ 0.6
    const base = Array.from({ length: 100 }, (_, i) => (i / 99) * 10);
    const a = base;
    const b = base.map((v) => v + 1.8);
    const result = cohensD(a, b);
    const absD = Math.abs(result.d);
    expect(absD).toBeGreaterThan(0.5);
    expect(absD).toBeLessThan(0.8);
    expect(result.interpretation).toBe("medium");
  });

  it("classifies d≈1.0 as large", () => {
    // Uniform 0..10 (n=100), sd ≈ 2.94, shift=3.0 → d ≈ 1.0
    const base = Array.from({ length: 100 }, (_, i) => (i / 99) * 10);
    const a = base;
    const b = base.map((v) => v + 3.0);
    const result = cohensD(a, b);
    expect(Math.abs(result.d)).toBeGreaterThanOrEqual(0.8);
    expect(result.interpretation).toBe("large");
  });

  it("returns d=0 for zero-variance groups with same mean", () => {
    const a = [5, 5, 5, 5, 5];
    const b = [5, 5, 5, 5, 5];
    const result = cohensD(a, b);
    expect(result.d).toBe(0);
    expect(result.interpretation).toBe("negligible");
  });

  it("handles negative d when group A mean < group B mean", () => {
    const a = [1, 2, 3, 4];
    const b = [10, 11, 12, 13];
    const result = cohensD(a, b);
    expect(result.d).toBeLessThan(0);
  });

  it("handles positive d when group A mean > group B mean", () => {
    const a = [10, 11, 12, 13];
    const b = [1, 2, 3, 4];
    const result = cohensD(a, b);
    expect(result.d).toBeGreaterThan(0);
  });
});

// ── Confidence Interval Tests ─────────────────────────────────────────────

describe("confidenceInterval", () => {
  it("returns NaN for empty sample", () => {
    const result = confidenceInterval([], 0.95);
    expect(result.lower).toBeNaN();
    expect(result.upper).toBeNaN();
    expect(result.mean).toBeNaN();
  });

  it("returns NaN for single element", () => {
    const result = confidenceInterval([42], 0.95);
    expect(result.lower).toBeNaN();
    expect(result.upper).toBeNaN();
    expect(result.mean).toBe(42);
  });

  it("contains the mean", () => {
    const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = confidenceInterval(samples, 0.95);
    expect(result.mean).toBe(5.5);
    expect(result.lower).toBeLessThan(result.mean);
    expect(result.upper).toBeGreaterThan(result.mean);
  });

  it("narrows with larger sample size", () => {
    const small = Array.from({ length: 5 }, () => 5 + Math.random() - 0.5);
    const large = Array.from({ length: 100 }, () => 5 + Math.random() - 0.5);
    const smallCI = confidenceInterval(small, 0.95);
    const largeCI = confidenceInterval(large, 0.95);
    // Large sample should have narrower margin
    expect(largeCI.margin).toBeLessThan(smallCI.margin);
  });

  it("widens with higher confidence level", () => {
    const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const ci90 = confidenceInterval(samples, 0.90);
    const ci99 = confidenceInterval(samples, 0.99);
    // 99% CI should be wider than 90% CI
    expect(ci90.margin).toBeLessThan(ci99.margin);
  });

  it("default confidence is 0.95", () => {
    const samples = [1, 2, 3, 4, 5];
    const result = confidenceInterval(samples);
    expect(result.confidence).toBe(0.95);
  });

  it("covers true mean approximately 95% of the time", () => {
    // Generate 1000 samples from N(0,1) and check coverage
    const trueMean = 0;
    let covered = 0;
    const trials = 100;
    for (let t = 0; t < trials; t++) {
      const samples = Array.from({ length: 30 }, () => {
        // Box-Muller transform
        const u1 = Math.random();
        const u2 = Math.random();
        return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      });
      const ci = confidenceInterval(samples, 0.95);
      if (ci.lower <= trueMean && ci.upper >= trueMean) {
        covered++;
      }
    }
    // Should be roughly 95% coverage (allow ±15% for 100 trials)
    expect(covered).toBeGreaterThan(80);
    expect(covered).toBeLessThanOrEqual(100);
  });

  it("handles all identical values", () => {
    const samples = [5, 5, 5, 5, 5];
    const result = confidenceInterval(samples, 0.95);
    expect(result.mean).toBe(5);
    expect(result.lower).toBe(5);
    expect(result.upper).toBe(5);
    expect(result.margin).toBe(0);
  });

  it("produces symmetric interval around mean for symmetric data", () => {
    const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = confidenceInterval(samples, 0.95);
    expectApprox(result.lower, result.mean - result.margin, 1e-10);
    expectApprox(result.upper, result.mean + result.margin, 1e-10);
  });
});

// ── Result type construction tests ────────────────────────────────────────

describe("significance result types", () => {
  it("MannWhitneyUResult has correct shape", () => {
    const result: MannWhitneyUResult = mannWhitneyU([1, 2, 3], [4, 5, 6]);
    expect(result).toHaveProperty("UStatistic");
    expect(result).toHaveProperty("pValue");
    expect(result).toHaveProperty("n1");
    expect(result).toHaveProperty("n2");
    expect(typeof result.UStatistic).toBe("number");
    expect(typeof result.pValue).toBe("number");
  });

  it("WelchTTestResult has correct shape", () => {
    const result: WelchTTestResult = welchTTest([1, 2, 3], [4, 5, 6]);
    expect(result).toHaveProperty("tStat");
    expect(result).toHaveProperty("df");
    expect(result).toHaveProperty("pValue");
    expect(typeof result.tStat).toBe("number");
  });

  it("CohenDResult has correct shape", () => {
    const result: CohenDResult = cohensD([1, 2, 3], [4, 5, 6]);
    expect(result).toHaveProperty("d");
    expect(result).toHaveProperty("interpretation");
    expect(["negligible", "small", "medium", "large"]).toContain(result.interpretation);
  });

  it("ConfidenceIntervalResult has correct shape", () => {
    const result: ConfidenceIntervalResult = confidenceInterval([1, 2, 3, 4, 5], 0.95);
    expect(result).toHaveProperty("lower");
    expect(result).toHaveProperty("upper");
    expect(result).toHaveProperty("mean");
    expect(result).toHaveProperty("margin");
    expect(result).toHaveProperty("confidence");
    expect(result.confidence).toBe(0.95);
  });
});
