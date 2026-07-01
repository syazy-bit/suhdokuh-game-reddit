export interface MetricStats {
  mean: number;
  median: number;
  min: number;
  max: number;
  p90: number;
  p95: number;
  stddev: number;
  histogram: HistogramBin[];
}

export interface HistogramBin {
  lower: number;
  upper: number;
  count: number;
}

export interface ModeResult {
  generationTimeMs: MetricStats;
  clueRemovalTimeMs: MetricStats;
  humanSolverTimeMs: MetricStats;
  uniquenessCheckTimeMs: MetricStats;
  predictorEvalTimeMs: MetricStats;
  predictorDeltaTimeMs: MetricStats;
  predictorBudgetTimeMs: MetricStats;
  analysisTimeMs: MetricStats;
  localSearchTimeMs: MetricStats;
  candidateEvalTimeMs: MetricStats;
  retries: MetricStats;
  humanSolverCalls: MetricStats;
  predictorEvaluations: MetricStats;
  difficultyMatchRate: number;
  scoreDistribution: MetricStats;
  clueCount: MetricStats;
  successRate: number;
  sampleCount: number;

  // Phase 15.1 Stage 2 extensions (optional — backward compatible)
  memoryUsage?: MetricStats;
  predictorAccuracy?: PredictorAccuracyStats;

  // Phase 15.2 Stage 1 — raw sample arrays for statistical comparison
  rawSamples?: Record<string, number[]>;
}

export interface DifficultyReport {
  difficulty: string;
  metrics: ModeResult;
}

export interface ModeReport {
  mode: string;
  difficulties: DifficultyReport[];
}

export interface BenchmarkReport {
  config: import("./config").BenchmarkConfig;
  timestamp: string;
  modes: ModeReport[];
  acceptance: AcceptanceResult | null;
}

export interface AcceptanceResult {
  passed: boolean;
  checks: AcceptanceCheck[];
}

export interface AcceptanceCheck {
  name: string;
  status: "pass" | "fail";
  actual: number;
  threshold: number;
  mode: string;
  difficulty: string | null;
  severity: GateSeverity;
}

// ── Phase 15.1 Stage 1 types ─────────────────────────────────────────────────

export type GateSeverity = "blocking" | "advisory";

export interface DeterminismArtifacts {
  puzzle: number;
  solution: number;
  removalSequence: number;
  analysis: number;
}

export interface DeterminismResult {
  overall: number;
  artifacts: DeterminismArtifacts;
  sampleCount: number;
}

export type MetricPolarity = "lower_is_better" | "higher_is_better" | "unknown";

export interface MetricSummary {
  baseline: number;
  current: number;
  deltaPercent: number;
}

export interface MetricStatistics {
  mwUStatistic: number;
  mwUPValue: number;
  welchTStat: number | null;
  welchDf: number | null;
  welchPValue: number | null;
  cohensD: number;
  significant: boolean;
}

export interface MetricComparison {
  mode: string;
  difficulty: string;
  metric: string;
  polarity: MetricPolarity;
  summary: {
    mean: MetricSummary;
    median: MetricSummary;
    p90: MetricSummary;
    p95: MetricSummary;
  };
  statistics: MetricStatistics;
  regression: GateSeverity | null;
}

export interface ComparisonReport {
  baselineTimestamp: string;
  currentTimestamp: string;
  comparisons: MetricComparison[];
}

export interface RegressionItem {
  mode: string;
  difficulty: string;
  metric: string;
  deltaPercent: number;
  pValue: number;
  effectSize: number;
  severity: GateSeverity;
}

export interface RegressionResult {
  blocking: RegressionItem[];
  advisory: RegressionItem[];
}

export type CertificationStatus = "PASS" | "PASS_WITH_WARNINGS" | "FAIL";

export interface CertificationVerdict {
  status: CertificationStatus;
  blockingRegressions: RegressionItem[];
  advisoryRegressions: RegressionItem[];
}

export interface CertificationReport {
  version: string;
  timestamp: string;
  profile: string;
  config: import("./config").BenchmarkConfig;
  modes: ModeReport[];
  acceptance: AcceptanceResult | null;
  determinism: DeterminismResult | null;
  comparison: ComparisonReport | null;
  regressions: RegressionResult | null;
  verdict: CertificationVerdict;
}

export interface CIReport {
  version: string;
  timestamp: string;
  profile: string;
  status: CertificationStatus;
  counts: {
    acceptancePassed: number;
    acceptanceFailed: number;
    blocking: number;
    advisory: number;
  };
  determinism: DeterminismResult | null;
}

export interface CertifyOptions {
  baseline?: BenchmarkReport;
  thresholds?: import("./config").SeverityThresholds;
  polarity?: Record<string, MetricPolarity>;
  determinism?: DeterminismResult | null;
  profile?: string;
}

// ── Phase 15.1 Stage 2 types ─────────────────────────────────────────────────

export interface MemorySnapshot {
  heapUsedBeforeMb: number;
  heapUsedAfterMb: number;
  deltaMb: number;
}

export interface PredictorCallRecord {
  candidateCount: number;
  topBalanceScore: number;
  topPredictorScore: number;
  topFinalScore: number;
}

export interface PredictorAccuracyStats {
  totalCalls: number;
  totalCandidates: number;
}

export interface DeterminismRecord {
  puzzleHash: number;
  solutionHash: number;
  analysisHash: number;
}
