import { describe, it, expect } from "vitest";
import type { BenchmarkReport, ModeResult, MetricStats, MetricPolarity } from "../result";
import { compareReports, DEFAULT_METRIC_POLARITY } from "../comparison";
import type { SeverityThresholds } from "../config";

function emptyStats(): MetricStats {
  return { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] };
}

function makeMetrics(rawSamples: Record<string, number[]> | undefined): ModeResult {
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
    sampleCount: 0,
    ...(rawSamples !== undefined ? { rawSamples } : {}),
  };
}

function makeReport(
  timestamp: string,
  mode: string,
  difficulty: string,
  rawSamples: Record<string, number[]> | undefined,
): BenchmarkReport {
  return {
    config: {} as any,
    timestamp,
    modes: [
      {
        mode,
        difficulties: [
          {
            difficulty,
            metrics: makeMetrics(rawSamples),
          },
        ],
      },
    ],
    acceptance: null,
  };
}

function makeReportMultiMode(
  timestamp: string,
  modes: Array<{ mode: string; difficulty: string; rawSamples: Record<string, number[]> | undefined }>,
): BenchmarkReport {
  const modeMap = new Map<string, string[]>();
  const modeDiffMap = new Map<string, Map<string, Record<string, number[]> | undefined>>();

  for (const entry of modes) {
    if (!modeDiffMap.has(entry.mode)) {
      modeDiffMap.set(entry.mode, new Map());
    }
    modeDiffMap.get(entry.mode)!.set(entry.difficulty, entry.rawSamples);
  }

  return {
    config: {} as any,
    timestamp,
    modes: Array.from(modeDiffMap.entries()).map(([mode, diffMap]) => ({
      mode,
      difficulties: Array.from(diffMap.entries()).map(([difficulty, raw]) => ({
        difficulty,
        metrics: makeMetrics(raw),
      })),
    })),
    acceptance: null,
  };
}

