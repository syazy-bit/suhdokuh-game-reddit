import { describe, it, expect } from "vitest";
import {
  computeMedian,
  computeStdDev,
  computePercentile,
  aggregateStats,
  recommendThresholds,
  createBenchmarkEntry,
  perSizeLabel,
  type BenchmarkEntry,
  type PerDifficultyStats,
} from "./DifficultyCalibration";
import { createEmptyAnalysis } from "./DifficultyAnalyzer";
import type { Technique } from "./HumanSolverTypes";

import { SudokuGenerator } from "./SudokuGenerator";

// ── Synthetic data helpers ──────────────────────────────────────────────────

function makeEntry(overrides: Partial<BenchmarkEntry> & { score: number }): BenchmarkEntry {
  return {
    size: overrides.size ?? 9,
    requestedDifficulty: overrides.requestedDifficulty ?? "easy",
    actualDifficulty: overrides.actualDifficulty ?? "easy",
    score: overrides.score,
    hardestTechnique: overrides.hardestTechnique ?? null,
    techniqueCounts: overrides.techniqueCounts ?? {},
    assignmentCount: overrides.assignmentCount ?? 0,
    eliminationCount: overrides.eliminationCount ?? 0,
    totalSteps: overrides.totalSteps ?? 0,
  };
}

// ── Utility function tests ──────────────────────────────────────────────────

describe("computeMedian", () => {
  it("returns 0 for empty array", () => {
    expect(computeMedian([])).toBe(0);
  });

  it("returns the middle value for odd-length sorted arrays", () => {
    expect(computeMedian([1, 5, 10])).toBe(5);
  });

  it("returns the average of two middle values for even-length arrays", () => {
    expect(computeMedian([1, 5, 10, 20])).toBe(7.5);
  });

  it("works with a single element", () => {
    expect(computeMedian([42])).toBe(42);
  });

  it("works with unsorted input (caller must sort)", () => {
    // We pass pre-sorted as required
    expect(computeMedian([1, 2, 3, 4, 5])).toBe(3);
  });
});

describe("computeStdDev", () => {
  it("returns 0 for empty array", () => {
    expect(computeStdDev([], 0)).toBe(0);
  });

  it("returns 0 when all values equal the mean", () => {
    expect(computeStdDev([5, 5, 5], 5)).toBe(0);
  });

  it("computes correct standard deviation", () => {
    const scores = [2, 4, 4, 4, 5, 5, 7, 9];
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const stdDev = computeStdDev(scores, mean);
    expect(stdDev).toBeCloseTo(2.0, 1);
  });

  it("handles single element", () => {
    expect(computeStdDev([10], 10)).toBe(0);
  });
});

describe("computePercentile", () => {
  it("returns 0 for empty array", () => {
    expect(computePercentile([], 50)).toBe(0);
  });

  it("computes the correct percentile", () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(computePercentile(sorted, 10)).toBe(1); // 10th percentile = 1st element
    expect(computePercentile(sorted, 50)).toBe(5); // median
    expect(computePercentile(sorted, 90)).toBe(9); // 90th percentile
  });

  it("clamps to first element for very low percentiles", () => {
    expect(computePercentile([10, 20], 1)).toBe(10);
  });
});

// ── aggregateStats tests ────────────────────────────────────────────────────

