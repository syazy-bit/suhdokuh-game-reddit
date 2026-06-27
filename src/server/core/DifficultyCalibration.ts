import { SudokuGenerator, type GridSize } from "./SudokuGenerator";
import { DIFFICULTY_THRESHOLDS, type AnalysisResult, type Difficulty } from "./DifficultyAnalyzer";
import type { Technique } from "./HumanSolverTypes";

export const DIFFICULTY_LABELS: Difficulty[] = ["easy", "medium", "hard"];
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
  const sortedKeys4 = GRID_SIZES[0]!;
  const sortedKeys9 = GRID_SIZES[1]!;

  const easy4 = stats[perSizeLabel(sortedKeys4, "easy")];
  const medium4 = stats[perSizeLabel(sortedKeys4, "medium")];
  const hard4 = stats[perSizeLabel(sortedKeys4, "hard")];
  const easy9 = stats[perSizeLabel(sortedKeys9, "easy")];
  const medium9 = stats[perSizeLabel(sortedKeys9, "medium")];
  const hard9 = stats[perSizeLabel(sortedKeys9, "hard")];

  const lines: string[] = [];
  let distributionsOverlap = false;
  const perSizeDetails: string[] = [];

  const analyzeSize = (label: string, easy: PerDifficultyStats | undefined, medium: PerDifficultyStats | undefined, hard: PerDifficultyStats | undefined) => {
    const details: string[] = [];
    details.push(`--- ${label} ---`);

    if (easy && easy.sampleSize > 0) {
      details.push(`  Easy:   median=${easy.medianScore.toFixed(1)}  p10=${easy.p10Score.toFixed(1)}  p90=${easy.p90Score.toFixed(1)}  min=${easy.minScore}  max=${easy.maxScore}`);
    }
    if (medium && medium.sampleSize > 0) {
      details.push(`  Medium: median=${medium.medianScore.toFixed(1)}  p10=${medium.p10Score.toFixed(1)}  p90=${medium.p90Score.toFixed(1)}  min=${medium.minScore}  max=${medium.maxScore}`);
    }
    if (hard && hard.sampleSize > 0) {
      details.push(`  Hard:   median=${hard.medianScore.toFixed(1)}  p10=${hard.p10Score.toFixed(1)}  p90=${hard.p90Score.toFixed(1)}  min=${hard.minScore}  max=${hard.maxScore}`);
    }

    // Check overlap
    if (easy && medium && easy.sampleSize > 0 && medium.sampleSize > 0) {
      if (easy.p90Score >= medium.p10Score) {
        details.push("  WARNING: Easy and Medium distributions overlap.");
        distributionsOverlap = true;
      }
    }
    if (medium && hard && medium.sampleSize > 0 && hard.sampleSize > 0) {
      if (medium.p90Score >= hard.p10Score) {
        details.push("  WARNING: Medium and Hard distributions overlap.");
        distributionsOverlap = true;
      }
    }

    perSizeDetails.push(details.join("\n"));
  };

  analyzeSize("4×4", easy4, medium4, hard4);
  analyzeSize("9×9", easy9, medium9, hard9);

  lines.push(perSizeDetails.join("\n\n"));

  // Determine if thresholds should change
  const hasFullData = easy9 && medium9 && hard9 && easy9.sampleSize > 0 && medium9.sampleSize > 0 && hard9.sampleSize > 0;

  let recommended: Record<Difficulty, number> | null = null;
  let reasoning: string;

  if (hasFullData) {
    // Analyze 9×9 for threshold gaps
    // The medium/hard boundary should be between medium max and hard min (or close)
    const medium9p90 = medium9.p90Score;
    const hard9p10 = hard9.p10Score;
    const easy9p90 = easy9.p90Score;
    const medium9p10 = medium9.p10Score;

    // Check if current thresholds separate the distributions well
    const easyMediumOk = currentThresholds.easy >= easy9p90 && currentThresholds.easy < medium9p10;
    const mediumHardOk = currentThresholds.medium >= medium9p90 && currentThresholds.medium < hard9p10;

    if (easyMediumOk && mediumHardOk) {
      reasoning = `Current thresholds adequately separate 9×9 difficulty distributions.\nEasy/Medium boundary (${currentThresholds.easy}) sits between 9×9 Easy p90 (${easy9p90.toFixed(1)}) and 9×9 Medium p10 (${medium9p10.toFixed(1)}).\nMedium/Hard boundary (${currentThresholds.medium}) sits between 9×9 Medium p90 (${medium9p90.toFixed(1)}) and 9×9 Hard p10 (${hard9p10.toFixed(1)}).\nNo changes recommended.`;
    } else {
      // Suggest improved boundaries
      const newEasy = Math.max(easy9p90, 1);
      const newMedium = Math.max(medium9p90, newEasy + 1);

      if (newEasy !== currentThresholds.easy || newMedium !== currentThresholds.medium) {
        recommended = { easy: Math.ceil(newEasy), medium: Math.ceil(newMedium), hard: 60 };
        reasoning = `Current thresholds (easy=${currentThresholds.easy}, medium=${currentThresholds.medium}) ` +
          `do not align with 9×9 empirical distributions.\n` +
          `Recommended: easy=${recommended.easy} (between Easy p90=${easy9p90.toFixed(1)} and Medium p10=${medium9p10.toFixed(1)}), ` +
          `medium=${recommended.medium} (between Medium p90=${medium9p90.toFixed(1)} and Hard p10=${hard9p10.toFixed(1)}).`;
      } else {
        reasoning = `Recommended thresholds match current values. No changes needed.`;
      }
    }
  } else {
    reasoning = "Insufficient benchmark data to recommend threshold changes.";
  }

  lines.unshift(`Overlap detected: ${distributionsOverlap}`);

  return {
    current: { ...currentThresholds },
    recommended,
    reasoning: reasoning,
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
    lines.push(`  Technique frequency:`);
    const sortedTechs = Object.entries(stats.techniqueFrequency)
      .sort(([, a], [, b]) => b - a);
    for (const [tech, count] of sortedTechs) {
      const avg = (count as number) / stats.sampleSize;
      lines.push(`    ${tech}: ${avg.toFixed(2)} avg uses per puzzle`);
    }
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
