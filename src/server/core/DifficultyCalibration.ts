import { SudokuGenerator, type GridSize } from "./SudokuGenerator";
import { DIFFICULTY_THRESHOLDS, TECHNIQUE_WEIGHTS, type AnalysisResult, type Difficulty } from "./DifficultyAnalyzer";
import type { Technique } from "./HumanSolverTypes";

export const DIFFICULTY_LABELS: Difficulty[] = ["easy", "medium", "hard", "expert"];
export const GRID_SIZES: GridSize[] = [4, 9];

export interface BenchmarkConfig {
  sampleSize: number;
  sizes?: GridSize[];
  difficulties?: Difficulty[];
}

export interface BenchmarkEntry {
  size: GridSize;
  requestedDifficulty: Difficulty;
  actualDifficulty: Difficulty;
  score: number;
  hardestTechnique: Technique | null;
  techniqueCounts: Partial<Record<Technique, number>>;
  assignmentCount: number;
  eliminationCount: number;
  totalSteps: number;
}

export interface PerDifficultyStats {
  sampleSize: number;
  averageScore: number;
  medianScore: number;
  minScore: number;
  maxScore: number;
  stdDev: number;
  p10Score: number;
  p90Score: number;
  techniqueFrequency: Partial<Record<Technique, number>>;
  hardestTechniqueDistribution: Partial<Record<Technique, number>>;
  averageAssignmentCount: number;
  averageEliminationCount: number;
  averageTotalSteps: number;
}

export interface ThresholdRecommendation {
  current: Record<Difficulty, number>;
  recommended: Record<Difficulty, number> | null;
  reasoning: string;
  distributionsOverlap: boolean;
  perSizeAnalysis: string;
}

export interface BenchmarkReport {
  config: BenchmarkConfig;
  timestamp: string;
  stats: Record<string, PerDifficultyStats>;
  thresholdRecommendation: ThresholdRecommendation;
}

function boxSizeFor(size: GridSize): number {
  return size === 4 ? 2 : 3;
}

export function createBenchmarkEntry(
  size: GridSize,
  requestedDifficulty: Difficulty,
  analysis: AnalysisResult
): BenchmarkEntry {
  return {
    size,
    requestedDifficulty,
    actualDifficulty: analysis.difficulty,
    score: analysis.score,
    hardestTechnique: analysis.hardestTechnique,
    techniqueCounts: { ...analysis.techniqueCounts },
    assignmentCount: analysis.assignmentCount,
    eliminationCount: analysis.eliminationCount,
    totalSteps: analysis.totalSteps,
  };
}

export function computeMedian(sortedScores: number[]): number {
  if (sortedScores.length === 0) return 0;
  const mid = Math.floor(sortedScores.length / 2);
  if (sortedScores.length % 2 === 1) return sortedScores[mid]!;
  return (sortedScores[mid - 1]! + sortedScores[mid]!) / 2;
}

export function computeStdDev(scores: number[], mean: number): number {
  if (scores.length === 0) return 0;
  const squaredDiffs = scores.map((s) => (s - mean) ** 2);
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / scores.length);
}

export function computePercentile(sortedScores: number[], p: number): number {
  if (sortedScores.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedScores.length) - 1;
  return sortedScores[Math.max(0, index)]!;
}

export function aggregateStats(entries: BenchmarkEntry[]): PerDifficultyStats {
  const n = entries.length;
  if (n === 0) {
    return {
      sampleSize: 0,
      averageScore: 0,
      medianScore: 0,
      minScore: 0,
      maxScore: 0,
      stdDev: 0,
      p10Score: 0,
      p90Score: 0,
      techniqueFrequency: {},
      hardestTechniqueDistribution: {},
      averageAssignmentCount: 0,
      averageEliminationCount: 0,
      averageTotalSteps: 0,
    };
  }

  const scores = entries.map((e) => e.score);
  const sorted = [...scores].sort((a, b) => a - b);
  const sum = scores.reduce((a, b) => a + b, 0);
  const mean = sum / n;

  const techniqueFrequency: Partial<Record<Technique, number>> = {};
  const hardestTechniqueDistribution: Partial<Record<Technique, number>> = {};
  let totalAssignments = 0;
  let totalEliminations = 0;
  let totalSteps = 0;

  for (const entry of entries) {
    for (const [tech, count] of Object.entries(entry.techniqueCounts)) {
      const t = tech as Technique;
      techniqueFrequency[t] = (techniqueFrequency[t] ?? 0) + count;
    }
    if (entry.hardestTechnique) {
      hardestTechniqueDistribution[entry.hardestTechnique] =
        (hardestTechniqueDistribution[entry.hardestTechnique] ?? 0) + 1;
    }
    totalAssignments += entry.assignmentCount;
    totalEliminations += entry.eliminationCount;
    totalSteps += entry.totalSteps;
  }

  return {
    sampleSize: n,
    averageScore: mean,
    medianScore: computeMedian(sorted),
    minScore: sorted[0]!,
    maxScore: sorted[n - 1]!,
    stdDev: computeStdDev(scores, mean),
    p10Score: computePercentile(sorted, 10),
    p90Score: computePercentile(sorted, 90),
    techniqueFrequency,
    hardestTechniqueDistribution,
    averageAssignmentCount: totalAssignments / n,
    averageEliminationCount: totalEliminations / n,
    averageTotalSteps: totalSteps / n,
  };
}

