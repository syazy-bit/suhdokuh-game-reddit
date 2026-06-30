import { describe, it, expect, beforeEach } from "vitest";
import {
  registerDefaultFeatures,
  clearRegistry,
  getStage1Filters,
  getStage2Features,
  registerStage1Filter,
  registerStage2Feature,
} from "../FeatureRegistry";
import { evaluateCandidates } from "../PredictorPipeline";
import { getBlendRatios, FEATURE_WEIGHTS } from "../PredictorWeights";
import type { PredictorContextData, RemovalCandidate } from "../types";
import { buildCandidateMap } from "../../CandidateEngine";
import { isolationFilter } from "../features/Stage1IsolationFilter";
import { boxDepletionFilter } from "../features/Stage1BoxDepletionFilter";
import { bivalueCreatedFeature } from "../features/Stage2BivalueCreated";
import { nakedSingleCreatedFeature } from "../features/Stage2NakedSingleCreated";
import { strongLinkCreatedFeature } from "../features/Stage2StrongLinkCreated";
import { localCandidateSurgeFeature } from "../features/Stage2LocalCandidateSurge";
import { sectorConflictFeature } from "../features/Stage2SectorConflict";

// ── Helpers ────────────────────────────────────────────────────────────────

function solvedBoard9x9(): number[][] {
  return [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9],
  ];
}

function makeContext(board: number[][]): PredictorContextData {
  const size = board.length as 4 | 9;
  const boxSize = size === 9 ? 3 : 2;
  return {
    board,
    size,
    boxSize,
    beforeCandidateMap: buildCandidateMap(board, size, boxSize),
  };
}

