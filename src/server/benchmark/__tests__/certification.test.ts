import { describe, it, expect } from "vitest";
import type {
  BenchmarkReport,
  ModeResult,
  AcceptanceCheck,
  AcceptanceResult,
  RegressionResult,
  DeterminismResult,
  CertificationVerdict,
  CertifyOptions,
} from "../result";
import type { AcceptanceGates, BenchmarkConfig } from "../config";
import { certify, computeVerdict, toCIReport } from "../certification";

function emptyStats() {
  return { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] };
}

function makeMetrics(overrides?: Partial<ModeResult>): ModeResult {
  return {
    generationTimeMs: emptyStats(),
    clueRemovalTimeMs: emptyStats(),
    humanSolverTimeMs: emptyStats(),
    uniquenessCheckTimeMs: emptyStats(),
    predictorEvalTimeMs: emptyStats(),
    predictorDeltaTimeMs: emptyStats(),
    predictorBudgetTimeMs: emptyStats(),
    analysisTimeMs: emptyStats(),
    localSearchTimeMs: emptyStats(),
    candidateEvalTimeMs: emptyStats(),
    retries: emptyStats(),
    humanSolverCalls: emptyStats(),
    predictorEvaluations: emptyStats(),
    difficultyMatchRate: 1,
    scoreDistribution: emptyStats(),
    clueCount: emptyStats(),
    successRate: 1,
    sampleCount: 20,
    ...overrides,
  };
}

function makeReport(
  gates: AcceptanceGates | null,
  overrides?: Partial<ModeResult>,
): BenchmarkReport {
  return {
    config: { acceptanceGates: gates } as BenchmarkConfig,
    timestamp: "2026-07-01T00:00:00Z",
    modes: [
      {
        mode: "baseline",
        difficulties: [
          {
            difficulty: "easy",
            metrics: makeMetrics(overrides),
          },
        ],
      },
    ],
    acceptance: null,
  };
}

const PASSING_GATES: AcceptanceGates = {
  generationTimeMs: { max: { easy: 3000 } },
  difficultyMatchRate: { min: { easy: 0.5 } },
  humanSolverCalls: { max: { easy: 40 } },
  predictorOverheadMs: { max: 200 },
  successRate: { min: 0.9 },
};

// ── computeVerdict ──────────────────────────────────────────────────────────

