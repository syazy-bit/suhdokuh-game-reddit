import type { BenchmarkReport, MetricStats, HistogramBin } from "./result";

// ── JSON ────────────────────────────────────────────────────────────────────

export function toJSON(report: BenchmarkReport): string {
  return JSON.stringify(report, null, 2);
}

// ── CSV ─────────────────────────────────────────────────────────────────────

export function toCSV(report: BenchmarkReport): string {
  const header = [
    "mode", "difficulty",
    "genTimeMean", "genTimeMedian", "genTimeP90", "genTimeP95", "genTimeStddev",
    "solveTimeMean", "solveTimeMedian", "solveTimeP90", "solveTimeP95", "solveTimeStddev",
    "uniqueTimeMean", "uniqueTimeMedian", "uniqueTimeP90", "uniqueTimeP95", "uniqueTimeStddev",
    "predEvalTimeMean", "predEvalTimeMedian", "predEvalTimeP90", "predEvalTimeP95",
    "retriesMean", "retriesMedian",
    "solveCallsMean", "solveCallsMedian",
    "scoreMean", "scoreMedian",
    "clueCountMean",
    "difficultyMatchRate", "successRate", "sampleCount",
  ];

  const rows: string[] = [header.join(",")];

  for (const mode of report.modes) {
    for (const diff of mode.difficulties) {
      const m = diff.metrics;
      const row = [
        mode.mode, diff.difficulty,
        m.generationTimeMs.mean, m.generationTimeMs.median, m.generationTimeMs.p90, m.generationTimeMs.p95, m.generationTimeMs.stddev,
        m.humanSolverTimeMs.mean, m.humanSolverTimeMs.median, m.humanSolverTimeMs.p90, m.humanSolverTimeMs.p95, m.humanSolverTimeMs.stddev,
        m.uniquenessCheckTimeMs.mean, m.uniquenessCheckTimeMs.median, m.uniquenessCheckTimeMs.p90, m.uniquenessCheckTimeMs.p95,
        m.predictorEvalTimeMs.mean, m.predictorEvalTimeMs.median, m.predictorEvalTimeMs.p90, m.predictorEvalTimeMs.p95,
        m.retries.mean, m.retries.median,
        m.humanSolverCalls.mean, m.humanSolverCalls.median,
        m.scoreDistribution.mean, m.scoreDistribution.median,
        m.clueCount.mean,
        m.difficultyMatchRate, m.successRate, m.sampleCount,
      ].map((v) => typeof v === "number" ? v.toFixed(4) : v).join(",");
      rows.push(row);
    }
  }

  return rows.join("\n");
}

// ── Console ─────────────────────────────────────────────────────────────────

function formatMetricRow(label: string, stats: MetricStats): string {
  return `  ${label.padEnd(24)} ${stats.mean.toFixed(1).padStart(8)} ${stats.median.toFixed(1).padStart(8)} ${stats.p90.toFixed(1).padStart(8)} ${stats.p95.toFixed(1).padStart(8)} ${stats.stddev.toFixed(1).padStart(8)}`;
}

function histoBar(bin: HistogramBin, maxCount: number, width: number): string {
  const barLen = maxCount > 0 ? Math.round((bin.count / maxCount) * width) : 0;
  return "█".repeat(barLen);
}

function formatHistogram(label: string, stats: MetricStats): string {
  if (stats.histogram.length === 0) return "";
  const maxCount = Math.max(...stats.histogram.map((h) => h.count));
  const lines: string[] = [`  ${label} histogram (${stats.histogram.length} bins):`];
  for (const bin of stats.histogram) {
    const bar = histoBar(bin, maxCount, 30);
    lines.push(`    ${bin.lower.toFixed(1).padStart(8)}–${bin.upper.toFixed(1).padStart(8)} │${bar} ${bin.count}`);
  }
  return lines.join("\n");
}