describe("aggregateStats", () => {
  it("returns zeroed stats for empty input", () => {
    const stats = aggregateStats([]);
    expect(stats.sampleSize).toBe(0);
    expect(stats.averageScore).toBe(0);
    expect(stats.medianScore).toBe(0);
    expect(stats.stdDev).toBe(0);
    expect(stats.minScore).toBe(0);
    expect(stats.maxScore).toBe(0);
    expect(stats.techniqueFrequency).toEqual({});
    expect(stats.hardestTechniqueDistribution).toEqual({});
  });

  it("computes correct stats for single entry", () => {
    const entries = [
      makeEntry({
        score: 10,
        hardestTechnique: "Naked Single",
        techniqueCounts: { "Naked Single": 5 },
        assignmentCount: 3,
        eliminationCount: 2,
        totalSteps: 5,
      }),
    ];
    const stats = aggregateStats(entries);
    expect(stats.sampleSize).toBe(1);
    expect(stats.averageScore).toBe(10);
    expect(stats.medianScore).toBe(10);
    expect(stats.minScore).toBe(10);
    expect(stats.maxScore).toBe(10);
    expect(stats.stdDev).toBe(0);
    expect(stats.techniqueFrequency).toEqual({ "Naked Single": 5 });
    expect(stats.hardestTechniqueDistribution).toEqual({ "Naked Single": 1 });
    expect(stats.averageAssignmentCount).toBe(3);
    expect(stats.averageEliminationCount).toBe(2);
    expect(stats.averageTotalSteps).toBe(5);
  });

  it("aggregates multiple entries correctly", () => {
    const entries = [
      makeEntry({ score: 5, techniqueCounts: { "Naked Single": 3 }, assignmentCount: 3, eliminationCount: 0, totalSteps: 3 }),
      makeEntry({ score: 15, techniqueCounts: { "Hidden Single": 2 }, assignmentCount: 1, eliminationCount: 1, totalSteps: 2 }),
      makeEntry({ score: 10, techniqueCounts: { "Naked Single": 1, "Hidden Single": 1 }, assignmentCount: 1, eliminationCount: 1, totalSteps: 2 }),
    ];
    const stats = aggregateStats(entries);
    expect(stats.sampleSize).toBe(3);
    expect(stats.averageScore).toBe(10);
    expect(stats.medianScore).toBe(10);
    expect(stats.minScore).toBe(5);
    expect(stats.maxScore).toBe(15);
    expect(stats.techniqueFrequency).toEqual({ "Naked Single": 4, "Hidden Single": 3 });
    expect(stats.averageAssignmentCount).toBeCloseTo(5 / 3, 5);
    expect(stats.averageEliminationCount).toBeCloseTo(2 / 3, 5);
    expect(stats.averageTotalSteps).toBeCloseTo(7 / 3, 5);
  });

  it("computes standard deviation across entries", () => {
    const entries = [
      makeEntry({ score: 10 }),
      makeEntry({ score: 20 }),
      makeEntry({ score: 30 }),
    ];
    const stats = aggregateStats(entries);
    expect(stats.averageScore).toBe(20);
    expect(stats.stdDev).toBeCloseTo(Math.sqrt((100 + 0 + 100) / 3), 5);
  });

  it("hardestTechnique distribution counts only non-null values", () => {
    const entries = [
      makeEntry({ score: 5, hardestTechnique: null }),
      makeEntry({ score: 10, hardestTechnique: "Naked Single" }),
      makeEntry({ score: 15, hardestTechnique: "Hidden Single" }),
      makeEntry({ score: 20, hardestTechnique: "Naked Single" }),
    ];
    const stats = aggregateStats(entries);
    expect(stats.hardestTechniqueDistribution).toEqual({
      "Naked Single": 2,
      "Hidden Single": 1,
    });
  });

  it("computes percentile scores", () => {
    const entries = Array.from({ length: 10 }, (_, i) => makeEntry({ score: i + 1 }));
    const stats = aggregateStats(entries);
    expect(stats.p10Score).toBe(1);
    expect(stats.p90Score).toBe(9);
  });
});

// ── createBenchmarkEntry tests ──────────────────────────────────────────────

