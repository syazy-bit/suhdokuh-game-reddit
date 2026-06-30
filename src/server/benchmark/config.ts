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
}

export interface AcceptanceGates {
  generationTimeMs: { max: Partial<Record<string, number>> };
  difficultyMatchRate: { min: Partial<Record<string, number>> };
  humanSolverCalls: { max: Partial<Record<string, number>> };
  predictorOverheadMs: { max: number };
  successRate: { min: number };
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
