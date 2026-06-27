import { describe, it, expect } from "vitest";
import { findNakedSingles, findHiddenSingles } from "./HumanSolver";

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

    const result = findNakedSingles(board, 4, 2);

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

    const result = findNakedSingles(board, 4, 2);

    expect(result).toEqual([]);
    expect(board).toEqual(snapshot);
  });

  it("returns empty array when empty cells have multiple candidates", () => {
    // Row 2 is fully filled (1-4), all other cells have ≥2 candidates.
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 2, 3, 4],
      [0, 0, 0, 0],
    ];
    const snapshot = cloneBoard(board);

    const result = findNakedSingles(board, 4, 2);

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

    const result = findNakedSingles(board, 4, 2);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
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

    const result = findNakedSingles(board, 9, 3);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
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

    const result = findNakedSingles(board, 4, 2);

    expect(result).toHaveLength(3);

    expect(result).toContainEqual({
      row: 0, col: 0, value: 1, technique: "Naked Single",
    });
    expect(result).toContainEqual({
      row: 1, col: 2, value: 1, technique: "Naked Single",
    });
    expect(result).toContainEqual({
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

    const result = findHiddenSingles(board, 9, 3);

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

    const result = findHiddenSingles(board, 9, 3);

    expect(result).toEqual([]);
    expect(board).toEqual(snapshot);
  });
});

// ── One Hidden Single ────────────────────────────────────────────────────

describe("findHiddenSingles — one Hidden Single", () => {
  it("finds a Hidden Single in a row (value 2 at (0,0))", () => {
    // Row 0: (0,1)=1 blocks 1. Cols 2-8 each have a 2 elsewhere, so only
    // (0,0) can take value 2 within row 0.
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

    const result = findHiddenSingles(board, 9, 3);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result).toContainEqual({
      row: 0,
      col: 0,
      value: 2,
      technique: "Hidden Single",
    });
    expect(board).toEqual(snapshot);
  });

  it("finds a Hidden Single in a column (value 3 at (5,3))", () => {
    // Column 3: (1,3)=1, (2,3)=2.  Rows 0,3,4,6,7,8 each have a 3 elsewhere,
    // blocking 3 in col 3. Only row 5 is free of 3, so (5,3) is the sole
    // cell in column 3 that can take value 3.
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

    const result = findHiddenSingles(board, 9, 3);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result).toContainEqual({
      row: 5,
      col: 3,
      value: 3,
      technique: "Hidden Single",
    });
    expect(board).toEqual(snapshot);
  });

  it("finds a Hidden Single in a box (value 2 at (0,0))", () => {
    // Same board as row test: box (0,0)-(2,2) has only (0,0) able to hold 2.
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

    const result = findHiddenSingles(board, 9, 3);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result).toContainEqual({
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
    // Combines both row-hidden (2 at (0,0)) and column-hidden (3 at (5,3))
    // scenarios on a single board.
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

    const result = findHiddenSingles(board, 9, 3);

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result).toContainEqual({
      row: 0, col: 0, value: 2, technique: "Hidden Single",
    });
    expect(result).toContainEqual({
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

    findHiddenSingles(board, 9, 3);

    expect(board).toEqual(snapshot);
  });
});
