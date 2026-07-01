export interface SeverityThresholds {
  blockingEffectSize: number;
  blockingPValue: number;
  advisoryEffectSize: number;
  advisoryPValue: number;
}

export const DEFAULT_SEVERITY_THRESHOLDS: SeverityThresholds = {
  blockingEffectSize: 0.8,
  blockingPValue: 0.01,
  advisoryEffectSize: 0.5,
  advisoryPValue: 0.05,
};

export interface BenchmarkConfig {
  samples: number;
  warmup: number;
  runs: number;
  seed: number | null;
  modes: string[];
  difficulties: string[];
  outputDir: string;
  generatePlots: boolean;
  acceptanceGates: AcceptanceGates | null;
  severityThresholds?: SeverityThresholds;
}

export interface AcceptanceGates {
  generationTimeMs: { max: Partial<Record<string, number>>; severity?: "blocking" | "advisory" };
  difficultyMatchRate: { min: Partial<Record<string, number>>; severity?: "blocking" | "advisory" };
  humanSolverCalls: { max: Partial<Record<string, number>>; severity?: "blocking" | "advisory" };
  predictorOverheadMs: { max: number; severity?: "blocking" | "advisory" };
  successRate: { min: number; severity?: "blocking" | "advisory" };
}

export const DEFAULT_CONFIG: BenchmarkConfig = {
  samples: 100,
  warmup: 10,
  runs: 1,
  seed: null,
  modes: ["baseline", "guided", "predictor", "predictor-budget", "local-search"],
  difficulties: ["easy", "medium", "hard", "expert"],
  outputDir: "./bench-results",
  generatePlots: false,
  acceptanceGates: null,
};