describe("createBenchmarkEntry", () => {
  it("copies analysis fields into a benchmark entry", () => {
    const analysis = createEmptyAnalysis();
    analysis.score = 15;
    analysis.difficulty = "medium";
    analysis.hardestTechnique = "Hidden Pair";
    analysis.techniqueCounts = { "Naked Single": 3, "Hidden Pair": 1 };
    analysis.assignmentCount = 2;
    analysis.eliminationCount = 2;
    analysis.totalSteps = 4;

    const entry = createBenchmarkEntry(9, "medium", analysis);
    expect(entry.size).toBe(9);
    expect(entry.requestedDifficulty).toBe("medium");
    expect(entry.actualDifficulty).toBe("medium");
    expect(entry.score).toBe(15);
    expect(entry.hardestTechnique).toBe("Hidden Pair");
    expect(entry.techniqueCounts).toEqual({ "Naked Single": 3, "Hidden Pair": 1 });
    expect(entry.assignmentCount).toBe(2);
    expect(entry.eliminationCount).toBe(2);
    expect(entry.totalSteps).toBe(4);
  });
});

// ── recommendThresholds tests ───────────────────────────────────────────────

describe("recommendThresholds", () => {
  const currentThresholds: Record<string, number> = { easy: 30, medium: 52, hard: 75, expert: 100 };

  function makeStats(
    median: number,
    min: number,
    max: number,
    p10: number,
    p90: number,
    sampleSize = 100
  ): PerDifficultyStats {
    return {
      sampleSize,
      averageScore: median,
      medianScore: median,
      minScore: min,
      maxScore: max,
      stdDev: (max - min) / 4,
      p10Score: p10,
      p90Score: p90,
      techniqueFrequency: {},
      hardestTechniqueDistribution: {},
      averageAssignmentCount: 0,
      averageEliminationCount: 0,
      averageTotalSteps: 0,
    };
  }

  it("reports overlap when easy p90 >= medium p10 for 9×9", () => {
    const stats: Record<string, PerDifficultyStats> = {
      "9×9 easy": makeStats(15, 5, 35, 8, 32),
      "9×9 medium": makeStats(35, 28, 50, 30, 45),
      "9×9 hard": makeStats(60, 40, 90, 45, 80),
      "9×9 expert": makeStats(110, 90, 150, 95, 140),
    };
    const result = recommendThresholds(stats, currentThresholds);
    // Easy p90=32 >= Medium p10=30 → overlap
    expect(result.distributionsOverlap).toBe(true);
  });

  it("recommends no changes if current thresholds separate distributions well", () => {
    // With thresholds at easy=30, medium=52, hard=75, expert=100:
    // Easy:   P90=28 < 30
    // Medium: p10=35 > 30, p90=49 < 52
    // Hard:   p10=55 > 52, p90=73 < 75
    // Expert: p10=78 > 75
    const stats: Record<string, PerDifficultyStats> = {
      "4×4 easy": makeStats(6, 4, 8, 5, 7, 100),
      "4×4 medium": makeStats(8, 6, 10, 7, 9, 100),
      "4×4 hard": makeStats(10, 8, 14, 9, 12, 100),
      "4×4 expert": makeStats(12, 10, 16, 11, 14, 100),
      "9×9 easy": makeStats(20, 10, 30, 12, 28, 100),
      "9×9 medium": makeStats(42, 33, 51, 35, 49, 100),
      "9×9 hard": makeStats(62, 53, 75, 55, 73, 100),
      "9×9 expert": makeStats(85, 76, 120, 78, 110, 100),
    };
    const result = recommendThresholds(stats, currentThresholds);
    expect(result.recommended).toBeNull();
  });

  it("suggests adjusted thresholds when distributions shifted", () => {
    // Easy P90=48 > 30 → easy threshold needs to increase
    const stats: Record<string, PerDifficultyStats> = {
      "4×4 easy": makeStats(6, 4, 8, 5, 7),
      "4×4 medium": makeStats(8, 6, 10, 7, 9),
      "4×4 hard": makeStats(10, 8, 14, 9, 12),
      "4×4 expert": makeStats(12, 10, 16, 11, 14),
      "9×9 easy": makeStats(40, 25, 55, 28, 48),
      "9×9 medium": makeStats(58, 45, 70, 48, 65),
      "9×9 hard": makeStats(78, 65, 95, 68, 88),
      "9×9 expert": makeStats(105, 90, 140, 95, 130),
    };
    const result = recommendThresholds(stats, currentThresholds);
    // Easy P90=48 > 30 → needs adjustment
    expect(result.recommended).not.toBeNull();
    if (result.recommended) {
      expect(result.recommended.easy).toBeGreaterThanOrEqual(48);
    }
  });

  it("handles missing size data gracefully", () => {
    const stats: Record<string, PerDifficultyStats> = {
      "9×9 easy": makeStats(8, 4, 12, 5, 10),
    };
    const result = recommendThresholds(stats, currentThresholds);
    expect(result.recommended).toBeNull();
    expect(result.reasoning).toContain("Insufficient");
  });

  it("does not recommend change when current thresholds already reflect data", () => {
    // All tiers cleanly separated by current thresholds
    const stats: Record<string, PerDifficultyStats> = {
      "4×4 easy": makeStats(6, 4, 8, 5, 7),
      "4×4 medium": makeStats(8, 6, 10, 7, 9),
      "4×4 hard": makeStats(10, 8, 14, 9, 12),
      "4×4 expert": makeStats(12, 10, 16, 11, 14),
      "9×9 easy": makeStats(15, 5, 28, 8, 25),
      "9×9 medium": makeStats(40, 32, 52, 34, 48),
      "9×9 hard": makeStats(62, 53, 75, 55, 70),
      "9×9 expert": makeStats(85, 76, 120, 78, 110),
    };
    const result = recommendThresholds(stats, currentThresholds);
    expect(result.recommended).toBeNull();
  });
});