export function toConsole(report: BenchmarkReport): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("=".repeat(78));
  lines.push("  BENCHMARK REPORT");
  lines.push("=".repeat(78));
  lines.push(`  Timestamp: ${report.timestamp}`);
  lines.push(`  Samples: ${report.config.samples} per mode×difficulty`);
  lines.push(`  Modes: ${report.modes.map((m) => m.mode).join(", ")}`);
  lines.push("");

  for (const mode of report.modes) {
    for (const diff of mode.difficulties) {
      const m = diff.metrics;
      lines.push(`┌${"─".repeat(76)}┐`);
      lines.push(`│  MODE: ${mode.mode.padEnd(12)} DIFFICULTY: ${diff.difficulty.padEnd(8)} SAMPLES: ${m.sampleCount}${" ".repeat(25)}│`);
      lines.push(`├${"─".repeat(76)}┤`);
      lines.push(`│  ${"metric".padEnd(24)} ${"mean".padStart(8)} ${"median".padStart(8)} ${"p90".padStart(8)} ${"p95".padStart(8)} ${"σ".padStart(8)} │`);
      lines.push(`│  ${"─".repeat(74)} │`);
      lines.push(`│${formatMetricRow("generation (ms)", m.generationTimeMs)} │`);
      lines.push(`│${formatMetricRow("human solver (ms)", m.humanSolverTimeMs)} │`);
      lines.push(`│${formatMetricRow("uniqueness (ms)", m.uniquenessCheckTimeMs)} │`);
      lines.push(`│${formatMetricRow("predictor eval (ms)", m.predictorEvalTimeMs)} │`);
      lines.push(`│${formatMetricRow("predictor delta (ms)", m.predictorDeltaTimeMs)} │`);
      lines.push(`│${formatMetricRow("predictor budget (ms)", m.predictorBudgetTimeMs)} │`);
      lines.push(`│${formatMetricRow("analysis (ms)", m.analysisTimeMs)} │`);
      lines.push(`│${formatMetricRow("local search (ms)", m.localSearchTimeMs)} │`);
      lines.push(`│${formatMetricRow("candidate eval (ms)", m.candidateEvalTimeMs)} │`);
      lines.push(`│${formatMetricRow("clue removal (ms)", m.clueRemovalTimeMs)} │`);
      lines.push(`│${"".padEnd(74)} │`);
      lines.push(`│${formatMetricRow("retries", m.retries)} │`);
      lines.push(`│${formatMetricRow("solver calls", m.humanSolverCalls)} │`);
      lines.push(`│${formatMetricRow("predictor evals", m.predictorEvaluations)} │`);
      lines.push(`│${"".padEnd(74)} │`);
      lines.push(`│${formatMetricRow("score", m.scoreDistribution)} │`);
      lines.push(`│${formatMetricRow("clue count", m.clueCount)} │`);
      lines.push(`│${"".padEnd(74)} │`);
      lines.push(`│  difficulty match rate:   ${(m.difficultyMatchRate * 100).toFixed(1).padStart(5)}%${" ".repeat(40)}│`);
      lines.push(`│  success rate:           ${(m.successRate * 100).toFixed(1).padStart(5)}%${" ".repeat(40)}│`);
      lines.push(`└${"─".repeat(76)}┘`);

      const histSection = [
        formatHistogram("generation time", m.generationTimeMs),
        formatHistogram("score", m.scoreDistribution),
        formatHistogram("retries", m.retries),
        formatHistogram("solver calls", m.humanSolverCalls),
      ].filter((s) => s.length > 0).join("\n\n");
      if (histSection) {
        lines.push("");
        lines.push(histSection);
        lines.push("");
      }
    }
  }

  // Acceptance gates
  if (report.acceptance) {
    lines.push("─".repeat(78));
    lines.push(`  ACCEPTANCE GATES: ${report.acceptance.passed ? "PASSED" : "FAILED"}`);
    lines.push("─".repeat(78));
    for (const check of report.acceptance.checks) {
      const icon = check.status === "pass" ? "✓" : "✗";
      lines.push(`  ${icon} ${check.name} (${check.mode}${check.difficulty ? `/${check.difficulty}` : ""}): ${check.actual.toFixed(2)} vs ${check.threshold}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── File writers ────────────────────────────────────────────────────────────

export function writeReportFiles(report: BenchmarkReport, outputDir: string): void {
  const fs = require("fs");
  const path = require("path");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(path.join(outputDir, "report.json"), toJSON(report), "utf-8");
  fs.writeFileSync(path.join(outputDir, "report.csv"), toCSV(report), "utf-8");
  fs.writeFileSync(path.join(outputDir, "report.txt"), toConsole(report), "utf-8");
}
