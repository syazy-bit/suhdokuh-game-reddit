import { describe, it, expect } from "vitest";
import {
  DIFFICULTIES,
  TECHNIQUE_WEIGHTS,
  DIFFICULTY_THRESHOLDS,
  createEmptyAnalysis,
  difficultyFromScore,
  type AnalysisResult,
  type Difficulty,
} from "./DifficultyAnalyzer";

// ── Difficulty model ──

describe("DIFFICULTIES", () => {
  it("contains exactly easy, medium, hard", () => {
    expect(DIFFICULTIES).toEqual(["easy", "medium", "hard"]);
  });

  it("has 3 entries matching the public game difficulties", () => {
    expect(DIFFICULTIES).toHaveLength(3);
  });
});

// ── Technique weight mapping ──

describe("TECHNIQUE_WEIGHTS", () => {
  it("includes all implemented solving techniques", () => {
    expect(TECHNIQUE_WEIGHTS).toHaveProperty("Naked Single");
    expect(TECHNIQUE_WEIGHTS).toHaveProperty("Hidden Single");
    expect(TECHNIQUE_WEIGHTS).toHaveProperty("Naked Pair");
    expect(TECHNIQUE_WEIGHTS).toHaveProperty("Hidden Pair");
    expect(TECHNIQUE_WEIGHTS).toHaveProperty("Pointing Pair");
    expect(TECHNIQUE_WEIGHTS).toHaveProperty("Claiming Pair");
    expect(TECHNIQUE_WEIGHTS).toHaveProperty("X-Wing");
  });

  it("has exactly 7 technique entries", () => {
    expect(Object.keys(TECHNIQUE_WEIGHTS)).toHaveLength(7);
  });

  it("has positive numeric weights", () => {
    for (const weight of Object.values(TECHNIQUE_WEIGHTS)) {
      expect(typeof weight).toBe("number");
      expect(weight).toBeGreaterThan(0);
    }
  });

  it("orders weights from easiest to hardest technique", () => {
    const weights = Object.values(TECHNIQUE_WEIGHTS);
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]!).toBeGreaterThanOrEqual(weights[i - 1]!);
    }
  });
});

// ── Threshold constants ──

describe("DIFFICULTY_THRESHOLDS", () => {
  it("has entries for easy, medium, and hard", () => {
    expect(DIFFICULTY_THRESHOLDS).toHaveProperty("easy");
    expect(DIFFICULTY_THRESHOLDS).toHaveProperty("medium");
    expect(DIFFICULTY_THRESHOLDS).toHaveProperty("hard");
  });

  it("has exactly 3 difficulty entries", () => {
    expect(Object.keys(DIFFICULTY_THRESHOLDS)).toHaveLength(3);
  });

  it("has non-negative thresholds", () => {
    for (const threshold of Object.values(DIFFICULTY_THRESHOLDS)) {
      expect(typeof threshold).toBe("number");
      expect(threshold).toBeGreaterThanOrEqual(0);
    }
  });

  it("has increasing thresholds: easy < medium < hard", () => {
    expect(DIFFICULTY_THRESHOLDS.easy).toBeLessThan(DIFFICULTY_THRESHOLDS.medium);
    expect(DIFFICULTY_THRESHOLDS.medium).toBeLessThan(DIFFICULTY_THRESHOLDS.hard);
  });
});

// ── AnalysisResult construction ──

describe("AnalysisResult", () => {
  it("can be constructed with all required fields", () => {
    const result: AnalysisResult = {
      score: 42,
      difficulty: "medium",
      hardestTechnique: "X-Wing",
      techniqueCounts: { "Naked Single": 10, "Hidden Single": 5 },
    };
    expect(result.score).toBe(42);
    expect(result.difficulty).toBe("medium");
    expect(result.hardestTechnique).toBe("X-Wing");
    expect(result.techniqueCounts["Naked Single"]).toBe(10);
    expect(result.techniqueCounts["Hidden Single"]).toBe(5);
  });

  it("accepts extra fields without breaking (future compat)", () => {
    const result: AnalysisResult & { statistics?: Record<string, unknown> } = {
      score: 10,
      difficulty: "easy",
      hardestTechnique: "Naked Single",
      techniqueCounts: {},
    };
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("difficulty");
    expect(result).toHaveProperty("hardestTechnique");
    expect(result).toHaveProperty("techniqueCounts");
  });
});

// ── Empty / default analysis state ──

describe("createEmptyAnalysis", () => {
  it("returns a valid AnalysisResult", () => {
    const result = createEmptyAnalysis();
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("difficulty");
    expect(result).toHaveProperty("hardestTechnique");
    expect(result).toHaveProperty("techniqueCounts");
  });

  it("returns a score of 0", () => {
    expect(createEmptyAnalysis().score).toBe(0);
  });

  it("defaults to easy difficulty", () => {
    expect(createEmptyAnalysis().difficulty).toBe("easy");
  });

  it("returns null hardestTechnique when no analysis has been performed", () => {
    expect(createEmptyAnalysis().hardestTechnique).toBeNull();
  });

  it("returns empty techniqueCounts", () => {
    expect(createEmptyAnalysis().techniqueCounts).toEqual({});
  });
});

// ── difficultyFromScore ──

describe("difficultyFromScore", () => {
  it("returns easy for scores at or below the easy threshold", () => {
    expect(difficultyFromScore(0)).toBe("easy");
    expect(difficultyFromScore(5)).toBe("easy");
    expect(difficultyFromScore(10)).toBe("easy");
  });

  it("returns medium for scores between easy and medium thresholds", () => {
    expect(difficultyFromScore(11)).toBe("medium");
    expect(difficultyFromScore(20)).toBe("medium");
    expect(difficultyFromScore(30)).toBe("medium");
  });

  it("returns hard for scores above the medium threshold", () => {
    expect(difficultyFromScore(31)).toBe("hard");
    expect(difficultyFromScore(60)).toBe("hard");
    expect(difficultyFromScore(100)).toBe("hard");
  });
});