// ── Integration with generator (small sample) ───────────────────────────────

describe("Benchmark integration (small sample)", () => {
  it("generates benchmark entries with valid analysis", () => {
    const gen = new SudokuGenerator({ size: 9, boxSize: 3, difficulty: "easy", matchDifficulty: false });
    const result = gen.generate();
    const entry = createBenchmarkEntry(9, "easy", result.analysis);
    expect(entry.score).toBeGreaterThan(0);
    expect(entry.size).toBe(9);
    expect(entry.requestedDifficulty).toBe("easy");
    expect(entry.actualDifficulty).toBe("easy");
  });

  it("aggregates stats across multiple entries deterministically", () => {
    const entries: BenchmarkEntry[] = [];
    for (let i = 0; i < 5; i++) {
      const gen = new SudokuGenerator({ size: 9, boxSize: 3, difficulty: "easy", matchDifficulty: false });
      const result = gen.generate();
      entries.push(createBenchmarkEntry(9, "easy", result.analysis));
    }
    const stats = aggregateStats(entries);
    expect(stats.sampleSize).toBe(5);
    expect(stats.averageScore).toBeGreaterThan(0);
    expect(stats.minScore).toBeGreaterThan(0);
    expect(stats.maxScore).toBeGreaterThanOrEqual(stats.minScore);
    expect(stats.medianScore).toBeGreaterThan(0);
  });
});

// ── Expert calibration tests (Phase 5.6.3) ──────────────────────────────────