describe("computeVerdict", () => {
  it("returns PASS when acceptance passes and no regressions", () => {
    const acceptance: AcceptanceResult = {
      passed: true,
      checks: [{ name: "gen", status: "pass", actual: 10, threshold: 100, mode: "b", difficulty: "easy", severity: "blocking" }],
    };
    const verdict = computeVerdict(acceptance, null);
    expect(verdict.status).toBe("PASS");
    expect(verdict.blockingRegressions).toHaveLength(0);
    expect(verdict.advisoryRegressions).toHaveLength(0);
  });

  it("returns PASS when acceptance is null and no regressions", () => {
    const verdict = computeVerdict(null, null);
    expect(verdict.status).toBe("PASS");
  });

  it("returns PASS_WITH_WARNINGS when advisory regressions exist", () => {
    const acceptance: AcceptanceResult = {
      passed: true,
      checks: [{ name: "gen", status: "pass", actual: 10, threshold: 100, mode: "b", difficulty: "easy", severity: "blocking" }],
    };
    const regressions: RegressionResult = {
      blocking: [],
      advisory: [{ mode: "b", difficulty: "easy", metric: "gen", deltaPercent: 15, pValue: 0.04, effectSize: 0.6, severity: "advisory" }],
    };
    const verdict = computeVerdict(acceptance, regressions);
    expect(verdict.status).toBe("PASS_WITH_WARNINGS");
    expect(verdict.advisoryRegressions).toHaveLength(1);
  });

  it("returns PASS_WITH_WARNINGS when advisory gates fail", () => {
    const acceptance: AcceptanceResult = {
      passed: false,
      checks: [{ name: "gen", status: "fail", actual: 5000, threshold: 3000, mode: "b", difficulty: "easy", severity: "advisory" }],
    };
    const verdict = computeVerdict(acceptance, null);
    expect(verdict.status).toBe("PASS_WITH_WARNINGS");
  });

  it("returns FAIL when blocking regression exists", () => {
    const acceptance: AcceptanceResult = {
      passed: true,
      checks: [{ name: "gen", status: "pass", actual: 10, threshold: 100, mode: "b", difficulty: "easy", severity: "blocking" }],
    };
    const regressions: RegressionResult = {
      blocking: [{ mode: "b", difficulty: "easy", metric: "gen", deltaPercent: 50, pValue: 0.001, effectSize: 1.5, severity: "blocking" }],
      advisory: [],
    };
    const verdict = computeVerdict(acceptance, regressions);
    expect(verdict.status).toBe("FAIL");
    expect(verdict.blockingRegressions).toHaveLength(1);
  });

  it("returns FAIL when blocking gate fails", () => {
    const acceptance: AcceptanceResult = {
      passed: false,
      checks: [{ name: "gen", status: "fail", actual: 5000, threshold: 3000, mode: "b", difficulty: "easy", severity: "blocking" }],
    };
    const verdict = computeVerdict(acceptance, null);
    expect(verdict.status).toBe("FAIL");
  });

  it("returns FAIL when determinism check fails", () => {
    const acceptance: AcceptanceResult = {
      passed: true,
      checks: [{ name: "gen", status: "pass", actual: 10, threshold: 100, mode: "b", difficulty: "easy", severity: "blocking" }],
    };
    const determinism: DeterminismResult = {
      overall: 1,
      artifacts: { puzzle: 0, solution: 1, removalSequence: 0, analysis: 0 },
      sampleCount: 10,
    };
    const verdict = computeVerdict(acceptance, null, determinism);
    expect(verdict.status).toBe("FAIL");
  });

  it("determinism overall=0 does not cause FAIL", () => {
    const acceptance: AcceptanceResult = {
      passed: true,
      checks: [],
    };
    const determinism: DeterminismResult = {
      overall: 0,
      artifacts: { puzzle: 0, solution: 0, removalSequence: 0, analysis: 0 },
      sampleCount: 10,
    };
    const verdict = computeVerdict(acceptance, null, determinism);
    expect(verdict.status).toBe("PASS");
  });

  it("advisory regressions + advisory gate failures = PASS_WITH_WARNINGS", () => {
    const acceptance: AcceptanceResult = {
      passed: false,
      checks: [
        { name: "gen", status: "fail", actual: 5000, threshold: 3000, mode: "b", difficulty: "easy", severity: "advisory" },
        { name: "rate", status: "pass", actual: 0.9, threshold: 0.5, mode: "b", difficulty: "easy", severity: "blocking" },
      ],
    };
    const regressions: RegressionResult = {
      blocking: [],
      advisory: [{ mode: "b", difficulty: "easy", metric: "score", deltaPercent: 10, pValue: 0.03, effectSize: 0.5, severity: "advisory" }],
    };
    const verdict = computeVerdict(acceptance, regressions);
    expect(verdict.status).toBe("PASS_WITH_WARNINGS");
  });
});

// ── certify ─────────────────────────────────────────────────────────────────

