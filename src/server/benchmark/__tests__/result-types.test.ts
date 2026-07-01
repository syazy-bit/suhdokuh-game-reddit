import { describe, it, expect } from "vitest";
import type {
  MetricStats,
  HistogramBin,
  ModeResult,
  DifficultyReport,
  ModeReport,
  BenchmarkReport,
  AcceptanceResult,
  AcceptanceCheck,
  GateSeverity,
  DeterminismArtifacts,
  DeterminismResult,
  MetricSummary,
  MetricComparison,
  ComparisonReport,
  RegressionItem,
  RegressionResult,
  CertificationVerdict,
  CertificationReport,
  CIReport,
  MemorySnapshot,
  PredictorCallRecord,
  PredictorAccuracyStats,
  DeterminismRecord,
} from "../result";

// ── Type verification (compile-time checks via "satisfies") ─────────────────

describe("result types — backward compatibility", () => {
  it("MetricStats can be constructed with all required fields", () => {
    const stats: MetricStats = {
      mean: 10.5,
      median: 9.0,
      min: 1.0,
      max: 30.0,
      p90: 25.0,
      p95: 28.0,
      stddev: 5.0,
      histogram: [{ lower: 0, upper: 10, count: 5 }],
    };
    expect(stats.mean).toBe(10.5);
    expect(stats.histogram[0].count).toBe(5);
  });

  it("HistogramBin can be constructed", () => {
    const bin: HistogramBin = { lower: 0, upper: 10, count: 5 };
    expect(bin.lower).toBe(0);
    expect(bin.upper).toBe(10);
    expect(bin.count).toBe(5);
  });

  it("ModeResult has all expected fields", () => {
    const emptyStats: MetricStats = {
      mean: 0, median: 0, min: 0, max: 0,
      p90: 0, p95: 0, stddev: 0, histogram: [],
    };
    const result: ModeResult = {
      generationTimeMs: emptyStats,
      clueRemovalTimeMs: emptyStats,
      humanSolverTimeMs: emptyStats,
      uniquenessCheckTimeMs: emptyStats,
      predictorEvalTimeMs: emptyStats,
      predictorDeltaTimeMs: emptyStats,
      predictorBudgetTimeMs: emptyStats,
      analysisTimeMs: emptyStats,
      localSearchTimeMs: emptyStats,
      candidateEvalTimeMs: emptyStats,
      retries: emptyStats,
      humanSolverCalls: emptyStats,
      predictorEvaluations: emptyStats,
      difficultyMatchRate: 1.0,
      scoreDistribution: emptyStats,
      clueCount: emptyStats,
      successRate: 1.0,
      sampleCount: 100,
    };
    expect(result.sampleCount).toBe(100);
    expect(result.successRate).toBe(1.0);
    expect(result.difficultyMatchRate).toBe(1.0);
  });

  it("BenchmarkReport can be constructed with existing fields", () => {
    const report: BenchmarkReport = {
      config: {} as any,
      timestamp: "2026-07-01T00:00:00Z",
      modes: [],
      acceptance: null,
    };
    expect(report.timestamp).toBe("2026-07-01T00:00:00Z");
    expect(report.acceptance).toBeNull();
  });

  it("AcceptanceCheck has the expected shape", () => {
    const check: AcceptanceCheck = {
      name: "generationTimeMs",
      status: "pass",
      actual: 42.5,
      threshold: 100,
      mode: "baseline",
      difficulty: "easy",
      severity: "blocking",
    };
    expect(check.status).toBe("pass");
    expect(check.name).toBe("generationTimeMs");
    expect(check.severity).toBe("blocking");
  });

  it("AcceptanceResult aggregates checks", () => {
    const result: AcceptanceResult = {
      passed: true,
      checks: [],
    };
    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(0);
  });
});

