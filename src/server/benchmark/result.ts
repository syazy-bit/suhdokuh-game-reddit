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
