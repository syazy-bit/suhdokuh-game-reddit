import { describe, it, expect } from "vitest";
import {
  DIFFICULTIES,
  TECHNIQUE_WEIGHTS,
  DIFFICULTY_THRESHOLDS,
  createEmptyAnalysis,
  difficultyFromScore,
  analyzeSolveResult,
  type AnalysisResult,
  type Difficulty,
} from "./DifficultyAnalyzer";
import type { SolveResult } from "./HumanSolverPipeline";
import type { LogicalMove } from "./HumanSolver";
import { TECHNIQUE_PRIORITY, type Technique } from "./HumanSolverTypes";

function assignmentMove(technique: Technique): LogicalMove {
  return { type: "assignment", technique, row: 0, col: 0, value: 1 };
}

function eliminationMove(technique: Technique): LogicalMove {
  return {
    type: "elimination",
    technique,
    patternCells: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
    eliminations: [{ row: 0, col: 2, value: 1 }],
  };
}

function makeSolveResult(moves: LogicalMove[]): SolveResult {
  return {
    solved: moves.length > 0,
    finalBoard: [],
    moves,
    techniquesUsed: [...new Set(moves.map((m) => m.technique))],
    hardestTechnique: null,
  };
}

// ── Difficulty model ──

describe("DIFFICULTIES", () => {
  it("contains exactly easy, medium, hard, expert", () => {
    expect(DIFFICULTIES).toEqual(["easy", "medium", "hard", "expert"]);
  });

  it("has 4 entries matching the public game difficulties", () => {
    expect(DIFFICULTIES).toHaveLength(4);
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
    expect(TECHNIQUE_WEIGHTS).toHaveProperty("Skyscraper");
    expect(TECHNIQUE_WEIGHTS).toHaveProperty("XY-Wing");
    expect(TECHNIQUE_WEIGHTS).toHaveProperty("Swordfish");
  });

  it("has exactly 10 technique entries", () => {
    expect(Object.keys(TECHNIQUE_WEIGHTS)).toHaveLength(10);
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
  it("has entries for easy, medium, hard, expert", () => {
    expect(DIFFICULTY_THRESHOLDS).toHaveProperty("easy");
    expect(DIFFICULTY_THRESHOLDS).toHaveProperty("medium");
    expect(DIFFICULTY_THRESHOLDS).toHaveProperty("hard");
    expect(DIFFICULTY_THRESHOLDS).toHaveProperty("expert");
  });

  it("has exactly 4 difficulty entries", () => {
    expect(Object.keys(DIFFICULTY_THRESHOLDS)).toHaveLength(4);
  });

  it("has non-negative thresholds", () => {
    for (const threshold of Object.values(DIFFICULTY_THRESHOLDS)) {
      expect(typeof threshold).toBe("number");
      expect(threshold).toBeGreaterThanOrEqual(0);
    }
  });

  it("has increasing thresholds: easy < medium < hard < expert", () => {
    expect(DIFFICULTY_THRESHOLDS.easy).toBeLessThan(DIFFICULTY_THRESHOLDS.medium);
    expect(DIFFICULTY_THRESHOLDS.medium).toBeLessThan(DIFFICULTY_THRESHOLDS.hard);
    expect(DIFFICULTY_THRESHOLDS.hard).toBeLessThan(DIFFICULTY_THRESHOLDS.expert);
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
      assignmentCount: 8,
      eliminationCount: 4,
      totalSteps: 12,
    };
    expect(result.score).toBe(42);
    expect(result.difficulty).toBe("medium");
    expect(result.hardestTechnique).toBe("X-Wing");
    expect(result.techniqueCounts["Naked Single"]).toBe(10);
    expect(result.techniqueCounts["Hidden Single"]).toBe(5);
    expect(result.assignmentCount).toBe(8);
    expect(result.eliminationCount).toBe(4);
    expect(result.totalSteps).toBe(12);
  });

  it("accepts extra fields without breaking (future compat)", () => {
    const result: AnalysisResult & { statistics?: Record<string, unknown> } = {
      score: 10,
      difficulty: "easy",
      hardestTechnique: "Naked Single",
      techniqueCounts: {},
      assignmentCount: 0,
      eliminationCount: 0,
      totalSteps: 0,
    };
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("difficulty");
    expect(result).toHaveProperty("hardestTechnique");
    expect(result).toHaveProperty("techniqueCounts");
    expect(result).toHaveProperty("assignmentCount");
    expect(result).toHaveProperty("eliminationCount");
    expect(result).toHaveProperty("totalSteps");
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
    expect(result).toHaveProperty("assignmentCount");
    expect(result).toHaveProperty("eliminationCount");
    expect(result).toHaveProperty("totalSteps");
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

  it("returns assignmentCount of 0", () => {
    expect(createEmptyAnalysis().assignmentCount).toBe(0);
  });

  it("returns eliminationCount of 0", () => {
    expect(createEmptyAnalysis().eliminationCount).toBe(0);
  });

  it("returns totalSteps of 0", () => {
    expect(createEmptyAnalysis().totalSteps).toBe(0);
  });
});

// ── difficultyFromScore ──

describe("difficultyFromScore", () => {
  it("returns easy for scores at or below the easy threshold", () => {
    expect(difficultyFromScore(0)).toBe("easy");
    expect(difficultyFromScore(15)).toBe("easy");
    expect(difficultyFromScore(30)).toBe("easy");
  });

  it("returns medium for scores between easy and medium thresholds", () => {
    expect(difficultyFromScore(31)).toBe("medium");
    expect(difficultyFromScore(40)).toBe("medium");
    expect(difficultyFromScore(52)).toBe("medium");
  });

  it("returns hard for scores between medium and hard thresholds", () => {
    expect(difficultyFromScore(53)).toBe("hard");
    expect(difficultyFromScore(60)).toBe("hard");
    expect(difficultyFromScore(75)).toBe("hard");
  });

  it("returns expert for scores above the hard threshold", () => {
    expect(difficultyFromScore(76)).toBe("expert");
    expect(difficultyFromScore(100)).toBe("expert");
    expect(difficultyFromScore(200)).toBe("expert");
  });
});

// ── analyzeSolveResult ──

describe("analyzeSolveResult", () => {
  it("returns empty analysis for an empty SolveResult", () => {
    const result = makeSolveResult([]);
    const analysis = analyzeSolveResult(result);
    expect(analysis.score).toBe(0);
    expect(analysis.hardestTechnique).toBeNull();
    expect(analysis.techniqueCounts).toEqual({});
    expect(analysis.assignmentCount).toBe(0);
    expect(analysis.eliminationCount).toBe(0);
    expect(analysis.totalSteps).toBe(0);
  });

  it("scores a single Naked Single correctly", () => {
    const result = makeSolveResult([assignmentMove("Naked Single")]);
    const analysis = analyzeSolveResult(result);
    expect(analysis.score).toBe(1.0);
    expect(analysis.hardestTechnique).toBe("Naked Single");
    expect(analysis.techniqueCounts).toEqual({ "Naked Single": 1 });
    expect(analysis.assignmentCount).toBe(1);
    expect(analysis.eliminationCount).toBe(0);
    expect(analysis.totalSteps).toBe(1);
  });

  it("scores multiple identical techniques correctly", () => {
    const moves = [
      assignmentMove("Hidden Single"),
      assignmentMove("Hidden Single"),
      assignmentMove("Hidden Single"),
    ];
    const result = makeSolveResult(moves);
    const analysis = analyzeSolveResult(result);
    expect(analysis.score).toBe(3 * 1.5);
    expect(analysis.hardestTechnique).toBe("Hidden Single");
    expect(analysis.techniqueCounts).toEqual({ "Hidden Single": 3 });
    expect(analysis.assignmentCount).toBe(3);
    expect(analysis.eliminationCount).toBe(0);
    expect(analysis.totalSteps).toBe(3);
  });

  it("accumulates score from mixed techniques", () => {
    const moves = [
      assignmentMove("Naked Single"),
      assignmentMove("Naked Single"),
      eliminationMove("X-Wing"),
    ];
    const result = makeSolveResult(moves);
    const analysis = analyzeSolveResult(result);
    const expected = 2 * TECHNIQUE_WEIGHTS["Naked Single"] + TECHNIQUE_WEIGHTS["X-Wing"];
    expect(analysis.score).toBe(expected);
    expect(analysis.hardestTechnique).toBe("X-Wing");
    expect(analysis.techniqueCounts).toEqual({ "Naked Single": 2, "X-Wing": 1 });
    expect(analysis.assignmentCount).toBe(2);
    expect(analysis.eliminationCount).toBe(1);
    expect(analysis.totalSteps).toBe(3);
  });

  it("handles elimination-only techniques", () => {
    const result = makeSolveResult([eliminationMove("Naked Pair")]);
    const analysis = analyzeSolveResult(result);
    expect(analysis.score).toBe(3.0);
    expect(analysis.hardestTechnique).toBe("Naked Pair");
    expect(analysis.techniqueCounts).toEqual({ "Naked Pair": 1 });
    expect(analysis.assignmentCount).toBe(0);
    expect(analysis.eliminationCount).toBe(1);
    expect(analysis.totalSteps).toBe(1);
  });

  it("reports the hardest technique by TECHNIQUE_PRIORITY order, not move order", () => {
    const moves = [
      eliminationMove("X-Wing"),
      assignmentMove("Naked Single"),
    ];
    const result = makeSolveResult(moves);
    const analysis = analyzeSolveResult(result);
    // X-Wing has higher priority index than Naked Single
    expect(analysis.hardestTechnique).toBe("X-Wing");
    expect(analysis.assignmentCount).toBe(1);
    expect(analysis.eliminationCount).toBe(1);
    expect(analysis.totalSteps).toBe(2);
  });

  it("reports null hardestTechnique when no moves exist", () => {
    const result = makeSolveResult([]);
    const analysis = analyzeSolveResult(result);
    expect(analysis.hardestTechnique).toBeNull();
    expect(analysis.assignmentCount).toBe(0);
    expect(analysis.eliminationCount).toBe(0);
    expect(analysis.totalSteps).toBe(0);
  });

  it("populates difficulty via difficultyFromScore", () => {
    const result = makeSolveResult([eliminationMove("X-Wing")]);
    const analysis = analyzeSolveResult(result);
    // score = 7, thresholds: easy <= 30
    expect(analysis.difficulty).toBe("easy");
    expect(analysis.assignmentCount).toBe(0);
    expect(analysis.eliminationCount).toBe(1);
    expect(analysis.totalSteps).toBe(1);
  });

  it("produces deterministic output for identical inputs", () => {
    const moves = [
      assignmentMove("Naked Single"),
      eliminationMove("Hidden Pair"),
      eliminationMove("Pointing Pair"),
    ];
    const result = makeSolveResult(moves);
    const a1 = analyzeSolveResult(result);
    const a2 = analyzeSolveResult(result);
    expect(a1).toEqual(a2);
  });
});

// ── Analysis Statistics (Phase 5.4) ──────────────────────────────────────────

describe("Analysis statistics", () => {
  it("empty SolveResult has zero counts", () => {
    const result = makeSolveResult([]);
    const analysis = analyzeSolveResult(result);
    expect(analysis.assignmentCount).toBe(0);
    expect(analysis.eliminationCount).toBe(0);
    expect(analysis.totalSteps).toBe(0);
  });

  it("assignment-only solution has correct counts", () => {
    const moves = [
      assignmentMove("Naked Single"),
      assignmentMove("Hidden Single"),
      assignmentMove("Naked Single"),
    ];
    const result = makeSolveResult(moves);
    const analysis = analyzeSolveResult(result);
    expect(analysis.assignmentCount).toBe(3);
    expect(analysis.eliminationCount).toBe(0);
    expect(analysis.totalSteps).toBe(3);
  });

  it("elimination-only solution has correct counts", () => {
    const moves = [
      eliminationMove("Naked Pair"),
      eliminationMove("Pointing Pair"),
    ];
    const result = makeSolveResult(moves);
    const analysis = analyzeSolveResult(result);
    expect(analysis.assignmentCount).toBe(0);
    expect(analysis.eliminationCount).toBe(2);
    expect(analysis.totalSteps).toBe(2);
  });

  it("mixed moves have correct counts", () => {
    const moves = [
      assignmentMove("Naked Single"),
      eliminationMove("X-Wing"),
      eliminationMove("Hidden Pair"),
      assignmentMove("Hidden Single"),
    ];
    const result = makeSolveResult(moves);
    const analysis = analyzeSolveResult(result);
    expect(analysis.assignmentCount).toBe(2);
    expect(analysis.eliminationCount).toBe(2);
    expect(analysis.totalSteps).toBe(4);
  });

  it("totalSteps equals moves.length", () => {
    const moves = [
      assignmentMove("Naked Single"),
      eliminationMove("Pointing Pair"),
      eliminationMove("Claiming Pair"),
      eliminationMove("X-Wing"),
      assignmentMove("Hidden Single"),
    ];
    const result = makeSolveResult(moves);
    const analysis = analyzeSolveResult(result);
    expect(analysis.totalSteps).toBe(5);
    expect(analysis.totalSteps).toBe(result.moves.length);
  });

  it("assignmentCount + eliminationCount === totalSteps for assignment-only", () => {
    const result = makeSolveResult([assignmentMove("Naked Single"), assignmentMove("Hidden Single")]);
    const analysis = analyzeSolveResult(result);
    expect(analysis.assignmentCount + analysis.eliminationCount).toBe(analysis.totalSteps);
  });

  it("assignmentCount + eliminationCount === totalSteps for elimination-only", () => {
    const result = makeSolveResult([eliminationMove("X-Wing"), eliminationMove("Naked Pair")]);
    const analysis = analyzeSolveResult(result);
    expect(analysis.assignmentCount + analysis.eliminationCount).toBe(analysis.totalSteps);
  });

  it("assignmentCount + eliminationCount === totalSteps for mixed", () => {
    const result = makeSolveResult([
      assignmentMove("Naked Single"),
      eliminationMove("Hidden Pair"),
      eliminationMove("Pointing Pair"),
      assignmentMove("Hidden Single"),
      eliminationMove("X-Wing"),
    ]);
    const analysis = analyzeSolveResult(result);
    expect(analysis.assignmentCount + analysis.eliminationCount).toBe(analysis.totalSteps);
  });

  it("assignmentCount + eliminationCount === totalSteps for empty", () => {
    const result = makeSolveResult([]);
    const analysis = analyzeSolveResult(result);
    expect(analysis.assignmentCount + analysis.eliminationCount).toBe(analysis.totalSteps);
  });
});
