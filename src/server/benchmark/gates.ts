import type { AcceptanceGates } from "./config";
import type { BenchmarkReport, AcceptanceResult, AcceptanceCheck } from "./result";

export function checkAcceptance(report: BenchmarkReport, gates: AcceptanceGates): AcceptanceResult {
  const checks: AcceptanceCheck[] = [];

  for (const mode of report.modes) {
    for (const diff of mode.difficulties) {
      const m = diff.metrics;

      if (gates.generationTimeMs.max) {
        const threshold = gates.generationTimeMs.max[diff.difficulty];
        if (threshold !== undefined) {
          checks.push({
            name: "generationTimeMs",
            status: m.generationTimeMs.mean <= threshold ? "pass" : "fail",
            actual: m.generationTimeMs.mean,
            threshold,
            mode: mode.mode,
            difficulty: diff.difficulty,
            severity: gates.generationTimeMs.severity ?? "blocking",
          });
        }
      }

      if (gates.difficultyMatchRate.min) {
        const threshold = gates.difficultyMatchRate.min[diff.difficulty];
        if (threshold !== undefined) {
          checks.push({
            name: "difficultyMatchRate",
            status: m.difficultyMatchRate >= threshold ? "pass" : "fail",
            actual: m.difficultyMatchRate,
            threshold,
            mode: mode.mode,
            difficulty: diff.difficulty,
            severity: gates.difficultyMatchRate.severity ?? "blocking",
          });
        }
      }

      if (gates.humanSolverCalls.max) {
        const threshold = gates.humanSolverCalls.max[diff.difficulty];
        if (threshold !== undefined) {
          checks.push({
            name: "humanSolverCalls",
            status: m.humanSolverCalls.mean <= threshold ? "pass" : "fail",
            actual: m.humanSolverCalls.mean,
            threshold,
            mode: mode.mode,
            difficulty: diff.difficulty,
            severity: gates.humanSolverCalls.severity ?? "blocking",
          });
        }
      }

      if (gates.successRate.min !== undefined) {
        checks.push({
          name: "successRate",
          status: m.successRate >= gates.successRate.min ? "pass" : "fail",
          actual: m.successRate,
          threshold: gates.successRate.min,
          mode: mode.mode,
          difficulty: diff.difficulty,
          severity: gates.successRate.severity ?? "blocking",
        });
      }
    }
  }

  // Predictor overhead (across all difficulties)
  if (gates.predictorOverheadMs.max !== undefined) {
    for (const mode of report.modes) {
      if (mode.mode === "baseline" || mode.mode === "guided") continue;
      for (const diff of mode.difficulties) {
        const predTime = diff.metrics.predictorEvalTimeMs.mean +
          diff.metrics.predictorDeltaTimeMs.mean +
          diff.metrics.predictorBudgetTimeMs.mean;
        checks.push({
          name: "predictorOverheadMs",
          status: predTime <= gates.predictorOverheadMs.max ? "pass" : "fail",
          actual: predTime,
          threshold: gates.predictorOverheadMs.max,
          mode: mode.mode,
          difficulty: diff.difficulty,
          severity: gates.predictorOverheadMs.severity ?? "blocking",
        });
      }
    }
  }

  const allPassed = checks.every((c) => c.status === "pass");
  return { passed: allPassed, checks };
}