function makeCandidate(
  row: number,
  col: number,
  balanceScore: number = 0.5,
): RemovalCandidate {
  return {
    row,
    col,
    symRow: 8 - row,
    symCol: 8 - col,
    box1: Math.floor(row / 3) * 3 + Math.floor(col / 3),
    box2: Math.floor((8 - row) / 3) * 3 + Math.floor((8 - col) / 3),
    balanceScore,
    predictorScore: 0,
    finalScore: 0,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("FeatureRegistry", () => {
  beforeEach(() => {
    clearRegistry();
  });

  it("starts empty after clear", () => {
    expect(getStage1Filters()).toHaveLength(0);
    expect(getStage2Features()).toHaveLength(0);
  });

  it("registers and retrieves features", () => {
    registerStage1Filter({ name: "test-f1", enabledForDifficulty: () => true, filter: () => true });
    registerStage2Feature({ name: "BIVALUE_CREATED", enabledForDifficulty: () => true, compute: () => 5 });
    expect(getStage1Filters()).toHaveLength(1);
    expect(getStage2Features()).toHaveLength(1);
    expect(getStage1Filters()[0]!.name).toBe("test-f1");
    expect(getStage2Features()[0]!.name).toBe("BIVALUE_CREATED");
  });

  it("registerDefaultFeatures registers all expected features", () => {
    registerDefaultFeatures();
    expect(getStage1Filters().length).toBeGreaterThanOrEqual(2);
    expect(getStage2Features().length).toBeGreaterThanOrEqual(5);
  });

  it("clearRegistry removes all features", () => {
    registerDefaultFeatures();
    clearRegistry();
    expect(getStage1Filters()).toHaveLength(0);
    expect(getStage2Features()).toHaveLength(0);
  });
});

describe("PredictorWeights", () => {
  it("FEATURE_WEIGHTS contains all expected keys", () => {
    expect(FEATURE_WEIGHTS.BIVALUE_CREATED).toBe(2);
    expect(FEATURE_WEIGHTS.NAKED_SINGLE_CREATED).toBe(-3);
    expect(FEATURE_WEIGHTS.STRONG_LINK_CREATED).toBe(5);
    expect(FEATURE_WEIGHTS.LOCAL_CANDIDATE_SURGE).toBe(1);
    expect(FEATURE_WEIGHTS.SECTOR_CONFLICT).toBe(3);
  });

  it("getBlendRatios returns correct ratios for standard difficulties", () => {
    const easy = getBlendRatios("easy");
    expect(easy.balance).toBeGreaterThan(easy.predictor);

    const expert = getBlendRatios("expert");
    expect(expert.predictor).toBeGreaterThan(expert.balance);
  });

  it("getBlendRatios maps beginner/advanced to easy", () => {
    const beginner = getBlendRatios("beginner");
    const advanced = getBlendRatios("advanced");
    const easy = getBlendRatios("easy");
    expect(beginner).toEqual(easy);
    expect(advanced).toEqual(easy);
  });

  it("blend ratios sum to 1", () => {
    for (const d of ["easy", "medium", "hard", "expert"]) {
      const r = getBlendRatios(d as any);
      expect(Math.abs(r.balance + r.predictor - 1)).toBeLessThan(0.01);
    }
  });
});

describe("Stage 1 — IsolationFilter", () => {
  beforeEach(() => {
    clearRegistry();
    registerStage1Filter(isolationFilter);
  });

  it("passes a cell with 0 empty neighbors", () => {
    const board = solvedBoard9x9();
    const ctx = makeContext(board);
    const candidates = [makeCandidate(0, 0)];
    const result = evaluateCandidates(ctx, candidates, "medium");
    expect(result).toHaveLength(1);
  });

  it("filters a cell with 2+ empty neighbors", () => {
    const board = solvedBoard9x9();
    board[0][1] = 0;
    board[1][0] = 0;
    const ctx = makeContext(board);
    const candidates = [makeCandidate(0, 0)];
    const result = evaluateCandidates(ctx, candidates, "medium");
    expect(result).toHaveLength(0);
  });

  it("passes a cell with 1 empty neighbor", () => {
    const board = solvedBoard9x9();
    board[0][1] = 0;
    const ctx = makeContext(board);
    const candidates = [makeCandidate(0, 0)];
    const result = evaluateCandidates(ctx, candidates, "hard");
    expect(result).toHaveLength(1);
  });
});

describe("Stage 1 — BoxDepletionFilter", () => {
  beforeEach(() => {
    clearRegistry();
    registerStage1Filter(boxDepletionFilter);
  });

  it("passes when box has many givens", () => {
    const board = solvedBoard9x9();
    const ctx = makeContext(board);
    const candidates = [makeCandidate(0, 0)];
    const result = evaluateCandidates(ctx, candidates, "medium");
    expect(result).toHaveLength(1);
  });

  it("filters when box has ≤2 givens", () => {
    const board = solvedBoard9x9();
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        board[r][c] = 0;
      }
    }
    board[0][0] = 1;
    board[0][1] = 2;
    const ctx = makeContext(board);
    const candidates = [makeCandidate(0, 1)];
    const result = evaluateCandidates(ctx, candidates, "medium");
    expect(result).toHaveLength(0);
  });
});

describe("Stage 2 — BivalueCreated", () => {
  beforeEach(() => {
    clearRegistry();
    registerStage2Feature(bivalueCreatedFeature);
  });

  it("returns 0 for a full board (no empty cells)", () => {
    const board = solvedBoard9x9();
    const ctx = makeContext(board);
    const candidates = [makeCandidate(0, 0)];
    const result = evaluateCandidates(ctx, candidates, "medium");
    expect(result[0]!.predictorScore).toBe(0);
  });
});

describe("Stage 2 — NakedSingleCreated", () => {
  beforeEach(() => {
    clearRegistry();
    registerStage2Feature(nakedSingleCreatedFeature);
  });

  it("returns 0 for a full board", () => {
    const board = solvedBoard9x9();
    const ctx = makeContext(board);
    const candidates = [makeCandidate(0, 0)];
    const result = evaluateCandidates(ctx, candidates, "medium");
    expect(result[0]!.predictorScore).toBe(0);
  });
});

describe("Stage 2 — StrongLinkCreated", () => {
  beforeEach(() => {
    clearRegistry();
    registerStage2Feature(strongLinkCreatedFeature);
  });

  it("returns 0 for a full board", () => {
    const board = solvedBoard9x9();
    const ctx = makeContext(board);
    const candidates = [makeCandidate(0, 0)];
    const result = evaluateCandidates(ctx, candidates, "medium");
    expect(result[0]!.predictorScore).toBe(0);
  });
});