export function perSizeLabel(size: GridSize, difficulty: Difficulty): string {
  return `${size}\u00D7${size} ${difficulty}`;
}

export function runBenchmark(config: BenchmarkConfig): BenchmarkReport {
  const sizes = config.sizes ?? GRID_SIZES;
  const difficulties = config.difficulties ?? DIFFICULTY_LABELS;
  const stats: Record<string, PerDifficultyStats> = {};

  for (const size of sizes) {
    for (const difficulty of difficulties) {
      const entries: BenchmarkEntry[] = [];
      const boxSize = boxSizeFor(size);

      for (let i = 0; i < config.sampleSize; i++) {
        const generator = new SudokuGenerator({
          size,
          boxSize,
          difficulty,
          matchDifficulty: false,
          maxAttempts: 1,
        });
        const result = generator.generate();
        entries.push(createBenchmarkEntry(size, difficulty, result.analysis));
      }

      stats[perSizeLabel(size, difficulty)] = aggregateStats(entries);
    }
  }

  const thresholdRecommendation = recommendThresholds(stats, DIFFICULTY_THRESHOLDS);

  return {
    config,
    timestamp: new Date().toISOString(),
    stats,
    thresholdRecommendation,
  };
}

export function recommendThresholds(
  stats: Record<string, PerDifficultyStats>,
  currentThresholds: Record<Difficulty, number>
): ThresholdRecommendation {
  let distributionsOverlap = false;
  const perSizeDetails: string[] = [];

  const difficultyLabels = DIFFICULTY_LABELS;

  for (const size of GRID_SIZES) {
    const details: string[] = [];
    const label = `${size}\u00D7${size}`;
    details.push(`--- ${label} ---`);

    // Collect available per-difficulty stats for this size
    const tierStats: Array<{ label: string; stats: PerDifficultyStats }> = [];
    for (const d of difficultyLabels) {
      const key = perSizeLabel(size, d);
      const s = stats[key];
      if (s && s.sampleSize > 0) {
        tierStats.push({ label: d.charAt(0).toUpperCase() + d.slice(1), stats: s });
        details.push(`  ${d}: median=${s.medianScore.toFixed(1)}  p10=${s.p10Score.toFixed(1)}  p90=${s.p90Score.toFixed(1)}  min=${s.minScore}  max=${s.maxScore}`);
      }
    }

    // Check adjacent pairs for overlap
    for (let i = 0; i < tierStats.length - 1; i++) {
      const lower = tierStats[i]!;
      const upper = tierStats[i + 1]!;
      if (lower.stats.p90Score >= upper.stats.p10Score) {
        details.push(`  WARNING: ${lower.label} and ${upper.label} distributions overlap.`);
        distributionsOverlap = true;
      }
    }

    perSizeDetails.push(details.join("\n"));
  }

  // Build threshold recommendation from 9×9 data (primary calibration target)
  const nineByNineTiers: Array<{ difficulty: Difficulty; stats: PerDifficultyStats | undefined }> = [];
  for (const d of difficultyLabels) {
    nineByNineTiers.push({ difficulty: d, stats: stats[perSizeLabel(9, d)] });
  }

  const hasFullData = nineByNineTiers.every((t) => t.stats && t.stats.sampleSize > 0);

  let recommended: Record<Difficulty, number> | null = null;
  let reasoning: string;

  if (hasFullData) {
    const lines: string[] = [];
    let allGood = true;
    const newThresholds: Record<string, number> = {};

    for (let i = 0; i < nineByNineTiers.length - 1; i++) {
      const lower = nineByNineTiers[i]!;
      const upper = nineByNineTiers[i + 1]!;
      const ts = lower.stats!;
      const us = upper.stats!;
      const boundary = currentThresholds[lower.difficulty];
      const ok = boundary >= ts.p90Score && boundary < us.p10Score;

      if (!ok) {
        allGood = false;
        const recommendedBoundary = Math.ceil(Math.max(ts.p90Score, 1));
        newThresholds[lower.difficulty] = recommendedBoundary;
        lines.push(
          `  ${lower.difficulty}/${upper.difficulty}: current=${boundary}, recommended=${recommendedBoundary}` +
          ` (between ${lower.difficulty} p90=${ts.p90Score.toFixed(1)} and ${upper.difficulty} p10=${us.p10Score.toFixed(1)})`
        );
      } else {
        lines.push(`  ${lower.difficulty}/${upper.difficulty}: current=${boundary} — OK`);
        newThresholds[lower.difficulty] = boundary;
      }
    }

    // Keep the highest threshold unchanged (expert boundary or hard in 3-tier)
    const lastTier = nineByNineTiers[nineByNineTiers.length - 1]!;
    newThresholds[lastTier.difficulty] = currentThresholds[lastTier.difficulty];

    if (allGood) {
      reasoning = "Current thresholds adequately separate 9×9 difficulty distributions.\n" + lines.join("\n") + "\nNo changes recommended.";
    } else {
      recommended = newThresholds as Record<Difficulty, number>;
      reasoning = "Current thresholds do not align with 9×9 empirical distributions.\n" + lines.join("\n");
    }
  } else {
    reasoning = "Insufficient benchmark data to recommend threshold changes.";
  }

  return {
    current: { ...currentThresholds },
    recommended,
    reasoning,
    distributionsOverlap,
    perSizeAnalysis: perSizeDetails.join("\n\n"),
  };
}

