import { describe, it, expect } from "vitest";
import { buildMaskMap } from "./CandidateEngine";
import { hasCandidate, candidateKey, candidateCount, iterateCandidates, firstCandidate } from "./CandidateMask";
import type { CandidateMaskMap } from "./CandidateMaskMap";
import {
  findNakedSingles,
  findHiddenSingles,
  findNakedPairs,
  findHiddenPairs,
  findPointingPairs,
  findClaimingPairs,
  findXWings,
  findXYWing,
  findSkyscraper,
  findTwoStringKite,
  findSwordfish,
  type HumanSolverContext,
} from "./HumanSolver";
import type { GridSize } from "./SudokuValidator";

const bit = (v: number): number => 1 << (v - 1);

function createCtx(
  board: number[][],
  size: GridSize,
  boxSize: number
): HumanSolverContext {
  return {
    board,
    size,
    boxSize,
    candidateMap: buildMaskMap(board, size, boxSize),
  };
}

function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row]);
}

// ── Zero Naked Singles ───────────────────────────────────────────────────

describe("findNakedSingles — zero Naked Singles", () => {
  it("returns empty array for empty 4x4 board", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 4, 2);

    const result = findNakedSingles(ctx);

    expect(result).toEqual([]);
    expect(board).toEqual(snapshot);
  });

  it("returns empty array when all cells are filled", () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 4, 2);

    const result = findNakedSingles(ctx);

    expect(result).toEqual([]);
    expect(board).toEqual(snapshot);
  });

  it("returns empty array when empty cells have multiple candidates", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 2, 3, 4],
      [0, 0, 0, 0],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 4, 2);

    const result = findNakedSingles(ctx);

    expect(result).toEqual([]);
    expect(board).toEqual(snapshot);
  });
});

// ── One Naked Single ─────────────────────────────────────────────────────

describe("findNakedSingles — one Naked Single", () => {
  it("finds the only possible value in the last cell of a 4x4 solution", () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 0],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 4, 2);

    const result = findNakedSingles(ctx);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "assignment",
      row: 3,
      col: 3,
      value: 1,
      technique: "Naked Single",
    });
    expect(board).toEqual(snapshot);
  });

  it("finds the only possible value on a 9x9 board", () => {
    const board = [
      [5, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 0],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 9, 3);

    const result = findNakedSingles(ctx);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "assignment",
      row: 8,
      col: 8,
      value: 9,
      technique: "Naked Single",
    });
    expect(board).toEqual(snapshot);
  });
});

// ── Several Naked Singles ────────────────────────────────────────────────

describe("findNakedSingles — several Naked Singles", () => {
  it("finds all cells with exactly one candidate on a 4x4 board", () => {
    const board = [
      [0, 2, 3, 4],
      [3, 4, 0, 2],
      [2, 0, 4, 3],
      [4, 3, 2, 1],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 4, 2);

    const result = findNakedSingles(ctx);

    expect(result).toHaveLength(3);

    expect(result).toContainEqual({
      type: "assignment",
      row: 0, col: 0, value: 1, technique: "Naked Single",
    });
    expect(result).toContainEqual({
      type: "assignment",
      row: 1, col: 2, value: 1, technique: "Naked Single",
    });
    expect(result).toContainEqual({
      type: "assignment",
      row: 2, col: 1, value: 1, technique: "Naked Single",
    });

    expect(board).toEqual(snapshot);
  });
});

// ── Zero Hidden Singles ──────────────────────────────────────────────────

describe("findHiddenSingles — zero Hidden Singles", () => {
  it("returns empty array for empty 9x9 board", () => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 9, 3);

    const result = findHiddenSingles(ctx);

    expect(result).toEqual([]);
    expect(board).toEqual(snapshot);
  });

  it("returns empty array when all cells are filled", () => {
    const board = [
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
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 9, 3);

    const result = findHiddenSingles(ctx);

    expect(result).toEqual([]);
    expect(board).toEqual(snapshot);
  });
});

// ── One Hidden Single ────────────────────────────────────────────────────

describe("findHiddenSingles — one Hidden Single", () => {
  it("finds a Hidden Single in a row (value 2 at (0,0))", () => {
    const board = [
      [0, 1, 0, 0, 0, 0, 0, 0, 0],
      [3, 4, 5, 0, 0, 0, 0, 0, 0],
      [6, 7, 8, 0, 0, 0, 0, 0, 0],
      [0, 0, 2, 2, 2, 2, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 2, 2, 2],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 9, 3);

    const result = findHiddenSingles(ctx);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result).toContainEqual({
      type: "assignment",
      row: 0,
      col: 0,
      value: 2,
      technique: "Hidden Single",
    });
    expect(board).toEqual(snapshot);
  });

  it("finds a Hidden Single in a column (value 3 at (5,3))", () => {
    const board = [
      [0, 3, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 2, 0, 0, 0, 0, 0],
      [3, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 3, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [3, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 3, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 3, 0, 0, 0, 0, 0, 0],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 9, 3);

    const result = findHiddenSingles(ctx);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result).toContainEqual({
      type: "assignment",
      row: 5,
      col: 3,
      value: 3,
      technique: "Hidden Single",
    });
    expect(board).toEqual(snapshot);
  });

  it("finds a Hidden Single in a box (value 2 at (0,0))", () => {
    const board = [
      [0, 1, 0, 0, 0, 0, 0, 0, 0],
      [3, 4, 5, 0, 0, 0, 0, 0, 0],
      [6, 7, 8, 0, 0, 0, 0, 0, 0],
      [0, 0, 2, 2, 2, 2, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 2, 2, 2],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 9, 3);

    const result = findHiddenSingles(ctx);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result).toContainEqual({
      type: "assignment",
      row: 0,
      col: 0,
      value: 2,
      technique: "Hidden Single",
    });
    expect(board).toEqual(snapshot);
  });
});

// ── Multiple Hidden Singles ─────────────────────────────────────────────

describe("findHiddenSingles — multiple Hidden Singles", () => {
  it("finds all Hidden Singles on a board that has several", () => {
    const board = [
      [0, 1, 3, 0, 0, 0, 0, 0, 0],
      [3, 4, 5, 1, 0, 0, 0, 0, 0],
      [6, 7, 8, 2, 0, 0, 0, 0, 0],
      [3, 0, 2, 0, 2, 2, 0, 0, 0],
      [3, 0, 0, 0, 0, 0, 2, 2, 2],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [3, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 3, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 3, 0, 0, 0, 0, 0, 0],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 9, 3);

    const result = findHiddenSingles(ctx);

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result).toContainEqual({
      type: "assignment",
      row: 0, col: 0, value: 2, technique: "Hidden Single",
    });
    expect(result).toContainEqual({
      type: "assignment",
      row: 5, col: 3, value: 3, technique: "Hidden Single",
    });
    expect(board).toEqual(snapshot);
  });
});

// ── Board immutability ──────────────────────────────────────────────────

describe("findHiddenSingles — board immutability", () => {
  it("does not mutate the board", () => {
    const board = [
      [0, 1, 0, 0, 0, 0, 0, 0, 0],
      [3, 4, 5, 0, 0, 0, 0, 0, 0],
      [6, 7, 8, 0, 0, 0, 0, 0, 0],
      [0, 0, 2, 2, 2, 2, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 2, 2, 2],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 9, 3);

    findHiddenSingles(ctx);

    expect(board).toEqual(snapshot);
  });
});

// ── Zero Naked Pairs ───────────────────────────────────────────────────