describe("Stage 2 — LocalCandidateSurge", () => {
  beforeEach(() => {
    clearRegistry();
    registerStage2Feature(localCandidateSurgeFeature);
  });

  it("returns 0 for a full board", () => {
    const board = solvedBoard9x9();
    const ctx = makeContext(board);
    const candidates = [makeCandidate(0, 0)];
    const result = evaluateCandidates(ctx, candidates, "medium");
    expect(result[0]!.predictorScore).toBe(0);
  });

  it("returns positive when empty cells exist in affected region", () => {
    const board = solvedBoard9x9();
    board[1][0] = 0;
    board[1][1] = 0;
    const ctx = makeContext(board);
    const candidates = [makeCandidate(0, 0)];
    const result = evaluateCandidates(ctx, candidates, "medium");
    expect(result[0]!.predictorScore).toBeGreaterThan(0);
  });
});

describe("Stage 2 — SectorConflict", () => {
  beforeEach(() => {
    clearRegistry();
    registerStage2Feature(sectorConflictFeature);
  });

  it("returns 0 for a full board", () => {
    const board = solvedBoard9x9();
    const ctx = makeContext(board);
    const candidates = [makeCandidate(0, 0)];
    const result = evaluateCandidates(ctx, candidates, "medium");
    expect(result[0]!.predictorScore).toBe(0);
  });
});

describe("PredictorPipeline — integration", () => {
  beforeEach(() => {
    registerDefaultFeatures();
  });

  it("sorts candidates by finalScore descending", () => {
    const board = solvedBoard9x9();
    board[1][0] = 0;
    board[1][1] = 0;
    board[1][2] = 0;
    board[2][0] = 0;
    board[2][1] = 0;
    const ctx = makeContext(board);

    const candidates = [
      makeCandidate(0, 0, 0.8),
      makeCandidate(0, 3, 0.6),
      makeCandidate(0, 6, 0.4),
    ];

    const result = evaluateCandidates(ctx, candidates, "hard");
    expect(result).toHaveLength(3);
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.finalScore).toBeLessThanOrEqual(result[i - 1]!.finalScore);
    }
  });

  it("predictorScore is never negative", () => {
    const board = solvedBoard9x9();
    board[1][0] = 0;
    board[1][1] = 0;
    const ctx = makeContext(board);
    const candidates = [makeCandidate(0, 0, 0.5)];
    const result = evaluateCandidates(ctx, candidates, "medium");
    expect(result[0]!.predictorScore).toBeGreaterThanOrEqual(0);
  });

  it("does not modify the original board after evaluation", () => {
    const board = solvedBoard9x9();
    const original = board.map((r) => [...r]);
    const ctx = makeContext(board);
    const candidates = [makeCandidate(0, 0)];
    evaluateCandidates(ctx, candidates, "medium");
    expect(board).toEqual(original);
  });
});

describe("Determinism", () => {
  beforeEach(() => {
    registerDefaultFeatures();
  });

  it("produces identical rankings across multiple calls with same input", () => {
    const board = solvedBoard9x9();
    board[1][0] = 0;
    board[1][1] = 0;
    board[2][0] = 0;
    const ctx = makeContext(board);

    const candidates = [
      makeCandidate(0, 0, 0.7),
      makeCandidate(0, 3, 0.5),
      makeCandidate(0, 6, 0.3),
      makeCandidate(2, 2, 0.6),
      makeCandidate(4, 4, 0.4),
    ];

    const result1 = evaluateCandidates(ctx, candidates.map((c) => ({ ...c })), "hard");
    const result2 = evaluateCandidates(ctx, candidates.map((c) => ({ ...c })), "hard");

    for (let i = 0; i < result1.length; i++) {
      expect(result1[i]!.row).toBe(result2[i]!.row);
      expect(result1[i]!.col).toBe(result2[i]!.col);
      expect(result1[i]!.finalScore).toBe(result2[i]!.finalScore);
    }
  });
});