export function formatBenchmarkReport(report: BenchmarkReport): string {
  const lines: string[] = [];
  lines.push("=".repeat(60));
  lines.push("SUDOKU DIFFICULTY CALIBRATION REPORT");
  lines.push("=".repeat(60));
  lines.push("");
  lines.push(`Timestamp: ${report.timestamp}`);
  lines.push(`Sample size: ${report.config.sampleSize} per configuration`);
  lines.push(`Configurations: ${Object.keys(report.stats).length}`);
  lines.push("");

  for (const [label, stats] of Object.entries(report.stats).sort()) {
    lines.push(`--- ${label} ---`);
    lines.push(`  Sample size:           ${stats.sampleSize}`);
    lines.push(`  Average score:         ${stats.averageScore.toFixed(2)}`);
    lines.push(`  Median score:          ${stats.medianScore.toFixed(2)}`);
    lines.push(`  Std dev:               ${stats.stdDev.toFixed(2)}`);
    lines.push(`  Min score:             ${stats.minScore}`);
    lines.push(`  Max score:             ${stats.maxScore}`);
    lines.push(`  P10 score:             ${stats.p10Score}`);
    lines.push(`  P90 score:             ${stats.p90Score}`);
    lines.push(`  Avg assignments:       ${stats.averageAssignmentCount.toFixed(2)}`);
    lines.push(`  Avg eliminations:      ${stats.averageEliminationCount.toFixed(2)}`);
    lines.push(`  Avg total steps:       ${stats.averageTotalSteps.toFixed(2)}`);
    lines.push(`  Technique frequency (avg uses × weight = avg score contribution):`);
    const sortedTechs = Object.entries(stats.techniqueFrequency)
      .sort(([, a], [, b]) => b - a);
    let totalAvgScore = 0;
    for (const [tech, count] of sortedTechs) {
      const avg = (count as number) / stats.sampleSize;
      const weight = TECHNIQUE_WEIGHTS[tech as keyof typeof TECHNIQUE_WEIGHTS] ?? 0;
      const contrib = avg * weight;
      totalAvgScore += contrib;
      lines.push(`    ${tech}: ${avg.toFixed(2)} × ${weight.toFixed(1)} = ${contrib.toFixed(2)}`);
    }
    lines.push(`    ─────────────────────────────`);
    lines.push(`    Total from techniques: ${totalAvgScore.toFixed(2)} (average score: ${stats.averageScore.toFixed(2)})`);
    lines.push(`  Hardest technique distribution:`);
    const sortedHardest = Object.entries(stats.hardestTechniqueDistribution)
      .sort(([, a], [, b]) => b - a);
    for (const [tech, count] of sortedHardest) {
      const pct = ((count as number) / stats.sampleSize * 100).toFixed(1);
      lines.push(`    ${tech}: ${pct}%`);
    }
    lines.push("");
  }

  lines.push("-".repeat(60));
  lines.push("THRESHOLD RECOMMENDATION");
  lines.push("-".repeat(60));
  lines.push("");
  lines.push(`Overlap detected: ${report.thresholdRecommendation.distributionsOverlap}`);
  lines.push("");
  lines.push("Per-size analysis:");
  lines.push(report.thresholdRecommendation.perSizeAnalysis);
  lines.push("");
  lines.push("Current thresholds:");
  for (const [d, t] of Object.entries(report.thresholdRecommendation.current)) {
    lines.push(`  ${d}: ${t}`);
  }
  if (report.thresholdRecommendation.recommended) {
    lines.push("Recommended thresholds:");
    for (const [d, t] of Object.entries(report.thresholdRecommendation.recommended)) {
      lines.push(`  ${d}: ${t}`);
    }
  }
  lines.push("");
  lines.push("Reasoning:");
  lines.push(report.thresholdRecommendation.reasoning);

  return lines.join("\n");
}