describe("findNakedPairs — zero Naked Pairs", () => {
  it("returns empty array for empty 4x4 board", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findNakedPairs(ctx);

    expect(result).toEqual([]);
  });

  it("returns empty array when no cell has exactly two candidates", () => {
    const board = [
      [1, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findNakedPairs(ctx);

    expect(result).toEqual([]);
  });
});

// ── One Naked Pair ─────────────────────────────────────────────────────

describe("findNakedPairs — one Naked Pair", () => {
  it("finds a Naked Pair in a row", () => {
    // Row 0: (0,0)[2,3], (0,1)[2,3] form a Naked Pair.
    // (0,2)[2,4] — 2 should be eliminated.
    const board = [
      [0, 0, 0, 1],
      [4, 0, 3, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findNakedPairs(ctx);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const move = result.find(
      (m) =>
        m.type === "elimination" && m.technique === "Naked Pair"
    )!;
    expect(move).toBeDefined();
    if (move.type !== "elimination") return;
    expect(move.patternCells).toHaveLength(2);
    expect(move.eliminations).toContainEqual({
      row: 0,
      col: 2,
      value: 2,
    });
  });

  it("finds a Naked Pair in a column", () => {
    // Column 0: (0,0)[2,3], (1,0)[2,3] form a Naked Pair.
    // (2,0)[2,4] — 2 should be eliminated.
    const board = [
      [0, 0, 0, 0],
      [0, 4, 0, 0],
      [0, 0, 3, 0],
      [1, 0, 4, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findNakedPairs(ctx);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const move = result.find(
      (m) =>
        m.type === "elimination" && m.technique === "Naked Pair"
    )!;
    expect(move).toBeDefined();
    if (move.type !== "elimination") return;
    expect(move.eliminations).toContainEqual({
      row: 2,
      col: 0,
      value: 2,
    });
  });

  it("finds a Naked Pair in a box", () => {
    // Box (0,0)-(1,1): (0,0)[2,3], (0,1)[2,3] form a Naked Pair.
    // (1,1)[1,2] — 2 should be eliminated.
    const board = [
      [0, 0, 0, 1],
      [4, 0, 3, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findNakedPairs(ctx);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const move = result.find(
      (m) =>
        m.type === "elimination" && m.technique === "Naked Pair"
    )!;
    expect(move).toBeDefined();
    if (move.type !== "elimination") return;
    expect(move.eliminations).toContainEqual({
      row: 1,
      col: 1,
      value: 2,
    });
  });
});

// ── Naked Pair with no eliminations ────────────────────────────────────

describe("findNakedPairs — pair with no eliminations", () => {
  it("ignores a pair that eliminates nothing", () => {
    // Row 0: [1, 0, 0, 2] — cells (0,1)[3,4] and (0,2)[3,4] form a
    // Naked Pair, but no other empty cells exist in the row to eliminate.
    const board = [
      [1, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findNakedPairs(ctx);

    expect(
      result.filter((m) => m.type === "elimination")
    ).toHaveLength(0);
  });
});

// ── Duplicate prevention ──────────────────────────────────────────────

describe("findNakedPairs — duplicate prevention", () => {
  it("returns the same pair only once when found in both row and box", () => {
    // Row 0 and box (0,0)-(1,1) both contain the same Naked Pair {2,3}
    // at (0,0) and (0,1).  Only one LogicalMove should be emitted, with
    // eliminations accumulated from both scans.
    const board = [
      [0, 0, 0, 1],
      [4, 0, 3, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findNakedPairs(ctx);

    const nakedPairs = result.filter(
      (m) => m.type === "elimination" && m.technique === "Naked Pair"
    );
    expect(nakedPairs).toHaveLength(1);
  });
});

// ── Board immutability ────────────────────────────────────────────────

describe("findNakedPairs — board immutability", () => {
  it("does not mutate the board", () => {
    const board = [
      [0, 0, 0, 1],
      [4, 0, 3, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 4, 2);

    findNakedPairs(ctx);

    expect(board).toEqual(snapshot);
  });
});

// ── Zero Hidden Pairs ──────────────────────────────────────────────────

describe("findHiddenPairs — zero Hidden Pairs", () => {
  it("returns empty array for empty 4x4 board", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findHiddenPairs(ctx);

    expect(result).toEqual([]);
  });

  it("returns empty array when no value appears in exactly two cells of any unit", () => {
    const board = [
      [1, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findHiddenPairs(ctx);

    expect(result).toEqual([]);
  });
});

// ── One Hidden Pair ───────────────────────────────────────────────────

describe("findHiddenPairs — one Hidden Pair", () => {
  it("finds a Hidden Pair in a row", () => {
    // Row 0: (0,0)[1,2,3,4], (0,1)[1,2,3,4], (0,2)[3,4], (0,3)[3,4].
    // 1 and 2 appear only in (0,0) and (0,1) in row 0 → hidden pair {1,2}.
    // Eliminate 3,4 from (0,0) and 3,4 from (0,1).
    const board = [
      [0, 0, 0, 0],
      [0, 0, 1, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findHiddenPairs(ctx);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const move = result.find(
      (m) => m.type === "elimination" && m.technique === "Hidden Pair"
    )!;
    expect(move).toBeDefined();
    if (move.type !== "elimination") return;
    expect(move.patternCells).toHaveLength(2);
    expect(move.patternCells).toContainEqual({ row: 0, col: 0 });
    expect(move.patternCells).toContainEqual({ row: 0, col: 1 });
    expect(move.eliminations).toContainEqual({ row: 0, col: 0, value: 3 });
    expect(move.eliminations).toContainEqual({ row: 0, col: 0, value: 4 });
    expect(move.eliminations).toContainEqual({ row: 0, col: 1, value: 3 });
    expect(move.eliminations).toContainEqual({ row: 0, col: 1, value: 4 });
  });

  it("finds a Hidden Pair in a column", () => {
    // Column 0: (0,0)[1,2,3,4], (1,0)[1,2,3,4], (2,0)[3,4], (3,0)[3,4].
    // 1 and 2 appear only in (0,0) and (1,0) in col 0 → hidden pair {1,2}.
    // Eliminate 3,4 from (0,0) and 3,4 from (1,0).
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 2, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findHiddenPairs(ctx);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const move = result.find(
      (m) => m.type === "elimination" && m.technique === "Hidden Pair"
    )!;
    expect(move).toBeDefined();
    if (move.type !== "elimination") return;
    expect(move.patternCells).toHaveLength(2);
    expect(move.patternCells).toContainEqual({ row: 0, col: 0 });
    expect(move.patternCells).toContainEqual({ row: 1, col: 0 });
    expect(move.eliminations).toContainEqual({ row: 0, col: 0, value: 3 });
    expect(move.eliminations).toContainEqual({ row: 0, col: 0, value: 4 });
    expect(move.eliminations).toContainEqual({ row: 1, col: 0, value: 3 });
    expect(move.eliminations).toContainEqual({ row: 1, col: 0, value: 4 });
  });

  it("finds a Hidden Pair in a box", () => {
    // Box (0,2)-(1,3): (0,2)[1,2,3,4], (0,3)[1,2,3,4], (1,2)[3,4], (1,3)[3,4].
    // 1 and 2 appear only in (0,2) and (0,3) in that box → hidden pair {1,2}.
    // Eliminate 3,4 from (0,2) and 3,4 from (0,3).
    const board = [
      [0, 0, 0, 0],
      [1, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findHiddenPairs(ctx);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const move = result.find(
      (m) => m.type === "elimination" && m.technique === "Hidden Pair"
    )!;
    expect(move).toBeDefined();
    if (move.type !== "elimination") return;
    expect(move.patternCells).toHaveLength(2);
    expect(move.patternCells).toContainEqual({ row: 0, col: 2 });
    expect(move.patternCells).toContainEqual({ row: 0, col: 3 });
    expect(move.eliminations).toContainEqual({ row: 0, col: 2, value: 3 });
    expect(move.eliminations).toContainEqual({ row: 0, col: 2, value: 4 });
    expect(move.eliminations).toContainEqual({ row: 0, col: 3, value: 3 });
    expect(move.eliminations).toContainEqual({ row: 0, col: 3, value: 4 });
  });
});

// ── Hidden Pair with no eliminations ──────────────────────────────────

describe("findHiddenPairs — pair with no eliminations", () => {
  it("ignores a hidden pair whose cells already have exactly two candidates", () => {
    // Row 1: (1,1)[3,4], (1,2)[3,4] — 3 and 4 appear only in those two cells.
    // Both cells already have exactly {3,4} → no eliminations needed.
    const board = [
      [0, 0, 0, 0],
      [1, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findHiddenPairs(ctx);

    expect(
      result.filter((m) => m.type === "elimination")
    ).toHaveLength(0);
  });
});

// ── Duplicate prevention ─────────────────────────────────────────────

describe("findHiddenPairs — duplicate prevention", () => {
  it("returns the same pair only once when found in both row and box", () => {
    // The hidden pair {1,2} at (0,0)(0,1) is detected by both the row 0 scan
    // and the box (0,0)-(1,1) scan. Only one LogicalMove should be emitted.
    const board = [
      [0, 0, 0, 0],
      [0, 0, 1, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findHiddenPairs(ctx);

    const hiddenPairs = result.filter(
      (m) => m.type === "elimination" && m.technique === "Hidden Pair"
    );
    expect(hiddenPairs).toHaveLength(1);
  });
});

// ── Board immutability ────────────────────────────────────────────────

describe("findHiddenPairs — board immutability", () => {
  it("does not mutate the board", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 1, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 4, 2);

    findHiddenPairs(ctx);

    expect(board).toEqual(snapshot);
  });
});

// ── Zero Pointing Pairs ──────────────────────────────────────────────

describe("findPointingPairs — zero Pointing Pairs", () => {
  it("returns empty array for empty 4x4 board", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findPointingPairs(ctx);

    expect(result).toEqual([]);
  });

  it("returns empty array when no value is confined to a single row or column in any box", () => {
    // Each box has at least one filled cell in each row, so every value
    // appears in all rows of each box.
    const board = [
      [1, 2, 0, 0],
      [3, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findPointingPairs(ctx);

    expect(result).toEqual([]);
  });
});

// ── Row-based Pointing Pair ──────────────────────────────────────────

describe("findPointingPairs — row-based", () => {
  it("finds a row-based Pointing Pair (value 1 aligned to row 0 in box)", () => {
    // Box (0,0)-(1,1): (0,0)[1,3,4] (0,1)[1,3,4] — 1 only in row 0.
    // Row 0 outside box: (0,2)[1,2,3,4], (0,3)[1,2,3,4] → 1 eliminated.
    const board = [
      [0, 0, 0, 0],
      [2, 5, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findPointingPairs(ctx);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const move = result.find(
      (m) =>
        m.type === "elimination" && m.technique === "Pointing Pair"
    )!;
    expect(move).toBeDefined();
    if (move.type !== "elimination") return;
    expect(move.eliminations).toContainEqual({
      row: 0,
      col: 2,
      value: 1,
    });
    expect(move.eliminations).toContainEqual({
      row: 0,
      col: 3,
      value: 1,
    });
  });
});

// ── Column-based Pointing Pair ───────────────────────────────────────

describe("findPointingPairs — column-based", () => {
  it("finds a column-based Pointing Pair (value 1 aligned to column 0 in box)", () => {
    // Box (0,0)-(1,1): (0,0)[1,4] (1,0)[1,4] — 1 only in col 0.
    // Column 0 outside box: (2,0)[1,2,3,4], (3,0)[1,2,3,4] → 1 eliminated.
    const board = [
      [0, 2, 0, 0],
      [0, 3, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findPointingPairs(ctx);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const move = result.find(
      (m) =>
        m.type === "elimination" && m.technique === "Pointing Pair"
    )!;
    expect(move).toBeDefined();
    if (move.type !== "elimination") return;
    expect(move.eliminations).toContainEqual({
      row: 2,
      col: 0,
      value: 1,
    });
    expect(move.eliminations).toContainEqual({
      row: 3,
      col: 0,
      value: 1,
    });
  });
});

// ── Pointing Triple ─────────────────────────────────────────────────

describe("findPointingPairs — Pointing Triple", () => {
  it("finds a pointing pattern with three cells in a 9x9 box", () => {
    // Box (0,0)-(2,2): rows 1-2 filled, value 1 only in (0,0)(0,1)(0,2).
    // Row 0 outside box: cols 3-8 all have 1 → eliminated.
    const board = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [2, 3, 4, 0, 0, 0, 0, 0, 0],
      [5, 6, 7, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 9, 3);

    const result = findPointingPairs(ctx);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const move = result.find(
      (m) =>
        m.type === "elimination" && m.technique === "Pointing Pair"
    )!;
    expect(move).toBeDefined();
    if (move.type !== "elimination") return;
    expect(move.patternCells).toHaveLength(3);
    expect(move.patternCells).toContainEqual({ row: 0, col: 0 });
    expect(move.patternCells).toContainEqual({ row: 0, col: 1 });
    expect(move.patternCells).toContainEqual({ row: 0, col: 2 });
    expect(move.eliminations).toContainEqual({ row: 0, col: 3, value: 1 });
    expect(move.eliminations).toContainEqual({ row: 0, col: 4, value: 1 });
    expect(move.eliminations).toContainEqual({ row: 0, col: 5, value: 1 });
    expect(move.eliminations).toContainEqual({ row: 0, col: 6, value: 1 });
    expect(move.eliminations).toContainEqual({ row: 0, col: 7, value: 1 });
    expect(move.eliminations).toContainEqual({ row: 0, col: 8, value: 1 });
  });
});

// ── Pointing Pair with no eliminations ───────────────────────────────

describe("findPointingPairs — no eliminations", () => {
  it("ignores a pointing pair whose line outside the box has no candidates to eliminate", () => {
    // Box (0,0)-(1,1): values 1 and 4 confined to column 0.
    // Column 0 outside box: (2,0)[2,3], (3,0)[2,3] — neither 1 nor 4.
    const board = [
      [0, 2, 0, 0],
      [0, 3, 0, 0],
      [0, 1, 4, 0],
      [0, 0, 1, 4],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findPointingPairs(ctx);

    expect(
      result.filter((m) => m.type === "elimination")
    ).toHaveLength(0);
  });
});

// ── Duplicate prevention ─────────────────────────────────────────────

describe("findPointingPairs — duplicate prevention", () => {
  it("returns only one LogicalMove per pointing deduction", () => {
    // Pointing pair for value 1 in box (0,0)-(1,1), row 0.
    // Only one move should be emitted even though the same box  is scanned once.
    const board = [
      [0, 0, 0, 0],
      [2, 5, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findPointingPairs(ctx);

    // Count distinct pointing-pair moves
    const pointingMoves = result.filter(
      (m) => m.type === "elimination" && m.technique === "Pointing Pair"
    );
    // At least one, each with a unique (box,row/col,value) key.
    // Verify no duplicate (box,row,value) combo exists.
    const seen = new Set<string>();
    for (const m of pointingMoves) {
      if (m.type !== "elimination") continue;
      const key = `${m.patternCells.map((c) => `${c.row},${c.col}`).sort().join("|")}|${m.eliminations.map((e) => `${e.row},${e.col},${e.value}`).sort().join("|")}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

// ── Board immutability ──────────────────────────────────────────────

describe("findPointingPairs — board immutability", () => {
  it("does not mutate the board", () => {
    const board = [
      [0, 0, 0, 0],
      [2, 5, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 4, 2);

    findPointingPairs(ctx);

    expect(board).toEqual(snapshot);
  });
});

// ── Zero Claiming Pairs ─────────────────────────────────────────────

describe("findClaimingPairs — zero Claiming Pairs", () => {
  it("returns empty array for empty 4x4 board", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findClaimingPairs(ctx);

    expect(result).toEqual([]);
  });

  it("returns empty array when no value is confined to a single box in any row or column", () => {
    // Row 0 fully filled; rows 1-3 empty → each value appears in all 4 cols → no confinement.
    const board = [
      [1, 2, 3, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findClaimingPairs(ctx);

    expect(result).toEqual([]);
  });
});

// ── Row-based Claiming Pair ─────────────────────────────────────────

describe("findClaimingPairs — row-based", () => {
  it("finds a row-based Claiming Pair (value 1 confined to box in row 0)", () => {
    // Row 0: givens at (0,2)=3,(0,3)=4 → 1 only in (0,0)(0,1), both in box (0,0)-(1,1).
    // Box (0,0)-(1,1) other rows: (1,0)(1,1) have 1 as candidate → eliminate.
    const board = [
      [0, 0, 3, 4],
      [0, 0, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findClaimingPairs(ctx);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const move = result.find(
      (m) =>
        m.type === "elimination" && m.technique === "Claiming Pair"
    )!;
    expect(move).toBeDefined();
    if (move.type !== "elimination") return;
    expect(move.patternCells).toHaveLength(2);
    expect(move.patternCells).toContainEqual({ row: 0, col: 0 });
    expect(move.patternCells).toContainEqual({ row: 0, col: 1 });
    expect(move.eliminations).toContainEqual({ row: 1, col: 0, value: 1 });
    expect(move.eliminations).toContainEqual({ row: 1, col: 1, value: 1 });
  });
});

// ── Column-based Claiming Pair ──────────────────────────────────────

describe("findClaimingPairs — column-based", () => {
  it("finds a column-based Claiming Pair (value 1 confined to box in column 0)", () => {
    // Column 0: givens at (2,0)=2,(3,0)=3 → 1 only in (0,0)(1,0), both in box (0,0)-(1,1).
    // Box (0,0)-(1,1) other cols: (0,1)(1,1) have 1 as candidate → eliminate.
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 0, 0],
      [3, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findClaimingPairs(ctx);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const move = result.find(
      (m) =>
        m.type === "elimination" && m.technique === "Claiming Pair"
    )!;
    expect(move).toBeDefined();
    if (move.type !== "elimination") return;
    expect(move.patternCells).toHaveLength(2);
    expect(move.patternCells).toContainEqual({ row: 0, col: 0 });
    expect(move.patternCells).toContainEqual({ row: 1, col: 0 });
    expect(move.eliminations).toContainEqual({ row: 0, col: 1, value: 1 });
    expect(move.eliminations).toContainEqual({ row: 1, col: 1, value: 1 });
  });
});

// ── Claiming Triple ────────────────────────────────────────────────

describe("findClaimingPairs — Claiming Triple", () => {
  it("finds a claiming pattern with three cells in a 9x9 row", () => {
    // Row 0: 1 only in cols 0-2 → box (0,0)-(2,2).
    // Block 1 from row 0 cols 3-8 via column clues in rows 3+.
    // Box (0,0)-(2,2) rows 1-2 have 1 → 6 eliminations.
    const board = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 1],
    ];
    const ctx = createCtx(board, 9, 3);

    const result = findClaimingPairs(ctx);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const move = result.find(
      (m) =>
        m.type === "elimination" && m.technique === "Claiming Pair"
    )!;
    expect(move).toBeDefined();
    if (move.type !== "elimination") return;
    expect(move.patternCells).toHaveLength(3);
    expect(move.patternCells).toContainEqual({ row: 0, col: 0 });
    expect(move.patternCells).toContainEqual({ row: 0, col: 1 });
    expect(move.patternCells).toContainEqual({ row: 0, col: 2 });
    expect(move.eliminations.length).toBeGreaterThanOrEqual(6);
  });
});

// ── Claiming Pair with no eliminations ──────────────────────────────

describe("findClaimingPairs — no eliminations", () => {
  it("ignores a claiming pair whose box has no candidates to eliminate", () => {
    // Row 2 filled with 1-4; every column has each non-given value
    // appearing in rows spanning two boxes → no confinement → no moves.
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 2, 3, 4],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const resultBlocked = findClaimingPairs(ctx);

    expect(
      resultBlocked.filter((m) => m.type === "elimination")
    ).toHaveLength(0);

    // Also verify a board with real eliminations still produces moves.
    const boardActive = [
      [0, 0, 3, 4],
      [0, 0, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctxActive = createCtx(boardActive, 4, 2);

    const resultActive = findClaimingPairs(ctxActive);

    expect(resultActive.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Duplicate prevention ────────────────────────────────────────────

describe("findClaimingPairs — duplicate prevention", () => {
  it("returns only one LogicalMove per claiming deduction", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findClaimingPairs(ctx);

    const claimingMoves = result.filter(
      (m) => m.type === "elimination" && m.technique === "Claiming Pair"
    );

    // Row-0 claiming pair for value 1 exists but has 0 elims → skipped.
    // So no moves. Use the triple board for active duplicate verification.
    const tripleBoard = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 1],
    ];
    const ctxTriple = createCtx(tripleBoard, 9, 3);

    const resultTriple = findClaimingPairs(ctxTriple);
    const claimingMovesTriple = resultTriple.filter(
      (m) => m.type === "elimination" && m.technique === "Claiming Pair"
    );

    const seen = new Set<string>();
    for (const m of claimingMovesTriple) {
      if (m.type !== "elimination") continue;
      const key = `${m.patternCells.map((c) => `${c.row},${c.col}`).sort().join("|")}|${m.eliminations.map((e) => `${e.row},${e.col},${e.value}`).sort().join("|")}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

// ── Board immutability ─────────────────────────────────────────────

describe("findClaimingPairs — board immutability", () => {
  it("does not mutate the board", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 4, 2);

    findClaimingPairs(ctx);

    expect(board).toEqual(snapshot);
  });
});

// ── Zero X-Wing ────────────────────────────────────────────────────

describe("findXWings — zero X-Wing", () => {
  it("returns empty array for empty 4x4 board", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findXWings(ctx);

    expect(result).toEqual([]);
  });

  it("returns empty array when no value appears in exactly two rows in the same two columns", () => {
    const board = [
      [0, 0, 1, 2],
      [0, 0, 3, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findXWings(ctx);

    expect(result).toEqual([]);
  });
});

// ── Row-based X-Wing ──────────────────────────────────────────────

describe("findXWings — row-based", () => {
  it("finds a row-based X-Wing for value 1 in 4x4", () => {
    const board = [
      [0, 0, 2, 3],
      [0, 0, 0, 4],
      [0, 0, 4, 2],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findXWings(ctx);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const move = result.find(
      (m) => m.type === "elimination" && m.technique === "X-Wing"
    )!;
    expect(move).toBeDefined();
    if (move.type !== "elimination") return;
    expect(move.patternCells).toHaveLength(4);
    expect(move.patternCells).toContainEqual({ row: 0, col: 0 });
    expect(move.patternCells).toContainEqual({ row: 0, col: 1 });
    expect(move.patternCells).toContainEqual({ row: 2, col: 0 });
    expect(move.patternCells).toContainEqual({ row: 2, col: 1 });
    expect(move.eliminations).toContainEqual({ row: 1, col: 0, value: 1 });
    expect(move.eliminations).toContainEqual({ row: 1, col: 1, value: 1 });
  });
});

// ── Column-based X-Wing ───────────────────────────────────────────

describe("findXWings — column-based", () => {
  it("finds a column-based X-Wing for value 1 in 4x4", () => {
    // Column 0: 1 at rows 0,1 (cols 0,2 block 1 in rows 2,3 via givens).
    // Column 2: 1 at rows 0,1 (same).
    // Column-based X-Wing: cols 0,2; rows 0,1.
    // Row 0 has 1 in cols 0,2,3 (3 cells) and row 1 has 1 in cols 0,1,2
    // (3 cells) → row scan finds both rows individually but no matching pair,
    // so only the column-based scan produces a move.
    const board = [
      [0, 2, 0, 0],
      [0, 0, 0, 2],
      [2, 0, 3, 0],
      [3, 0, 2, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findXWings(ctx);

    // There may also be a row-based X-Wing from rows 2,3 cols 1,3 (different rectangle).
    const move = result.find(
      (m) =>
        m.type === "elimination" &&
        m.technique === "X-Wing" &&
        m.patternCells.some((c) => c.row === 0 && c.col === 0)
    )!;
    expect(move).toBeDefined();
    if (move.type !== "elimination") return;
    expect(move.patternCells).toHaveLength(4);
    expect(move.patternCells).toContainEqual({ row: 0, col: 0 });
    expect(move.patternCells).toContainEqual({ row: 0, col: 2 });
    expect(move.patternCells).toContainEqual({ row: 1, col: 0 });
    expect(move.patternCells).toContainEqual({ row: 1, col: 2 });
    // Column-based eliminations: rows 0,1 in other cols (1,3)
    expect(move.eliminations).toContainEqual({ row: 0, col: 3, value: 1 });
    expect(move.eliminations).toContainEqual({ row: 1, col: 1, value: 1 });
    expect(move.eliminations).toHaveLength(2);
  });
});

// ── X-Wing with no eliminations ───────────────────────────────────

describe("findXWings — no eliminations", () => {
  it("ignores an X-Wing whose columns outside the pattern rows have no candidates to eliminate", () => {
    const board = [
      [0, 0, 2, 3],
      [2, 3, 0, 4],
      [0, 0, 4, 2],
      [3, 2, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const resultBlocked = findXWings(ctx);

    expect(
      resultBlocked.filter((m) => m.type === "elimination")
    ).toHaveLength(0);

    const boardActive = [
      [0, 0, 2, 3],
      [0, 0, 0, 4],
      [0, 0, 4, 2],
      [0, 0, 0, 0],
    ];
    const ctxActive = createCtx(boardActive, 4, 2);
    const resultActive = findXWings(ctxActive);

    expect(resultActive.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Duplicate prevention ──────────────────────────────────────────

describe("findXWings — duplicate prevention", () => {
  it("returns only one LogicalMove per X-Wing", () => {
    const board = [
      [0, 0, 2, 3],
      [0, 0, 0, 4],
      [0, 0, 4, 2],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findXWings(ctx);

    const xwingMoves = result.filter(
      (m) => m.type === "elimination" && m.technique === "X-Wing"
    );

    const seen = new Set<string>();
    for (const m of xwingMoves) {
      if (m.type !== "elimination") continue;
      const key = `${m.patternCells.map((c) => `${c.row},${c.col}`).sort().join("|")}|${m.eliminations.map((e) => `${e.row},${e.col},${e.value}`).sort().join("|")}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

// ── Board immutability ────────────────────────────────────────────

describe("findXWings — board immutability", () => {
  it("does not mutate the board", () => {
    const board = [
      [0, 0, 2, 3],
      [0, 0, 0, 4],
      [0, 0, 4, 2],
      [0, 0, 0, 0],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 4, 2);

    findXWings(ctx);

    expect(board).toEqual(snapshot);
  });
});

// ── Zero Swordfish ──────────────────────────────────────────────────

describe("findSwordfish — zero Swordfish", () => {
  it("returns empty array for empty 4x4 board", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findSwordfish(ctx);

    expect(result).toEqual([]);
  });

  it("returns empty array when no value appears in 2-3 columns across 3 rows", () => {
    const board = [
      [0, 0, 1, 2],
      [0, 0, 3, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findSwordfish(ctx);

    expect(result).toEqual([]);
  });
});

// ── Row-based Swordfish ────────────────────────────────────────────

describe("findSwordfish — row-based", () => {
  it("finds a row-based Swordfish in 4x4", () => {
    // Rows 0,1,2 each have a candidate value in exactly 2 cols; union = {0,1,2}
    const board = [
      [0, 0, 1, 2],
      [0, 1, 0, 2],
      [1, 0, 0, 2],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findSwordfish(ctx);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const move = result.find(
      (m) => m.type === "elimination" && m.technique === "Swordfish"
    )!;
    expect(move).toBeDefined();
    if (move.type !== "elimination") return;

    // Pattern cells: only rows×col intersections where the candidate actually appears
    // Row 0 has v in cols {0,1}; Row 1 in {0,2}; Row 2 in {1,2} → 6 cells
    expect(move.patternCells).toHaveLength(6);
    expect(move.patternCells).toContainEqual({ row: 0, col: 0 });
    expect(move.patternCells).toContainEqual({ row: 0, col: 1 });
    expect(move.patternCells).toContainEqual({ row: 1, col: 0 });
    expect(move.patternCells).toContainEqual({ row: 1, col: 2 });
    expect(move.patternCells).toContainEqual({ row: 2, col: 1 });
    expect(move.patternCells).toContainEqual({ row: 2, col: 2 });
    // Given cells at pattern intersections are NOT included
    expect(move.patternCells).not.toContainEqual({ row: 0, col: 2 });
    expect(move.patternCells).not.toContainEqual({ row: 1, col: 1 });
    expect(move.patternCells).not.toContainEqual({ row: 2, col: 0 });

    // Eliminations from row 3 in cols {0,1,2} (should have exactly 3)
    expect(move.eliminations).toHaveLength(3);
    for (const e of move.eliminations) {
      expect(e.row).toBe(3);
      expect([0, 1, 2]).toContain(e.col);
    }
  });
});

// ── Column-based Swordfish ─────────────────────────────────────────

describe("findSwordfish — column-based", () => {
  it("finds a column-based Swordfish for value 4 in 4x4", () => {
    // Cols 0,1,2 each have 4 in exactly 2 rows; union = {0,2,3}
    const board = [
      [0, 0, 1, 3],
      [1, 2, 3, 0],
      [0, 1, 0, 3],
      [1, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findSwordfish(ctx);

    const move = result.find(
      (m) =>
        m.type === "elimination" &&
        m.technique === "Swordfish" &&
        m.patternCells.some((c) => c.row === 0 && c.col === 0)
    )!;
    expect(move).toBeDefined();
    if (move.type !== "elimination") return;

    // Column-based Swordfish, pattern rows {0,2,3}, pattern cols {0,1,2}
    // Col 0 has v in rows {0,2}; Col 1 in {0,3}; Col 2 in {2,3} → 6 cells
    expect(move.patternCells).toHaveLength(6);
    // Eliminations: 4 from pattern rows in non-pattern col 3
    expect(move.eliminations).toContainEqual({ row: 3, col: 3, value: 4 });
  });
});

// ── patternCells correctness ──────────────────────────────────────

describe("findSwordfish — patternCells correctness", () => {
  it("includes only empty cells that contain the candidate value", () => {
    const board = [
      [0, 0, 1, 2],
      [0, 1, 0, 2],
      [1, 0, 0, 2],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findSwordfish(ctx);

    for (const move of result) {
      if (move.type !== "elimination") continue;
      const v = move.eliminations[0]!.value;
      for (const cell of move.patternCells) {
        expect(board[cell.row]![cell.col]!).toBe(0);
        expect(hasCandidate(ctx.candidateMap[cell.row]![cell.col]!, v)).toBe(true);
      }
    }
  });
});

// ── Swordfish with no eliminations ─────────────────────────────────

describe("findSwordfish — no eliminations", () => {
  it("ignores a Swordfish where pattern columns have no candidates to eliminate", () => {
    // Rows 0,1,2 have 4 in cols {0,1,2} but row 3 is fully blocked from 4 in those cols
    const board = [
      [0, 0, 0, 1],
      [0, 0, 0, 2],
      [0, 0, 0, 3],
      [1, 2, 3, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const resultBlocked = findSwordfish(ctx);

    expect(
      resultBlocked.filter((m) => m.type === "elimination")
    ).toHaveLength(0);

    // Verify a board with real eliminations still produces moves
    const boardActive = [
      [0, 0, 1, 2],
      [0, 1, 0, 2],
      [1, 0, 0, 2],
      [0, 0, 0, 0],
    ];
    const ctxActive = createCtx(boardActive, 4, 2);
    const resultActive = findSwordfish(ctxActive);

    expect(resultActive.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Duplicate prevention ──────────────────────────────────────────

describe("findSwordfish — duplicate prevention", () => {
  it("returns only one LogicalMove per Swordfish", () => {
    const board = [
      [0, 0, 1, 2],
      [0, 1, 0, 2],
      [1, 0, 0, 2],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findSwordfish(ctx);

    const swordfishMoves = result.filter(
      (m) => m.type === "elimination" && m.technique === "Swordfish"
    );

    const seen = new Set<string>();
    for (const m of swordfishMoves) {
      if (m.type !== "elimination") continue;
      const key = `${m.patternCells.map((c) => `${c.row},${c.col}`).sort().join("|")}|${m.eliminations.map((e) => `${e.row},${e.col},${e.value}`).sort().join("|")}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

// ── Invalid 3×2 rectangle (must NOT detect) ───────────────────────

describe("findSwordfish — invalid 3×2 rectangle", () => {
  it("does not detect a 3×2 rectangle as Swordfish", () => {
    // Rows 0,1,2 all have 4 in only cols {0,1} → union = {0,1}, size < 3
    const board = [
      [0, 0, 1, 2],
      [0, 0, 1, 3],
      [0, 0, 2, 3],
      [1, 2, 3, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findSwordfish(ctx);

    expect(
      result.filter((m) => m.type === "elimination" && m.technique === "Swordfish")
    ).toHaveLength(0);
  });
});

// ── Multiple Swordfish on one board ───────────────────────────────

describe("findSwordfish — multiple Swordfish on one board", () => {
  it("finds multiple distinct Swordfish patterns on the same board", () => {
    // This board produces row-based Swordfish for values 3 AND 4
    // (both values are candidates in the same pattern cells and neither
    //  is placed as a given, so both form the pattern)
    const board = [
      [0, 0, 1, 2],
      [0, 1, 0, 2],
      [1, 0, 0, 2],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findSwordfish(ctx);

    const swordfishMoves = result.filter(
      (m) => m.type === "elimination" && m.technique === "Swordfish"
    );
    expect(swordfishMoves.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Board immutability ────────────────────────────────────────────

describe("findSwordfish — board immutability", () => {
  it("does not mutate the board", () => {
    const board = [
      [0, 0, 1, 2],
      [0, 1, 0, 2],
      [1, 0, 0, 2],
      [0, 0, 0, 0],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 4, 2);

    findSwordfish(ctx);

    expect(board).toEqual(snapshot);
  });
});

// ── CandidateMap immutability ────────────────────────────────────

describe("findSwordfish — CandidateMap immutability", () => {
  it("does not mutate the CandidateMap", () => {
    const board = [
      [0, 0, 1, 2],
      [0, 1, 0, 2],
      [1, 0, 0, 2],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);
    const snapshot = ctx.candidateMap.map((row) => [...row]);

    findSwordfish(ctx);

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        expect(ctx.candidateMap[r]![c]!).toEqual(snapshot[r]![c]!);
      }
    }
  });
});

// ── Zero XY-Wing ──────────────────────────────────────────────────

describe("findXYWing — zero XY-Wing", () => {
  it("returns empty array for empty 9x9 board", () => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    const ctx = createCtx(board, 9, 3);

    const result = findXYWing(ctx);

    expect(result).toEqual([]);
  });

  it("returns empty array for a solved board", () => {
    const board = [
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
    const ctx = createCtx(board, 9, 3);

    const result = findXYWing(ctx);

    expect(result).toEqual([]);
  });

  it("returns empty array when no bi-value cell can form an XY-Wing", () => {
    // Board where most empty cells have 1 or 3+ candidates, no XY-Wing forms
    const board = [
      [0, 2, 3, 0],
      [3, 0, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findXYWing(ctx);

    expect(result).toEqual([]);
  });
});

// ── Standard XY-Wing (single elimination) ─────────────────────────

describe("findXYWing — standard XY-Wing", () => {
  it("finds an XY-Wing in a 9x9 board (pivot [5,7], wings [2,5] and [2,7], eliminate 2)", () => {
    // Board state from HoDoKu XY-Wing example:
    // Pivot at (0,2)[5,7], Wing A at (0,5)[2,5], Wing B at (1,0)[2,7]
    // Elimination at (1,5) removes candidate 2
    const board = [
      [8, 0, 0, 3, 6, 0, 9, 0, 0],
      [0, 0, 9, 0, 1, 0, 8, 6, 3],
      [0, 6, 3, 0, 8, 9, 0, 0, 5],
      [9, 2, 4, 6, 7, 3, 1, 5, 8],
      [3, 8, 6, 9, 5, 1, 7, 2, 4],
      [5, 7, 1, 8, 2, 4, 3, 9, 6],
      [4, 3, 2, 1, 9, 6, 5, 8, 7],
      [6, 9, 8, 5, 3, 7, 0, 0, 0],
      [0, 0, 0, 2, 4, 8, 6, 3, 9],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 9, 3);

    const result = findXYWing(ctx);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const move = result.find(
      (m) => m.type === "elimination" && m.technique === "XY-Wing"
    )!;
    expect(move).toBeDefined();
    if (move.type !== "elimination") return;

    // Pattern cells: pivot, wing A, wing B
    expect(move.patternCells).toHaveLength(3);
    expect(move.patternCells).toContainEqual({ row: 0, col: 2 }); // pivot
    expect(move.patternCells).toContainEqual({ row: 0, col: 5 }); // wing A
    expect(move.patternCells).toContainEqual({ row: 1, col: 0 }); // wing B

    // Elimination: remove 2 from (1,5)
    expect(move.eliminations).toContainEqual({ row: 1, col: 5, value: 2 });

    expect(board).toEqual(snapshot);
  });
});

// ── Multiple eliminations ─────────────────────────────────────────

// ── XY-Wing with no eliminations ──────────────────────────────────

describe("findXYWing — no eliminations", () => {
  it("ignores an XY-Wing pattern where the elimination cell lacks candidate Z", () => {
    // Board where (1,5) has already been resolved (filled with 2),
    // and the cells that see both wings don't contain Z=2 as a candidate.
    const board = [
      [4, 0, 9, 0, 0, 0, 0, 0, 0],
      [0, 0, 2, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 9, 3);

    // Most cells have many candidates, so few bi-value cells exist
    // and those that do won't form a valid XY-Wing
    const result = findXYWing(ctx);

    expect(
      result.filter((m) => m.type === "elimination")
    ).toHaveLength(0);
  });
});

// ── Duplicate prevention ────────────────────────────────────────

describe("findXYWing — duplicate prevention", () => {
  it("returns only one LogicalMove per XY-Wing", () => {
    const board = [
      [8, 0, 0, 3, 6, 0, 9, 0, 0],
      [0, 0, 9, 0, 1, 0, 8, 6, 3],
      [0, 6, 3, 0, 8, 9, 0, 0, 5],
      [9, 2, 4, 6, 7, 3, 1, 5, 8],
      [3, 8, 6, 9, 5, 1, 7, 2, 4],
      [5, 7, 1, 8, 2, 4, 3, 9, 6],
      [4, 3, 2, 1, 9, 6, 5, 8, 7],
      [6, 9, 8, 5, 3, 7, 0, 0, 0],
      [0, 0, 0, 2, 4, 8, 6, 3, 9],
    ];
    const ctx = createCtx(board, 9, 3);

    const result = findXYWing(ctx);

    const xywingMoves = result.filter(
      (m) => m.type === "elimination" && m.technique === "XY-Wing"
    );

    // Each deduction should appear only once
    const seen = new Set<string>();
    for (const m of xywingMoves) {
      if (m.type !== "elimination") continue;
      const key = `${m.patternCells.map((c) => `${c.row},${c.col}`).sort().join("|")}|${m.eliminations.map((e) => `${e.row},${e.col},${e.value}`).sort().join("|")}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

// ── Board immutability ──────────────────────────────────────────

describe("findXYWing — board immutability", () => {
  it("does not mutate the board", () => {
    const board = [
      [8, 0, 0, 3, 6, 0, 9, 0, 0],
      [0, 0, 9, 0, 1, 0, 8, 6, 3],
      [0, 6, 3, 0, 8, 9, 0, 0, 5],
      [9, 2, 4, 6, 7, 3, 1, 5, 8],
      [3, 8, 6, 9, 5, 1, 7, 2, 4],
      [5, 7, 1, 8, 2, 4, 3, 9, 6],
      [4, 3, 2, 1, 9, 6, 5, 8, 7],
      [6, 9, 8, 5, 3, 7, 0, 0, 0],
      [0, 0, 0, 2, 4, 8, 6, 3, 9],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 9, 3);

    findXYWing(ctx);

    expect(board).toEqual(snapshot);
  });
});

// ── CandidateMap immutability ───────────────────────────────────

describe("findXYWing — CandidateMap immutability", () => {
  it("does not mutate the CandidateMap", () => {
    const board = [
      [8, 0, 0, 3, 6, 0, 9, 0, 0],
      [0, 0, 9, 0, 1, 0, 8, 6, 3],
      [0, 6, 3, 0, 8, 9, 0, 0, 5],
      [9, 2, 4, 6, 7, 3, 1, 5, 8],
      [3, 8, 6, 9, 5, 1, 7, 2, 4],
      [5, 7, 1, 8, 2, 4, 3, 9, 6],
      [4, 3, 2, 1, 9, 6, 5, 8, 7],
      [6, 9, 8, 5, 3, 7, 0, 0, 0],
      [0, 0, 0, 2, 4, 8, 6, 3, 9],
    ];
    const ctx = createCtx(board, 9, 3);
    const snapshot = ctx.candidateMap.map((row) => [...row]);

    findXYWing(ctx);

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        expect(ctx.candidateMap[r]![c]!).toEqual(snapshot[r]![c]!);
      }
    }
  });
});

// ── Skyscraper ────────────────────────────────────────────────────
// ── Zero Skyscraper ────────────────────────────────────────────────

describe("findSkyscraper — zero Skyscraper", () => {
  it("returns empty array for empty 4x4 board", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findSkyscraper(ctx);

    expect(result).toEqual([]);
  });

  it("returns empty array for a solved 4x4 board", () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findSkyscraper(ctx);

    expect(result).toEqual([]);
  });

  it("returns empty array when no candidate appears in exactly two rows with a shared column", () => {
    const board = [
      [0, 0, 2, 3],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findSkyscraper(ctx);

    expect(result).toEqual([]);
  });
});

// ── Row-based Skyscraper ───────────────────────────────────────

describe("findSkyscraper — row-based", () => {
  it("finds a row-based Skyscraper for value 1 in 4x4", () => {
    // Row 0: 1 in cols 0,3   (base col 0, top col 3)
    // Row 2: 1 in cols 0,2   (base col 0, top col 2)
    // Shared base column: 0
    // Top cells: (0,3) and (2,2)
    // (1,2) sees (0,3) via box (0,2)-(1,3), sees (2,2) via col 2 → remove 1
    // (3,3) sees (0,3) via col 3, sees (2,2) via box (2,2)-(3,3) → remove 1
    const board = [
      [0, 2, 3, 0],
      [3, 0, 0, 0],
      [0, 3, 0, 2],
      [2, 0, 0, 0],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 4, 2);

    const result = findSkyscraper(ctx);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const move = result.find(
      (m) => m.type === "elimination" && m.technique === "Skyscraper"
    )!;
    expect(move).toBeDefined();
    if (move.type !== "elimination") return;

    // Four pattern cells: base column cells + top cells
    expect(move.patternCells).toHaveLength(4);
    expect(move.patternCells).toContainEqual({ row: 0, col: 0 }); // base
    expect(move.patternCells).toContainEqual({ row: 0, col: 3 }); // top
    expect(move.patternCells).toContainEqual({ row: 2, col: 0 }); // base
    expect(move.patternCells).toContainEqual({ row: 2, col: 2 }); // top

    // Eliminations: remove 1 from (1,2) and (3,3)
    expect(move.eliminations).toContainEqual({ row: 1, col: 2, value: 1 });
    expect(move.eliminations).toContainEqual({ row: 3, col: 3, value: 1 });

    expect(board).toEqual(snapshot);
  });
});

// ── Skyscraper with no eliminations ─────────────────────────────

describe("findSkyscraper — no eliminations", () => {
  it("ignores a Skyscraper pattern where the elimination cells lack the candidate", () => {
    // Rows 0,2 form the same Skyscraper but the elimination cells
    // (1,2) and (3,3) are filled, blocking all eliminations
    const board = [
      [0, 2, 3, 0],
      [3, 0, 4, 0],
      [0, 3, 0, 2],
      [2, 0, 0, 4],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findSkyscraper(ctx);

    expect(
      result.filter((m) => m.type === "elimination")
    ).toHaveLength(0);
  });
});

// ── Duplicate prevention ──────────────────────────────────────

describe("findSkyscraper — duplicate prevention", () => {
  it("returns only one LogicalMove per Skyscraper", () => {
    const board = [
      [0, 2, 3, 0],
      [3, 0, 0, 0],
      [0, 3, 0, 2],
      [2, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);

    const result = findSkyscraper(ctx);

    const skyMoves = result.filter(
      (m) => m.type === "elimination" && m.technique === "Skyscraper"
    );

    const seen = new Set<string>();
    for (const m of skyMoves) {
      if (m.type !== "elimination") continue;
      const key = `${m.patternCells.map((c) => `${c.row},${c.col}`).sort().join("|")}|${m.eliminations.map((e) => `${e.row},${e.col},${e.value}`).sort().join("|")}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

// ── Board immutability ────────────────────────────────────────

describe("findSkyscraper — board immutability", () => {
  it("does not mutate the board", () => {
    const board = [
      [0, 2, 3, 0],
      [3, 0, 0, 0],
      [0, 3, 0, 2],
      [2, 0, 0, 0],
    ];
    const snapshot = cloneBoard(board);
    const ctx = createCtx(board, 4, 2);

    findSkyscraper(ctx);

    expect(board).toEqual(snapshot);
  });
});

// ── CandidateMap immutability ─────────────────────────────────

describe("findSkyscraper — CandidateMap immutability", () => {
  it("does not mutate the CandidateMap", () => {
    const board = [
      [0, 2, 3, 0],
      [3, 0, 0, 0],
      [0, 3, 0, 2],
      [2, 0, 0, 0],
    ];
    const ctx = createCtx(board, 4, 2);
    const snapshot = ctx.candidateMap.map((row) => [...row]);

    findSkyscraper(ctx);

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        expect(ctx.candidateMap[r]![c]!).toEqual(snapshot[r]![c]!);
      }
    }
  });
});

// ── Two-String Kite tests ──────────────────────────────────────────────────

// Helper: build a 9×9 board with value 1 at the given given cells.
function kiteBoard9(givens: Array<[number, number]>): number[][] {
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  for (const [r, c] of givens) {
    board[r]![c] = 1;
  }
  return board;
}

describe("findTwoStringKite — zero Two-String Kite", () => {
  it("returns empty array for empty 9x9 board", () => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    const ctx = createCtx(board, 9, 3);
    expect(findTwoStringKite(ctx)).toEqual([]);
  });

  it("returns empty array for a solved 9x9 board", () => {
    const board = [
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
      [4, 5, 6, 7, 8, 9, 1, 2, 3],
      [7, 8, 9, 1, 2, 3, 4, 5, 6],
      [2, 3, 4, 5, 6, 7, 8, 9, 1],
      [5, 6, 7, 8, 9, 1, 2, 3, 4],
      [8, 9, 1, 2, 3, 4, 5, 6, 7],
      [3, 4, 5, 6, 7, 8, 9, 1, 2],
      [6, 7, 8, 9, 1, 2, 3, 4, 5],
      [9, 1, 2, 3, 4, 5, 6, 7, 8],
    ];
    const ctx = createCtx(board, 9, 3);
    expect(findTwoStringKite(ctx)).toEqual([]);
  });

  it("returns empty array when no row has a strong link", () => {
    // Row 0 has 3 cells with value 1 → no row strong link
    const size = 4;
    const boxSize = 2;
    const board = Array.from({ length: size }, () => Array(size).fill(0));
    const candidateMap: number[][] = Array.from({ length: size }, () =>
      Array(size).fill(0)
    );
    candidateMap[0][0] = bit(1);
    candidateMap[0][2] = bit(1);
    candidateMap[0][3] = bit(1);
    const ctx: HumanSolverContext = { board, size: size as GridSize, boxSize, candidateMap };
    expect(findTwoStringKite(ctx)).toEqual([]);
  });

  it("returns empty array when row and column links have no cells in the same box", () => {
    // Row 0 strong link at cols 0,2 for value 1.
    // Col 3 strong link at rows 1,2 for value 1.
    // (0,0) box 0, (0,2) box 0, (1,3) box 1, (2,3) box 1.
    // No row endpoint shares a box with any col endpoint.
    const size = 4;
    const boxSize = 2;
    const board = Array.from({ length: size }, () => Array(size).fill(0));
    const candidateMap: number[][] = Array.from({ length: size }, () =>
      Array(size).fill(0)
    );
    candidateMap[0][0] = bit(1);
    candidateMap[0][2] = bit(1);
    candidateMap[1][3] = bit(1);
    candidateMap[2][3] = bit(1);

    const ctx: HumanSolverContext = { board, size: size as GridSize, boxSize, candidateMap };
    expect(findTwoStringKite(ctx)).toEqual([]);
  });
});

describe("findTwoStringKite — HoDoKu example 1 (col 6 \u00d7 row 7)", () => {
  // Verified example from HoDoKu: "2-String Kite: 5 in r2c7,r8c4 (connected by r8c9,r9c7) => r2c4<>5"
  // https://hodoku.sourceforge.net/en/show_example.php?file=2sk01&tech=2-String+Kite
  // 0-indexed:
  //   Col 6 strong link at rows (1, 8) — cells (1,6) and (8,6)
  //   Row 7 strong link at cols (3, 8) — cells (7,3) and (7,8)
  //   Box-mates: (7,8) and (8,6) in box 8 (rows 6-8, cols 6-8)
  //   Tips: (7,3) and (1,6)
  //   Elimination: (1,3) — row 1 sees (1,6), col 3 sees (7,3)
  it("finds the HoDoKu Two-String Kite for digit 5", () => {
    const size = 9;
    const boxSize = 3;
    const board = Array.from({ length: size }, () => Array(size).fill(0));
    const candidateMap: number[][] = Array.from({ length: size }, () =>
      Array(size).fill(0)
    );

    // Col 6 strong link: (1,6) and (8,6) have 5
    candidateMap[1][6] = bit(5);
    candidateMap[8][6] = bit(5);
    // Row 7 strong link: (7,3) and (7,8) have 5
    candidateMap[7][3] = bit(5);
    candidateMap[7][8] = bit(5);
    // Elimination target
    candidateMap[1][3] = bit(5);
    // No other cell has 5

    const ctx: HumanSolverContext = { board, size: size as GridSize, boxSize, candidateMap };
    const result = findTwoStringKite(ctx);

    const kiteMoves = result.filter(
      (m) => m.type === "elimination" && m.technique === "Two-String Kite"
    );
    expect(kiteMoves).toHaveLength(1);
  });
});

describe("findTwoStringKite — HoDoKu example 2 (row 5 \u00d7 col 1)", () => {
  // Verified example from HoDoKu: "2-String Kite: 9 in r6c6,r7c2 (connected by r4c2,r6c1) => r7c6<>9"
  // https://hodoku.sourceforge.net/en/show_example.php?file=2sk02&tech=2-String+Kite
  // 0-indexed:
  //   Row 5 strong link at cols (0, 5) — cells (5,0) and (5,5)
  //   Col 1 strong link at rows (3, 6) — cells (3,1) and (6,1)
  //   Box-mates: (5,0) and (3,1) in box 3 (rows 3-5, cols 0-2)
  //   Tips: (5,5) and (6,1)
  //   Elimination: (6,5) — row 6 sees (6,1), col 5 sees (5,5)
  it("finds the HoDoKu Two-String Kite for digit 9", () => {
    const size = 9;
    const boxSize = 3;
    const board = Array.from({ length: size }, () => Array(size).fill(0));
    const candidateMap: number[][] = Array.from({ length: size }, () =>
      Array(size).fill(0)
    );

    // Row 5 strong link: (5,0) and (5,5) have 9
    candidateMap[5][0] = bit(9);
    candidateMap[5][5] = bit(9);
    // Col 1 strong link: (3,1) and (6,1) have 9
    candidateMap[3][1] = bit(9);
    candidateMap[6][1] = bit(9);
    // Elimination target
    candidateMap[6][5] = bit(9);
    // No other cell has 9

    const ctx: HumanSolverContext = { board, size: size as GridSize, boxSize, candidateMap };
    const result = findTwoStringKite(ctx);

    const kiteMoves = result.filter(
      (m) => m.type === "elimination" && m.technique === "Two-String Kite"
    );
    expect(kiteMoves).toHaveLength(1);

    const move = kiteMoves[0]!;
    expect(move.patternCells).toEqual(
      expect.arrayContaining([
        { row: 5, col: 0 },
        { row: 5, col: 5 },
        { row: 3, col: 1 },
        { row: 6, col: 1 },
      ])
    );
    expect(move.patternCells).toHaveLength(4);
    expect(move.eliminations).toEqual(
      expect.arrayContaining([{ row: 6, col: 5, value: 9 }])
    );
  });
});

describe("findTwoStringKite — invalid box relationship", () => {
  it("returns empty array when no row and column endpoint pair shares a box", () => {
    // Row 0 strong link at cols (0, 7) for value 2.
    // Col 1 strong link at rows (3, 5) for value 2.
    // (0,0) box 0, (0,7) box 2, (3,1) box 3, (5,1) box 3.
    // No row endpoint shares a box with any col endpoint.
    const size = 9;
    const boxSize = 3;
    const board = Array.from({ length: size }, () => Array(size).fill(0));
    const candidateMap: number[][] = Array.from({ length: size }, () =>
      Array(size).fill(0)
    );
    candidateMap[0][0] = bit(2);
    candidateMap[0][7] = bit(2);
    candidateMap[3][1] = bit(2);
    candidateMap[5][1] = bit(2);
    const ctx: HumanSolverContext = { board, size: size as GridSize, boxSize, candidateMap };
    expect(findTwoStringKite(ctx)).toEqual([]);
  });

  it("returns empty array when the only same-box pair are the same cell", () => {
    // Row 2 strong link at cols (4, 7) for value 3.
    // Col 4 strong link at rows (2, 6) for value 3.
    // (2,4) is an endpoint of BOTH links → same cell, not a valid kite.
    const size = 9;
    const boxSize = 3;
    const board = Array.from({ length: size }, () => Array(size).fill(0));
    const candidateMap: number[][] = Array.from({ length: size }, () =>
      Array(size).fill(0)
    );
    candidateMap[2][4] = bit(3);
    candidateMap[2][7] = bit(3);
    candidateMap[6][4] = bit(3);
    const ctx: HumanSolverContext = { board, size: size as GridSize, boxSize, candidateMap };
    expect(findTwoStringKite(ctx)).toEqual([]);
  });
});

describe("findTwoStringKite — no eliminations", () => {
  it("ignores a Two-String Kite pattern where the elimination cell lacks the candidate", () => {
    // Same strong links as HoDoKu example 1 but (1,3) does NOT have candidate 5.
    const size = 9;
    const boxSize = 3;
    const board = Array.from({ length: size }, () => Array(size).fill(0));
    const candidateMap: number[][] = Array.from({ length: size }, () =>
      Array(size).fill(0)
    );
    candidateMap[1][6] = bit(5);
    candidateMap[8][6] = bit(5);
    candidateMap[7][3] = bit(5);
    candidateMap[7][8] = bit(5);
    const ctx: HumanSolverContext = { board, size: size as GridSize, boxSize, candidateMap };
    expect(findTwoStringKite(ctx)).toEqual([]);
  });
});

describe("findTwoStringKite — duplicate prevention", () => {
  it("returns only one LogicalMove per Two-String Kite", () => {
    // Set up the HoDoKu example 1 pattern only.
    const size = 9;
    const boxSize = 3;
    const board = Array.from({ length: size }, () => Array(size).fill(0));
    const candidateMap: number[][] = Array.from({ length: size }, () =>
      Array(size).fill(0)
    );
    candidateMap[1][6] = bit(5);
    candidateMap[8][6] = bit(5);
    candidateMap[7][3] = bit(5);
    candidateMap[7][8] = bit(5);
    candidateMap[1][3] = bit(5);

    const ctx: HumanSolverContext = { board, size: size as GridSize, boxSize, candidateMap };
    const result = findTwoStringKite(ctx);

    const kiteMoves = result.filter(
      (m) => m.type === "elimination" && m.technique === "Two-String Kite"
    );

    const seen = new Set<string>();
    for (const m of kiteMoves) {
      if (m.type !== "elimination") continue;
      const key = `${m.patternCells.map((c) => `${c.row},${c.col}`).sort().join("|")}|${m.eliminations.map((e) => `${e.row},${e.col},${e.value}`).sort().join("|")}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe("findTwoStringKite — board immutability", () => {
  it("does not mutate the board", () => {
    const size = 9;
    const boxSize = 3;
    const board = Array.from({ length: size }, () => Array(size).fill(0));
    const candidateMap: number[][] = Array.from({ length: size }, () =>
      Array(size).fill(0)
    );
    candidateMap[1][6] = bit(5);
    candidateMap[8][6] = bit(5);
    candidateMap[7][3] = bit(5);
    candidateMap[7][8] = bit(5);
    candidateMap[1][3] = bit(5);

    const snapshot = cloneBoard(board);
    const ctx: HumanSolverContext = { board, size: size as GridSize, boxSize, candidateMap };
    findTwoStringKite(ctx);
    expect(board).toEqual(snapshot);
  });
});

describe("findTwoStringKite — CandidateMap immutability", () => {
  it("does not mutate the CandidateMap", () => {
    const size = 9;
    const boxSize = 3;
    const board = Array.from({ length: size }, () => Array(size).fill(0));
    const candidateMap: number[][] = Array.from({ length: size }, () =>
      Array(size).fill(0)
    );
    candidateMap[1][6] = bit(5);
    candidateMap[8][6] = bit(5);
    candidateMap[7][3] = bit(5);
    candidateMap[7][8] = bit(5);
    candidateMap[1][3] = bit(5);

    const ctx: HumanSolverContext = { board, size: size as GridSize, boxSize, candidateMap };
    const snapshot = ctx.candidateMap.map((row) => [...row]);
    findTwoStringKite(ctx);

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        expect(ctx.candidateMap[r]![c]!).toEqual(snapshot[r]![c]!);
      }
    }
  });
});