describe("certify", () => {
  it("returns PASS when all gates pass and no baseline", () => {
    const report = makeReport(PASSING_GATES);
    const result = certify(report);
    expect(result.verdict.status).toBe("PASS");
    expect(result.acceptance!.passed).toBe(true);
    expect(result.comparison).toBeNull();
    expect(result.regressions).toBeNull();
  });

  it("returns FAIL when a blocking gate fails", () => {
    const report = makeReport(PASSING_GATES, { generationTimeMs: { mean: 5000, median: 5000, min: 4000, max: 6000, p90: 5500, p95: 5800, stddev: 500, histogram: [] } });
    const result = certify(report);
    expect(result.verdict.status).toBe("FAIL");
    expect(result.acceptance!.passed).toBe(false);
  });

  it("returns PASS when no acceptance gates configured and no baseline", () => {
    const report = makeReport(null);
    const result = certify(report);
    expect(result.verdict.status).toBe("PASS");
    expect(result.acceptance).toBeNull();
  });

  it("detects blocking regression when baseline is provided", () => {
    const blReport = makeReport(null, {
      generationTimeMs: { mean: 5, median: 5, min: 5, max: 5, p90: 5, p95: 5, stddev: 0, histogram: [] },
      rawSamples: { generationTimeMs: [5, 6, 7, 8, 9] },
    });
    const txReport = makeReport(null, {
      generationTimeMs: { mean: 50, median: 50, min: 50, max: 50, p90: 50, p95: 50, stddev: 0, histogram: [] },
      rawSamples: { generationTimeMs: [50, 51, 52, 53, 54] },
    });

    const options: CertifyOptions = { baseline: blReport };
    const result = certify(txReport, options);
    expect(result.verdict.status).toBe("FAIL");
    expect(result.comparison).not.toBeNull();
    expect(result.regressions!.blocking.length).toBeGreaterThan(0);
  });

  it("passes custom polarity and thresholds to comparison", () => {
    const blReport = makeReport(null, {
      generationTimeMs: { mean: 5, median: 5, min: 5, max: 5, p90: 5, p95: 5, stddev: 0, histogram: [] },
      rawSamples: { myCustomMetric: [5, 6, 7, 8, 9] },
    });
    const txReport = makeReport(null, {
      generationTimeMs: { mean: 50, median: 50, min: 50, max: 50, p90: 50, p95: 50, stddev: 0, histogram: [] },
      rawSamples: { myCustomMetric: [50, 51, 52, 53, 54] },
    });

    const options: CertifyOptions = {
      baseline: blReport,
      polarity: { myCustomMetric: "higher_is_better" },
      thresholds: { blockingEffectSize: 10, blockingPValue: 0.001, advisoryEffectSize: 10, advisoryPValue: 0.001 },
    };
    const result = certify(txReport, options);
    // Custom polarity reverses direction → improvement, not regression
    expect(result.verdict.status).toBe("PASS");
    expect(result.comparison!.comparisons[0]!.polarity).toBe("higher_is_better");
  });

  it("sets profile from options", () => {
    const report = makeReport(null);
    const result = certify(report, { profile: "nightly" });
    expect(result.profile).toBe("nightly");
  });

  it("defaults profile to 'default'", () => {
    const report = makeReport(null);
    const result = certify(report);
    expect(result.profile).toBe("default");
  });

  it("includes determinism result in CertificationReport", () => {
    const report = makeReport(null);
    const determinism: DeterminismResult = {
      overall: 1,
      artifacts: { puzzle: 0, solution: 1, removalSequence: 0, analysis: 0 },
      sampleCount: 5,
    };
    const result = certify(report, { determinism });
    expect(result.determinism!.overall).toBe(1);
    expect(result.verdict.status).toBe("FAIL");
  });
});

// ── toCIReport ──────────────────────────────────────────────────────────────

describe("toCIReport", () => {
  it("produces correct CIReport from PASS certification", () => {
    const report = makeReport(PASSING_GATES);
    const cert = certify(report);
    const ci = toCIReport(cert);

    expect(ci.status).toBe("PASS");
    expect(ci.profile).toBe("default");
    expect(ci.counts.acceptancePassed).toBeGreaterThan(0);
    expect(ci.counts.acceptanceFailed).toBe(0);
    expect(ci.counts.blocking).toBe(0);
    expect(ci.counts.advisory).toBe(0);
    expect(ci.determinism).toBeNull();
  });

  it("produces correct CIReport for FAIL certification", () => {
    const report = makeReport(PASSING_GATES, { generationTimeMs: { mean: 5000, median: 5000, min: 4000, max: 6000, p90: 5500, p95: 5800, stddev: 500, histogram: [] } });
    const cert = certify(report);
    const ci = toCIReport(cert);

    expect(ci.status).toBe("FAIL");
    expect(ci.counts.acceptanceFailed).toBeGreaterThan(0);
  });

  it("preserves version, timestamp, and profile", () => {
    const report = makeReport(null);
    const cert = certify(report, { profile: "ci-run" });
    const ci = toCIReport(cert);

    expect(ci.version).toBe(cert.version);
    expect(ci.timestamp).toBe(cert.timestamp);
    expect(ci.profile).toBe("ci-run");
  });
});
