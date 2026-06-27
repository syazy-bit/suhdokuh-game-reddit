import { describe, it, expect } from "vitest";
import { buildCandidateMap } from "./CandidateEngine";
import {
  findNakedSingles,
  findHiddenSingles,
  findNakedPairs,
  type HumanSolverContext,
} from "./HumanSolver";
import type { GridSize } from "./SudokuValidator";

function createCtx(
  board: number[][],
  size: GridSize,
  boxSize: number
): HumanSolverContext {
  return {
    board,
    size,
    boxSize,
    candidateMap: buildCandidateMap(board, size, boxSize),
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