describe("Expert calibration", () => {
  it("generates Expert benchmark entries for 9×9 with valid analysis", () => {
    const gen = new SudokuGenerator({
      size: 9, boxSize: 3, difficulty: "expert", matchDifficulty: false,
    });
    const result = gen.generate();
    const entry = createBenchmarkEntry(9, "expert", result.analysis);
    expect(entry.score).toBeGreaterThan(0);
    expect(entry.size).toBe(9);
    expect(entry.requestedDifficulty).toBe("expert");
  });

  it("recommends threshold changes when 9×9 expert P90 overlaps with hard P10", () => {
    const currentThresholds: Record<string, number> = {
      easy: 30, medium: 52, hard: 75, expert: 100,
    };
    const stats: Record<string, PerDifficultyStats> = {
      "9×9 easy": {
        sampleSize: 50, averageScore: 30, medianScore: 30,
        minScore: 30, maxScore: 33, stdDev: 0.5,
        p10Score: 30, p90Score: 30,
        techniqueFrequency: {}, hardestTechniqueDistribution: {},
        averageAssignmentCount: 30, averageEliminationCount: 0, averageTotalSteps: 30,
      },
      "9×9 medium": {
        sampleSize: 50, averageScore: 47, medianScore: 46,
        minScore: 26, maxScore: 83, stdDev: 7,
        p10Score: 46, p90Score: 51,
        techniqueFrequency: {}, hardestTechniqueDistribution: {},
        averageAssignmentCount: 44, averageEliminationCount: 0.5, averageTotalSteps: 44,
      },
      "9×9 hard": {
        sampleSize: 50, averageScore: 53, medianScore: 53,
        minScore: 31, maxScore: 72, stdDev: 6,
        p10Score: 46.5, p90Score: 58,
        techniqueFrequency: {}, hardestTechniqueDistribution: {},
        averageAssignmentCount: 46, averageEliminationCount: 0.8, averageTotalSteps: 47,
      },
      "9×9 expert": {
        sampleSize: 50, averageScore: 55, medianScore: 55,
        minScore: 17.5, maxScore: 75.5, stdDev: 9,
        p10Score: 48.5, p90Score: 64.5,
        techniqueFrequency: {}, hardestTechniqueDistribution: {},
        averageAssignmentCount: 48, averageEliminationCount: 1, averageTotalSteps: 49,
      },
    };
    const result = recommendThresholds(stats, currentThresholds);
    expect(result.distributionsOverlap).toBe(true);
    expect(result.recommended).not.toBeNull();
  });

  it("keeps current thresholds for 9×9 when empirical distributions are cleanly separated by matchDifficulty", () => {
    // When puzzles are generated WITH matchDifficulty, the distributions
    // have wider spread and overlap, so the calibration system will
    // recommend changes — but the current thresholds remain valid for
    // actual difficulty classification via difficultyFromScore.
    const currentThresholds: Record<string, number> = {
      easy: 30, medium: 52, hard: 75, expert: 100,
    };
    const stats: Record<string, PerDifficultyStats> = {
      "9×9 easy": {
        sampleSize: 50, averageScore: 22, medianScore: 22,
        minScore: 18, maxScore: 30, stdDev: 2,
        p10Score: 20, p90Score: 28,
        techniqueFrequency: {}, hardestTechniqueDistribution: {},
        averageAssignmentCount: 22, averageEliminationCount: 0, averageTotalSteps: 22,
      },
      "9×9 medium": {
        sampleSize: 50, averageScore: 40, medianScore: 40,
        minScore: 32, maxScore: 50, stdDev: 4,
        p10Score: 34, p90Score: 48,
        techniqueFrequency: {}, hardestTechniqueDistribution: {},
        averageAssignmentCount: 38, averageEliminationCount: 0.3, averageTotalSteps: 38,
      },
      "9×9 hard": {
        sampleSize: 50, averageScore: 60, medianScore: 60,
        minScore: 53, maxScore: 73, stdDev: 5,
        p10Score: 55, p90Score: 70,
        techniqueFrequency: {}, hardestTechniqueDistribution: {},
        averageAssignmentCount: 55, averageEliminationCount: 0.6, averageTotalSteps: 56,
      },
      "9×9 expert": {
        sampleSize: 50, averageScore: 82, medianScore: 80,
        minScore: 76, maxScore: 95, stdDev: 5,
        p10Score: 77, p90Score: 90,
        techniqueFrequency: {}, hardestTechniqueDistribution: {},
        averageAssignmentCount: 60, averageEliminationCount: 2, averageTotalSteps: 62,
      },
    };
    const result = recommendThresholds(stats, currentThresholds);
    // With clean separation, recommended stays null
    expect(result.recommended).toBeNull();
  });
});