describe("result types — Phase 15.1 additions", () => {
  it("GateSeverity accepts 'blocking' or 'advisory'", () => {
    const blocking: GateSeverity = "blocking";
    const advisory: GateSeverity = "advisory";
    expect(blocking).toBe("blocking");
    expect(advisory).toBe("advisory");
  });

  it("DeterminismArtifacts contains four artifact fields", () => {
    const artifacts: DeterminismArtifacts = {
      puzzle: 1,
      solution: 1,
      removalSequence: 1,
      analysis: 1,
    };
    expect(artifacts.puzzle).toBe(1);
    expect(artifacts.solution).toBe(1);
    expect(artifacts.removalSequence).toBe(1);
    expect(artifacts.analysis).toBe(1);
  });

  it("DeterminismResult aggregates artifacts", () => {
    const result: DeterminismResult = {
      overall: 1,
      artifacts: {
        puzzle: 1,
        solution: 1,
        removalSequence: 1,
        analysis: 1,
      },
      sampleCount: 100,
    };
    expect(result.overall).toBe(1);
    expect(result.sampleCount).toBe(100);
    expect(Object.keys(result.artifacts)).toHaveLength(4);
  });

  it("MetricComparison has all required fields", () => {
    const mkSummary = (b: number, c: number, d: number): MetricSummary => ({ baseline: b, current: c, deltaPercent: d });
    const comp: MetricComparison = {
      mode: "full",
      difficulty: "hard",
      metric: "generationTimeMs",
      polarity: "lower_is_better",
      summary: {
        mean: mkSummary(54.7, 36.1, -34.0),
        median: mkSummary(52.0, 35.0, -32.7),
        p90: mkSummary(80.0, 60.0, -25.0),
        p95: mkSummary(90.0, 70.0, -22.2),
      },
      statistics: {
        mwUStatistic: 1200,
        mwUPValue: 0.001,
        welchTStat: 4.5,
        welchDf: 38.2,
        welchPValue: 0.0001,
        cohensD: 1.21,
        significant: true,
      },
      regression: "blocking",
    };
    expect(comp.summary.mean.deltaPercent).toBe(-34.0);
    expect(comp.statistics.significant).toBe(true);
    expect(comp.regression).toBe("blocking");
  });

  it("MetricComparison allows null Welch fields and null regression", () => {
    const mkSummary = (b: number, c: number, d: number): MetricSummary => ({ baseline: b, current: c, deltaPercent: d });
    const comp: MetricComparison = {
      mode: "baseline",
      difficulty: "easy",
      metric: "retries",
      polarity: "unknown",
      summary: {
        mean: mkSummary(0.1, 0.2, 100),
        median: mkSummary(0.1, 0.2, 100),
        p90: mkSummary(0.5, 0.8, 60),
        p95: mkSummary(0.8, 1.0, 25),
      },
      statistics: {
        mwUStatistic: 50,
        mwUPValue: 0.5,
        welchTStat: null,
        welchDf: null,
        welchPValue: null,
        cohensD: 0.1,
        significant: false,
      },
      regression: null,
    };
    expect(comp.statistics.welchTStat).toBeNull();
    expect(comp.statistics.welchPValue).toBeNull();
    expect(comp.regression).toBeNull();
  });

  it("ComparisonReport contains comparisons array", () => {
    const report: ComparisonReport = {
      baselineTimestamp: "2026-06-15T00:00:00Z",
      currentTimestamp: "2026-07-01T00:00:00Z",
      comparisons: [],
    };
    expect(report.baselineTimestamp).toBe("2026-06-15T00:00:00Z");
    expect(report.comparisons).toHaveLength(0);
  });

  it("RegressionItem has correct shape", () => {
    const item: RegressionItem = {
      mode: "full",
      difficulty: "hard",
      metric: "generationTimeMs",
      deltaPercent: -34.0,
      pValue: 0.001,
      effectSize: 1.21,
      severity: "blocking",
    };
    expect(item.severity).toBe("blocking");
    expect(item.deltaPercent).toBe(-34.0);
  });

  it("RegressionResult separates blocking and advisory", () => {
    const result: RegressionResult = {
      blocking: [],
      advisory: [
        {
          mode: "baseline",
          difficulty: "expert",
          metric: "humanSolverCalls",
          deltaPercent: 18,
          pValue: 0.04,
          effectSize: 0.45,
          severity: "advisory",
        },
      ],
    };
    expect(result.blocking).toHaveLength(0);
    expect(result.advisory).toHaveLength(1);
  });

  it("CertificationVerdict has status and regression arrays", () => {
    const verdict: CertificationVerdict = {
      status: "PASS",
      blockingRegressions: [],
      advisoryRegressions: [],
    };
    expect(verdict.status).toBe("PASS");
    expect(verdict.blockingRegressions).toHaveLength(0);
    expect(verdict.advisoryRegressions).toHaveLength(0);
  });

  it("CertificationReport contains all sub-reports", () => {
    const report: CertificationReport = {
      version: "0.0.29",
      timestamp: "2026-07-01T00:00:00Z",
      profile: "local",
      config: {} as any,
      modes: [],
      acceptance: null,
      determinism: {
        overall: 1,
        artifacts: { puzzle: 1, solution: 1, removalSequence: 1, analysis: 1 },
        sampleCount: 100,
      },
      comparison: null,
      regressions: null,
      verdict: {
        status: "PASS",
        blockingRegressions: [],
        advisoryRegressions: [],
      },
    };
    expect(report.version).toBe("0.0.29");
    expect(report.determinism!.overall).toBe(1);
    expect(report.verdict.status).toBe("PASS");
  });

  it("MemorySnapshot records before/after/delta", () => {
    const snap: MemorySnapshot = {
      heapUsedBeforeMb: 42.5,
      heapUsedAfterMb: 50.3,
      deltaMb: 7.8,
    };
    expect(snap.deltaMb).toBeCloseTo(7.8, 1);
  });

  it("PredictorCallRecord captures top candidate scores", () => {
    const rec: PredictorCallRecord = {
      candidateCount: 5,
      topBalanceScore: 0.8,
      topPredictorScore: 7.3,
      topFinalScore: 6.1,
    };
    expect(rec.candidateCount).toBe(5);
    expect(rec.topFinalScore).toBe(6.1);
  });

  it("PredictorAccuracyStats aggregates calls and candidates", () => {
    const stats: PredictorAccuracyStats = {
      totalCalls: 42,
      totalCandidates: 210,
    };
    expect(stats.totalCalls).toBe(42);
    expect(stats.totalCandidates).toBe(210);
  });

  it("DeterminismRecord holds hashed artifact values", () => {
    const rec: DeterminismRecord = {
      puzzleHash: 0xdeadbeef,
      solutionHash: 0xcafebabe,
      analysisHash: 42,
    };
    expect(rec.puzzleHash).toBe(0xdeadbeef);
    expect(rec.solutionHash).toBe(0xcafebabe);
  });

  it("ModeResult accepts optional Stage 2 fields", () => {
    const emptyStats: MetricStats = {
      mean: 0, median: 0, min: 0, max: 0,
      p90: 0, p95: 0, stddev: 0, histogram: [],
    };
    const result: ModeResult = {
      generationTimeMs: emptyStats,
      clueRemovalTimeMs: emptyStats,
      humanSolverTimeMs: emptyStats,
      uniquenessCheckTimeMs: emptyStats,
      predictorEvalTimeMs: emptyStats,
      predictorDeltaTimeMs: emptyStats,
      predictorBudgetTimeMs: emptyStats,
      analysisTimeMs: emptyStats,
      localSearchTimeMs: emptyStats,
      candidateEvalTimeMs: emptyStats,
      retries: emptyStats,
      humanSolverCalls: emptyStats,
      predictorEvaluations: emptyStats,
      difficultyMatchRate: 1.0,
      scoreDistribution: emptyStats,
      clueCount: emptyStats,
      successRate: 1.0,
      sampleCount: 10,
      memoryUsage: { mean: 5, median: 4, min: 1, max: 10, p90: 9, p95: 10, stddev: 3, histogram: [] },
      predictorAccuracy: { totalCalls: 5, totalCandidates: 25 },
    };
    expect(result.memoryUsage!.mean).toBe(5);
    expect(result.predictorAccuracy!.totalCalls).toBe(5);
  });

  it("ModeResult omits Stage 2 fields when not provided", () => {
    const emptyStats: MetricStats = {
      mean: 0, median: 0, min: 0, max: 0,
      p90: 0, p95: 0, stddev: 0, histogram: [],
    };
    const result: ModeResult = {
      generationTimeMs: emptyStats,
      clueRemovalTimeMs: emptyStats,
      humanSolverTimeMs: emptyStats,
      uniquenessCheckTimeMs: emptyStats,
      predictorEvalTimeMs: emptyStats,
      predictorDeltaTimeMs: emptyStats,
      predictorBudgetTimeMs: emptyStats,
      analysisTimeMs: emptyStats,
      localSearchTimeMs: emptyStats,
      candidateEvalTimeMs: emptyStats,
      retries: emptyStats,
      humanSolverCalls: emptyStats,
      predictorEvaluations: emptyStats,
      difficultyMatchRate: 1.0,
      scoreDistribution: emptyStats,
      clueCount: emptyStats,
      successRate: 1.0,
      sampleCount: 10,
    };
    expect(result.memoryUsage).toBeUndefined();
    expect(result.predictorAccuracy).toBeUndefined();
  });
});

describe("result types — Phase 15.1 additions", () => {
  it("CIReport has minimal CI-friendly shape", () => {
    const report: CIReport = {
      version: "0.0.29",
      timestamp: "2026-07-01T00:00:00Z",
      profile: "ci",
      status: "PASS_WITH_WARNINGS",
      counts: {
        acceptancePassed: 10,
        acceptanceFailed: 1,
        blocking: 0,
        advisory: 2,
      },
      determinism: null,
    };
    expect(report.status).toBe("PASS_WITH_WARNINGS");
    expect(report.profile).toBe("ci");
    expect(report.counts.blocking).toBe(0);
    expect(report.counts.advisory).toBe(2);
    expect(report.counts.acceptancePassed).toBe(10);
  });
});
