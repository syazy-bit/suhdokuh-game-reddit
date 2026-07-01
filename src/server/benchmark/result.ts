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

export interface MetricComparison {
  mode: string;
  difficulty: string;
  metric: string;
  baselineMean: number;
  currentMean: number;
  deltaPercent: number;
  mwUStatistic: number;
  mwUPValue: number;
  welchTStat: number | null;
  welchDf: number | null;
  welchPValue: number | null;
  cohensD: number;
  significant: boolean;
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

export interface CertificationVerdict {
  certified: boolean;
  blockingPassed: number;
  blockingFailed: number;
  advisoryPassed: number;
  advisoryFailed: number;
  blockingRegressions: number;
  advisoryRegressions: number;
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
  certified: boolean;
  blockingPassed: number;
  blockingFailed: number;
  advisoryPassed: number;
  advisoryFailed: number;
  regressions: {
    blocking: number;
    advisory: number;
  };
  determinism: {
    overall: number;
    artifacts: DeterminismArtifacts;
  };
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