describe("compareReports", () => {
  it("identical reports produce no regressions and zero deltas", () => {
    const raw: Record<string, number[]> = { generationTimeMs: [5, 6, 7, 8, 9] };
    const baseline = makeReport("2026-01-01T00:00:00Z", "baseline", "easy", raw);
    const treatment = makeReport("2026-07-01T00:00:00Z", "baseline", "easy", raw);

    const { comparison, regressions } = compareReports(baseline, treatment);

    expect(comparison.comparisons).toHaveLength(1);
    const comp = comparison.comparisons[0]!;
    expect(comp.summary.mean.deltaPercent).toBe(0);
    expect(comp.summary.median.deltaPercent).toBe(0);
    expect(comp.summary.p90.deltaPercent).toBe(0);
    expect(comp.summary.p95.deltaPercent).toBe(0);
    expect(comp.statistics.significant).toBe(false);
    expect(comp.regression).toBeNull();
    expect(regressions.blocking).toHaveLength(0);
    expect(regressions.advisory).toHaveLength(0);
  });

  it("detects blocking regression when lower_is_better worsens significantly", () => {
    const blRaw: Record<string, number[]> = { generationTimeMs: [5, 6, 7, 8, 9] };
    const txRaw: Record<string, number[]> = { generationTimeMs: [50, 51, 52, 53, 54] };
    const baseline = makeReport("2026-01-01T00:00:00Z", "baseline", "easy", blRaw);
    const treatment = makeReport("2026-07-01T00:00:00Z", "baseline", "easy", txRaw);

    const { comparison, regressions } = compareReports(baseline, treatment);

    expect(comparison.comparisons).toHaveLength(1);
    const comp = comparison.comparisons[0]!;
    expect(comp.metric).toBe("generationTimeMs");
    expect(comp.polarity).toBe("lower_is_better");
    expect(comp.summary.mean.deltaPercent).toBeGreaterThan(0);
    expect(comp.statistics.significant).toBe(true);
    expect(comp.regression).toBe("blocking");
    expect(regressions.blocking).toHaveLength(1);
    expect(regressions.advisory).toHaveLength(0);
  });

  it("does NOT classify improvement as regression (lower_is_better, delta < 0)", () => {
    const blRaw: Record<string, number[]> = { generationTimeMs: [50, 51, 52, 53, 54] };
    const txRaw: Record<string, number[]> = { generationTimeMs: [5, 6, 7, 8, 9] };
    const baseline = makeReport("2026-01-01T00:00:00Z", "baseline", "easy", blRaw);
    const treatment = makeReport("2026-07-01T00:00:00Z", "baseline", "easy", txRaw);

    const { comparison, regressions } = compareReports(baseline, treatment);

    expect(comparison.comparisons).toHaveLength(1);
    const comp = comparison.comparisons[0]!;
    expect(comp.summary.mean.deltaPercent).toBeLessThan(0);
    expect(comp.statistics.significant).toBe(true);
    expect(comp.regression).toBeNull();
    expect(regressions.blocking).toHaveLength(0);
    expect(regressions.advisory).toHaveLength(0);
  });

  it("does NOT classify improvement as regression (higher_is_better, delta > 0)", () => {
    const blRaw: Record<string, number[]> = { scoreDistribution: [5, 6, 7, 8, 9] };
    const txRaw: Record<string, number[]> = { scoreDistribution: [50, 51, 52, 53, 54] };
    const baseline = makeReport("2026-01-01T00:00:00Z", "baseline", "easy", blRaw);
    const treatment = makeReport("2026-07-01T00:00:00Z", "baseline", "easy", txRaw);

    const { comparison, regressions } = compareReports(baseline, treatment);

    expect(comparison.comparisons).toHaveLength(1);
    const comp = comparison.comparisons[0]!;
    expect(comp.polarity).toBe("higher_is_better");
    expect(comp.summary.mean.deltaPercent).toBeGreaterThan(0);
    expect(comp.statistics.significant).toBe(true);
    expect(comp.regression).toBeNull();
    expect(regressions.blocking).toHaveLength(0);
  });

  it("detects blocking regression when higher_is_better worsens significantly", () => {
    const blRaw: Record<string, number[]> = { scoreDistribution: [50, 51, 52, 53, 54] };
    const txRaw: Record<string, number[]> = { scoreDistribution: [5, 6, 7, 8, 9] };
    const baseline = makeReport("2026-01-01T00:00:00Z", "baseline", "easy", blRaw);
    const treatment = makeReport("2026-07-01T00:00:00Z", "baseline", "easy", txRaw);

    const { comparison, regressions } = compareReports(baseline, treatment);

    expect(comparison.comparisons).toHaveLength(1);
    const comp = comparison.comparisons[0]!;
    expect(comp.polarity).toBe("higher_is_better");
    expect(comp.summary.mean.deltaPercent).toBeLessThan(0);
    expect(comp.statistics.significant).toBe(true);
    expect(comp.regression).toBe("blocking");
    expect(regressions.blocking).toHaveLength(1);
  });

  it("skips regression classification for unknown polarity", () => {
    const blRaw: Record<string, number[]> = { someNewMetric: [5, 6, 7, 8, 9] };
    const txRaw: Record<string, number[]> = { someNewMetric: [50, 51, 52, 53, 54] };
    const baseline = makeReport("2026-01-01T00:00:00Z", "baseline", "easy", blRaw);
    const treatment = makeReport("2026-07-01T00:00:00Z", "baseline", "easy", txRaw);

    const { comparison, regressions } = compareReports(baseline, treatment);

    expect(comparison.comparisons).toHaveLength(1);
    const comp = comparison.comparisons[0]!;
    expect(comp.polarity).toBe("unknown");
    expect(comp.statistics.significant).toBe(true);
    expect(comp.regression).toBeNull();
    expect(regressions.blocking).toHaveLength(0);
    expect(regressions.advisory).toHaveLength(0);
  });

  it("computes correct delta percents for mean, median, p90, p95", () => {
    const blRaw: Record<string, number[]> = { generationTimeMs: [10, 20, 30, 40] };
    const txRaw: Record<string, number[]> = { generationTimeMs: [15, 25, 35, 45] };
    const baseline = makeReport("2026-01-01T00:00:00Z", "baseline", "easy", blRaw);
    const treatment = makeReport("2026-07-01T00:00:00Z", "baseline", "easy", txRaw);

    const { comparison } = compareReports(baseline, treatment);

    expect(comparison.comparisons).toHaveLength(1);
    const comp = comparison.comparisons[0]!;

    // bl: [10,20,30,40], mean=25, median=25, p90≈38, p95≈39
    // tx: [15,25,35,45], mean=30, median=30, p90≈43, p95≈44
    expect(comp.summary.mean.baseline).toBe(25);
    expect(comp.summary.mean.current).toBe(30);
    expect(comp.summary.mean.deltaPercent).toBeCloseTo(20, 1);
    expect(comp.summary.median.baseline).toBe(25);
    expect(comp.summary.median.current).toBe(30);
    expect(comp.summary.median.deltaPercent).toBeCloseTo(20, 1);
  });

  it("handles different sample sizes", () => {
    const blRaw: Record<string, number[]> = { generationTimeMs: [5, 6, 7, 8, 9] };
    const txRaw: Record<string, number[]> = { generationTimeMs: [50, 51, 52, 53, 54, 55, 56] };
    const baseline = makeReport("2026-01-01T00:00:00Z", "baseline", "easy", blRaw);
    const treatment = makeReport("2026-07-01T00:00:00Z", "baseline", "easy", txRaw);

    const { comparison } = compareReports(baseline, treatment);

    expect(comparison.comparisons).toHaveLength(1);
    expect(comparison.comparisons[0]!.statistics.significant).toBe(true);
    expect(comparison.comparisons[0]!.regression).toBe("blocking");
  });

  it("returns empty comparisons when old report lacks rawSamples", () => {
    const baseline = makeReport("2026-01-01T00:00:00Z", "baseline", "easy", undefined);
    const txRaw: Record<string, number[]> = { generationTimeMs: [5, 6, 7, 8, 9] };
    const treatment = makeReport("2026-07-01T00:00:00Z", "baseline", "easy", txRaw);

    const { comparison, regressions } = compareReports(baseline, treatment);

    expect(comparison.comparisons).toHaveLength(0);
    expect(regressions.blocking).toHaveLength(0);
    expect(regressions.advisory).toHaveLength(0);
  });

  it("returns empty comparisons when treatment lacks rawSamples", () => {
    const blRaw: Record<string, number[]> = { generationTimeMs: [5, 6, 7, 8, 9] };
    const baseline = makeReport("2026-01-01T00:00:00Z", "baseline", "easy", blRaw);
    const treatment = makeReport("2026-07-01T00:00:00Z", "baseline", "easy", undefined);

    const { comparison, regressions } = compareReports(baseline, treatment);

    expect(comparison.comparisons).toHaveLength(0);
    expect(regressions.blocking).toHaveLength(0);
  });

  it("skips mode/difficulty pairs that only exist in one report", () => {
    const bl = makeReportMultiMode("2026-01-01T00:00:00Z", [
      { mode: "baseline", difficulty: "easy", rawSamples: { generationTimeMs: [5, 6, 7] } },
      { mode: "baseline", difficulty: "hard", rawSamples: { generationTimeMs: [10, 11, 12] } },
    ]);
    const tx = makeReportMultiMode("2026-07-01T00:00:00Z", [
      { mode: "baseline", difficulty: "easy", rawSamples: { generationTimeMs: [8, 9, 10] } },
      // "hard" missing from treatment
      { mode: "guided", difficulty: "easy", rawSamples: { generationTimeMs: [1, 2, 3] } },
      // only "hard" in guided
    ]);

    const { comparison } = compareReports(bl, tx);

    // Only baseline/easy is common between both
    expect(comparison.comparisons).toHaveLength(1);
    expect(comparison.comparisons[0]!.mode).toBe("baseline");
    expect(comparison.comparisons[0]!.difficulty).toBe("easy");
  });

  it("dynamically discovers metrics from rawSamples intersection", () => {
    const blRaw: Record<string, number[]> = {
      genTime: [5, 6, 7],
      solveTime: [10, 11, 12],
      score: [90, 91, 92],
    };
    const txRaw: Record<string, number[]> = {
      genTime: [8, 9, 10],
      score: [85, 86, 87],
      // solveTime missing — should not be compared
    };
    const baseline = makeReport("2026-01-01T00:00:00Z", "baseline", "easy", blRaw);
    const treatment = makeReport("2026-07-01T00:00:00Z", "baseline", "easy", txRaw);

    const { comparison } = compareReports(baseline, treatment);

    expect(comparison.comparisons).toHaveLength(2);
    const metrics = comparison.comparisons.map((c) => c.metric).sort();
    expect(metrics).toEqual(["genTime", "score"]);
  });

  it("respects custom polarity map", () => {
    const blRaw: Record<string, number[]> = { myMetric: [5, 6, 7, 8, 9] };
    const txRaw: Record<string, number[]> = { myMetric: [50, 51, 52, 53, 54] };
    const baseline = makeReport("2026-01-01T00:00:00Z", "baseline", "easy", blRaw);
    const treatment = makeReport("2026-07-01T00:00:00Z", "baseline", "easy", txRaw);

    // Override: myMetric is higher_is_better, so increase is improvement
    const customPolarity: Record<string, MetricPolarity> = { myMetric: "higher_is_better" };
    const { comparison } = compareReports(baseline, treatment, { polarity: customPolarity });

    expect(comparison.comparisons).toHaveLength(1);
    expect(comparison.comparisons[0]!.polarity).toBe("higher_is_better");
    // delta > 0 with higher_is_better is improvement → null
    expect(comparison.comparisons[0]!.regression).toBeNull();
  });

  it("respects custom severity thresholds", () => {
    // Closer groups so default thresholds would flag but strict suppresses
    const blRaw: Record<string, number[]> = { generationTimeMs: [5, 6, 7, 8, 9] };
    const txRaw: Record<string, number[]> = { generationTimeMs: [10, 11, 12, 13, 14] };
    const baseline = makeReport("2026-01-01T00:00:00Z", "baseline", "easy", blRaw);
    const treatment = makeReport("2026-07-01T00:00:00Z", "baseline", "easy", txRaw);

    // Very strict thresholds — nothing qualifies (d ≈ 3.16 < 10)
    const strict: SeverityThresholds = {
      blockingEffectSize: 10,
      blockingPValue: 0.001,
      advisoryEffectSize: 10,
      advisoryPValue: 0.001,
    };
    const { comparison, regressions } = compareReports(baseline, treatment, { thresholds: strict });

    expect(comparison.comparisons).toHaveLength(1);
    expect(comparison.comparisons[0]!.regression).toBeNull();
    expect(regressions.blocking).toHaveLength(0);
    expect(regressions.advisory).toHaveLength(0);
  });

  it("classifies medium effect as advisory when blocking threshold not met", () => {
    // Create groups with moderate separation — d ≈ 0.6-0.7, p moderate
    const blRaw: Record<string, number[]> = { generationTimeMs: [5, 6, 7, 8, 9, 10] };
    const txRaw: Record<string, number[]> = { generationTimeMs: [7, 8, 9, 10, 11, 12] };
    const baseline = makeReport("2026-01-01T00:00:00Z", "baseline", "easy", blRaw);
    const treatment = makeReport("2026-07-01T00:00:00Z", "baseline", "easy", txRaw);

    const { comparison, regressions } = compareReports(baseline, treatment);

    const comp = comparison.comparisons[0]!;
    // With this overlap, d should be moderate, p moderate
    expect(comp.regression).toBe("advisory");
    expect(regressions.advisory).toHaveLength(1);
    expect(regressions.blocking).toHaveLength(0);
  });

  it("preserves timestamps in ComparisonReport", () => {
    const raw: Record<string, number[]> = { generationTimeMs: [5, 6, 7] };
    const baseline = makeReport("2026-01-15T12:00:00Z", "baseline", "easy", raw);
    const treatment = makeReport("2026-07-20T08:30:00Z", "baseline", "easy", raw);

    const { comparison } = compareReports(baseline, treatment);

    expect(comparison.baselineTimestamp).toBe("2026-01-15T12:00:00Z");
    expect(comparison.currentTimestamp).toBe("2026-07-20T08:30:00Z");
  });

  it("skips metrics with fewer than 2 samples", () => {
    const blRaw: Record<string, number[]> = { generationTimeMs: [5] }; // only 1
    const txRaw: Record<string, number[]> = { generationTimeMs: [10] };
    const baseline = makeReport("2026-01-01T00:00:00Z", "baseline", "easy", blRaw);
    const treatment = makeReport("2026-07-01T00:00:00Z", "baseline", "easy", txRaw);

    const { comparison } = compareReports(baseline, treatment);

    expect(comparison.comparisons).toHaveLength(0);
  });

  it("classifies multiple regressions across modes and difficulties", () => {
    const bl = makeReportMultiMode("2026-01-01T00:00:00Z", [
      { mode: "baseline", difficulty: "easy", rawSamples: { generationTimeMs: [5, 6, 7, 8, 9] } },
      { mode: "baseline", difficulty: "hard", rawSamples: { generationTimeMs: [1, 3, 5, 7, 9, 11, 13, 15] } },
    ]);
    const tx = makeReportMultiMode("2026-07-01T00:00:00Z", [
      { mode: "baseline", difficulty: "easy", rawSamples: { generationTimeMs: [50, 51, 52, 53, 54] } },
      // Large overlap → d≈1.0, p≈0.019 → advisory (p > 0.01, fails blocking)
      { mode: "baseline", difficulty: "hard", rawSamples: { generationTimeMs: [6, 8, 10, 12, 14, 16, 18, 20] } },
    ]);

    const { comparison, regressions } = compareReports(bl, tx);

    expect(comparison.comparisons).toHaveLength(2);
    // easy: large shift, perfectly separated → blocking
    // hard: moderate shift with wide spread, n≥8 → advisory
    expect(regressions.blocking).toHaveLength(1);
    expect(regressions.blocking[0]!.difficulty).toBe("easy");
    expect(regressions.advisory).toHaveLength(1);
    expect(regressions.advisory[0]!.difficulty).toBe("hard");
  });
});

describe("DEFAULT_METRIC_POLARITY", () => {
  it("marks all time and counter metrics as lower_is_better", () => {
    const lowerIsBetter = [
      "generationTimeMs", "clueRemovalTimeMs", "humanSolverTimeMs",
      "uniquenessCheckTimeMs", "predictorEvalTimeMs", "predictorDeltaTimeMs",
      "predictorBudgetTimeMs", "analysisTimeMs", "localSearchTimeMs",
      "candidateEvalTimeMs", "retries", "humanSolverCalls",
      "predictorEvaluations", "memoryUsage",
    ];
    for (const key of lowerIsBetter) {
      expect(DEFAULT_METRIC_POLARITY[key]).toBe("lower_is_better");
    }
  });

  it("marks score and clue metrics as higher_is_better", () => {
    expect(DEFAULT_METRIC_POLARITY.scoreDistribution).toBe("higher_is_better");
    expect(DEFAULT_METRIC_POLARITY.clueCount).toBe("higher_is_better");
  });

  it("returns undefined for unknown metrics", () => {
    expect(DEFAULT_METRIC_POLARITY.nonexistent).toBeUndefined();
  });
});
