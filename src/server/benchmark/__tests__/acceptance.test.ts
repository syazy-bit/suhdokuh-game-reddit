import { describe, it, expect } from "vitest";
import type { BenchmarkReport } from "../result";
import { checkAcceptance } from "../gates";
import type { AcceptanceGates } from "../config";

const ACCEPTANCE_GATES: AcceptanceGates = {
  generationTimeMs: { max: { easy: 3000, medium: 5000, hard: 8000 } },
  difficultyMatchRate: { min: { easy: 0.5, medium: 0.5, hard: 0.5 } },
  humanSolverCalls: { max: { easy: 40, medium: 50, hard: 60 } },
  predictorOverheadMs: { max: 200 },
  successRate: { min: 0.9 },
};

describe("Acceptance gates — re-validation", () => {
  it("validate baseline mode gates", () => {
    const report: BenchmarkReport = {
      config: {} as any,
      timestamp: "",
      modes: [
        {
          mode: "baseline",
          difficulties: [
            {
              difficulty: "easy",
              metrics: {
                generationTimeMs: { mean: 5, median: 4, min: 1, max: 10, p90: 8, p95: 9, stddev: 2, histogram: [] },
                clueRemovalTimeMs: { mean: 1, median: 1, min: 0, max: 3, p90: 2, p95: 3, stddev: 0.5, histogram: [] },
                humanSolverTimeMs: { mean: 1, median: 1, min: 0, max: 3, p90: 2, p95: 3, stddev: 0.5, histogram: [] },
                uniquenessCheckTimeMs: { mean: 0.1, median: 0.1, min: 0, max: 1, p90: 0.5, p95: 0.8, stddev: 0.1, histogram: [] },
                predictorEvalTimeMs: { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] },
                predictorDeltaTimeMs: { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] },
                predictorBudgetTimeMs: { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] },
                analysisTimeMs: { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] },
                localSearchTimeMs: { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] },
                candidateEvalTimeMs: { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] },
                retries: { mean: 0.1, median: 0, min: 0, max: 1, p90: 1, p95: 1, stddev: 0.3, histogram: [] },
                humanSolverCalls: { mean: 1.1, median: 1, min: 1, max: 2, p90: 2, p95: 2, stddev: 0.3, histogram: [] },
                predictorEvaluations: { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] },
                difficultyMatchRate: 1.0,
                scoreDistribution: { mean: 30, median: 30, min: 30, max: 30, p90: 30, p95: 30, stddev: 0, histogram: [] },
                clueCount: { mean: 30, median: 30, min: 30, max: 30, p90: 30, p95: 30, stddev: 0, histogram: [] },
                successRate: 1.0,
                sampleCount: 20,
              },
            },
          ],
        },
      ],
      acceptance: null,
    };

    const result = checkAcceptance(report, ACCEPTANCE_GATES);
    expect(result.passed).toBe(true);
  });

  it("rejects when generation time exceeds threshold", () => {
    const report: BenchmarkReport = {
      config: {} as any,
      timestamp: "",
      modes: [
        {
          mode: "baseline",
          difficulties: [
            {
              difficulty: "easy",
              metrics: {
                generationTimeMs: { mean: 5000, median: 5000, min: 4000, max: 6000, p90: 5500, p95: 5800, stddev: 500, histogram: [] },
                clueRemovalTimeMs: { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] },
                humanSolverTimeMs: { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] },
                uniquenessCheckTimeMs: { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] },
                predictorEvalTimeMs: { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] },
                predictorDeltaTimeMs: { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] },
                predictorBudgetTimeMs: { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] },
                analysisTimeMs: { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] },
                localSearchTimeMs: { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] },
                candidateEvalTimeMs: { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] },
                retries: { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] },
                humanSolverCalls: { mean: 1, median: 1, min: 1, max: 1, p90: 1, p95: 1, stddev: 0, histogram: [] },
                predictorEvaluations: { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] },
                difficultyMatchRate: 1.0,
                scoreDistribution: { mean: 30, median: 30, min: 30, max: 30, p90: 30, p95: 30, stddev: 0, histogram: [] },
                clueCount: { mean: 30, median: 30, min: 30, max: 30, p90: 30, p95: 30, stddev: 0, histogram: [] },
                successRate: 1.0,
                sampleCount: 20,
              },
            },
          ],
        },
      ],
      acceptance: null,
    };

    const result = checkAcceptance(report, ACCEPTANCE_GATES);
    expect(result.passed).toBe(false);
    const genCheck = result.checks.find((c) => c.name === "generationTimeMs");
    expect(genCheck).toBeDefined();
    expect(genCheck!.status).toBe("fail");
  });
});
