import type { BenchmarkReport, MetricComparison, ComparisonReport, RegressionResult, RegressionItem, GateSeverity, MetricSummary, MetricStatistics, MetricPolarity } from "./result";
import type { SeverityThresholds } from "./config";
import { DEFAULT_SEVERITY_THRESHOLDS } from "./config";
import { mean, median, p90, p95 } from "./statistics";
import { mannWhitneyU, welchTTest, cohensD } from "./significance";

export const DEFAULT_METRIC_POLARITY: Record<string, MetricPolarity> = {
  generationTimeMs: "lower_is_better",
  clueRemovalTimeMs: "lower_is_better",
  humanSolverTimeMs: "lower_is_better",
  uniquenessCheckTimeMs: "lower_is_better",
  predictorEvalTimeMs: "lower_is_better",
  predictorDeltaTimeMs: "lower_is_better",
  predictorBudgetTimeMs: "lower_is_better",
  analysisTimeMs: "lower_is_better",
  localSearchTimeMs: "lower_is_better",
  candidateEvalTimeMs: "lower_is_better",
  retries: "lower_is_better",
  humanSolverCalls: "lower_is_better",
  predictorEvaluations: "lower_is_better",
  memoryUsage: "lower_is_better",
  scoreDistribution: "higher_is_better",
  clueCount: "higher_is_better",
};

export interface CompareOptions {
  thresholds?: SeverityThresholds;
  polarity?: Record<string, MetricPolarity>;
}

function deltaPercent(baseline: number, current: number): number {
  if (Math.abs(baseline) < 1e-10) return 0;
  return ((current - baseline) / Math.abs(baseline)) * 100;
}

function computeMetricSummary(samples: number[]): { mean: number; median: number; p90: number; p95: number } {
  if (samples.length === 0) return { mean: 0, median: 0, p90: 0, p95: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    mean: mean(samples),
    median: median(sorted),
    p90: p90(sorted),
    p95: p95(sorted),
  };
}

function makeSummary(bl: number[], tx: number[]): MetricComparison["summary"] {
  const b = computeMetricSummary(bl);
  const t = computeMetricSummary(tx);
  const mk = (baseline: number, current: number): MetricSummary => ({
    baseline,
    current,
    deltaPercent: deltaPercent(baseline, current),
  });
  return {
    mean: mk(b.mean, t.mean),
    median: mk(b.median, t.median),
    p90: mk(b.p90, t.p90),
    p95: mk(b.p95, t.p95),
  };
}

function classifyRegression(
  d: number,
  pValue: number,
  meanDeltaPercent: number,
  polarity: MetricPolarity,
  thresholds: SeverityThresholds,
): GateSeverity | null {
  if (polarity === "unknown") return null;

  const isRegression =
    polarity === "lower_is_better" ? meanDeltaPercent > 0 : meanDeltaPercent < 0;

  if (!isRegression) return null;

  const absD = Math.abs(d);
  if (absD >= thresholds.blockingEffectSize && pValue <= thresholds.blockingPValue) {
    return "blocking";
  }
  if (absD >= thresholds.advisoryEffectSize && pValue <= thresholds.advisoryPValue) {
    return "advisory";
  }
  return null;
}

export function compareReports(
  baseline: BenchmarkReport,
  treatment: BenchmarkReport,
  options?: CompareOptions,
): { comparison: ComparisonReport; regressions: RegressionResult } {
  const polarityMap = options?.polarity ?? DEFAULT_METRIC_POLARITY;
  const thresholds = options?.thresholds ?? DEFAULT_SEVERITY_THRESHOLDS;

  const comparisons: MetricComparison[] = [];

  for (const txMode of treatment.modes) {
    const blMode = baseline.modes.find((m) => m.mode === txMode.mode);
    if (!blMode) continue;

    for (const txDiff of txMode.difficulties) {
      const blDiff = blMode.difficulties.find((d) => d.difficulty === txDiff.difficulty);
      if (!blDiff) continue;

      const blRaw = blDiff.metrics.rawSamples;
      const txRaw = txDiff.metrics.rawSamples;
      if (!blRaw || !txRaw) continue;

      const metricKeys = Object.keys(blRaw).filter((k) => k in txRaw);
      metricKeys.sort();

      for (const metricKey of metricKeys) {
        const blArr = blRaw[metricKey]!;
        const txArr = txRaw[metricKey]!;
        if (blArr.length < 2 || txArr.length < 2) continue;

        const summary = makeSummary(blArr, txArr);
        const mw = mannWhitneyU(blArr, txArr);
        const welch = welchTTest(blArr, txArr);
        const cd = cohensD(blArr, txArr);
        const significant = mw.pValue < 0.05;

        const statistics: MetricStatistics = {
          mwUStatistic: mw.UStatistic,
          mwUPValue: mw.pValue,
          welchTStat: welch.tStat,
          welchDf: welch.df,
          welchPValue: welch.pValue,
          cohensD: cd.d,
          significant,
        };

        const polarity: MetricPolarity = polarityMap[metricKey] ?? "unknown";
        const regression = classifyRegression(cd.d, mw.pValue, summary.mean.deltaPercent, polarity, thresholds);

        comparisons.push({
          mode: txMode.mode,
          difficulty: txDiff.difficulty,
          metric: metricKey,
          polarity,
          summary,
          statistics,
          regression,
        });
      }
    }
  }

  const regressions: RegressionResult = { blocking: [], advisory: [] };
  for (const comp of comparisons) {
    if (comp.regression === "blocking") {
      regressions.blocking.push(toRegressionItem(comp));
    } else if (comp.regression === "advisory") {
      regressions.advisory.push(toRegressionItem(comp));
    }
  }

  return {
    comparison: {
      baselineTimestamp: baseline.timestamp,
      currentTimestamp: treatment.timestamp,
      comparisons,
    },
    regressions,
  };
}

function toRegressionItem(comp: MetricComparison): RegressionItem {
  return {
    mode: comp.mode,
    difficulty: comp.difficulty,
    metric: comp.metric,
    deltaPercent: comp.summary.mean.deltaPercent,
    pValue: comp.statistics.mwUPValue,
    effectSize: comp.statistics.cohensD,
    severity: comp.regression!,
  };
}
