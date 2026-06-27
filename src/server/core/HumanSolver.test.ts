import { describe, it, expect } from "vitest";
import { buildCandidateMap } from "./CandidateEngine";
import {
  findNakedSingles,
  findHiddenSingles,
  findNakedPairs,
  findHiddenPairs,
  findPointingPairs,
  findClaimingPairs,
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
