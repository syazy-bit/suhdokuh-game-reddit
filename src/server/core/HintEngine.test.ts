import { describe, it, expect } from "vitest";
import { getHint, type Hint } from "./HintEngine";
import { TECHNIQUE_DESCRIPTIONS } from "./TechniqueDescriptions";
import { TECHNIQUES, type Technique } from "./HumanSolverTypes";
import type { LogicalMove } from "./HumanSolver";

function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row]);
}

// ── returns null when no move exists ──────────────────────────────

describe("getHint returns null", () => {
  it("returns null for a solved board", () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1],
    ];
    expect(getHint(board)).toBeNull();
  });

  it("returns null for an empty board (no progress possible)", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    expect(getHint(board)).toBeNull();
  });
});

// ── assignment move becomes Hint ──────────────────────────────────

describe("assignment move becomes Hint", () => {
  it("returns a Hint with type=assignment for a Naked Single", () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 0],
    ];
    const hint = getHint(board);
    expect(hint).not.toBeNull();
    expect(hint!.move.type).toBe("assignment");
    const assignMove = hint!.move as Extract<LogicalMove, { type: "assignment" }>;
    expect(assignMove.row).toBe(3);
    expect(assignMove.col).toBe(3);
    expect(assignMove.value).toBe(1);
  });
});

// ── elimination move becomes Hint ─────────────────────────────────

describe("elimination move becomes Hint", () => {
  it("returns a Hint with type=elimination for a Naked Pair", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 1, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const hint = getHint(board);
    expect(hint).not.toBeNull();
    expect(hint!.move.type).toBe("elimination");
    const elimMove = hint!.move as Extract<LogicalMove, { type: "elimination" }>;
    expect(elimMove.technique).toBe("Naked Pair");
    expect(elimMove.eliminations.length).toBeGreaterThan(0);
    expect(elimMove.patternCells.length).toBe(2);
  });
});

// ── move object preserved exactly ─────────────────────────────────

describe("move object preserved exactly", () => {
  it("returns the same move object reference from solveStep", () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 0],
    ];
    const hint = getHint(board);
    expect(hint).not.toBeNull();
    // All LogicalMove fields should be present and correct
    expect(hint!.move).toHaveProperty("type", "assignment");
    expect(hint!.move).toHaveProperty("row");
    expect(hint!.move).toHaveProperty("col");
    expect(hint!.move).toHaveProperty("value");
    expect(hint!.move).toHaveProperty("technique");
  });

  it("preserves patternCells and eliminations on elimination moves", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 1, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const hint = getHint(board);
    expect(hint).not.toBeNull();
    expect(hint!.move.type).toBe("elimination");
    const elimMove = hint!.move as Extract<LogicalMove, { type: "elimination" }>;
    expect(Array.isArray(elimMove.patternCells)).toBe(true);
    expect(Array.isArray(elimMove.eliminations)).toBe(true);
    for (const cell of elimMove.patternCells) {
      expect(cell).toHaveProperty("row");
      expect(cell).toHaveProperty("col");
    }
    for (const e of elimMove.eliminations) {
      expect(e).toHaveProperty("row");
      expect(e).toHaveProperty("col");
      expect(e).toHaveProperty("value");
    }
  });
});

// ── title, summary, explanation exactly match registry ─────────────

describe("title, summary, explanation exactly match registry", () => {
  it("title matches the registry entry for the move's technique", () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 0],
    ];
    const hint = getHint(board);
    expect(hint).not.toBeNull();
    const expected = TECHNIQUE_DESCRIPTIONS[hint!.move.technique];
    expect(hint!.title).toBe(expected.title);
  });

  it("summary matches the registry entry for the move's technique", () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 0],
    ];
    const hint = getHint(board);
    expect(hint).not.toBeNull();
    const expected = TECHNIQUE_DESCRIPTIONS[hint!.move.technique];
    expect(hint!.summary).toBe(expected.summary);
  });

  it("explanation matches the registry entry for the move's technique", () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 0],
    ];
    const hint = getHint(board);
    expect(hint).not.toBeNull();
    const expected = TECHNIQUE_DESCRIPTIONS[hint!.move.technique];
    expect(hint!.explanation).toBe(expected.explanation);
  });

  it("all description fields match exactly for elimination moves", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 1, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const hint = getHint(board);
    expect(hint).not.toBeNull();
    const expected = TECHNIQUE_DESCRIPTIONS[hint!.move.technique];
    expect(hint!.title).toBe(expected.title);
    expect(hint!.summary).toBe(expected.summary);
    expect(hint!.explanation).toBe(expected.explanation);
  });
});

// ── pendingEliminations respected ─────────────────────────────────

describe("pendingEliminations respected", () => {
  it("returns null when pending eliminations exhaust all progress", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 1, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const first = getHint(board);
    expect(first).not.toBeNull();
    expect(first!.move.type).toBe("elimination");
    const elimMove = first!.move as Extract<LogicalMove, { type: "elimination" }>;

    const second = getHint(board, elimMove.eliminations);
    expect(second).toBeNull();
  });

  it("returns the same hint with empty pendingEliminations as without", () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 0],
    ];
    const without = getHint(board);
    const withEmpty = getHint(board, []);
    expect(withEmpty).not.toBeNull();
    expect(without).not.toBeNull();
    expect(withEmpty!.move).toEqual(without!.move);
    expect(withEmpty!.title).toBe(without!.title);
  });
});

// ── board immutability ────────────────────────────────────────────

describe("board immutability", () => {
  it("does not mutate the input board", () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 0],
    ];
    const snapshot = cloneBoard(board);
    getHint(board);
    expect(board).toEqual(snapshot);
  });

  it("does not mutate the input board with pendingEliminations", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 1, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const snapshot = cloneBoard(board);
    const first = getHint(board);
    expect(first).not.toBeNull();
    if (first!.move.type === "elimination") {
      getHint(board, first!.move.eliminations);
    }
    expect(board).toEqual(snapshot);
  });
});

// ── pendingEliminations immutability ──────────────────────────────

describe("pendingEliminations immutability", () => {
  it("does not mutate the pendingEliminations array", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 1, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const first = getHint(board);
    expect(first).not.toBeNull();
    if (first!.move.type === "elimination") {
      const elims = [...first!.move.eliminations];
      const snapshot = elims.map((e) => ({ ...e }));
      getHint(board, elims);
      expect(elims).toEqual(snapshot);
    }
  });
});

// ── description registry covers every Technique ───────────────────

describe("description registry covers every Technique", () => {
  it("has an entry for every technique in the TECHNIQUES array", () => {
    const registered = new Set(Object.keys(TECHNIQUE_DESCRIPTIONS));
    for (const technique of TECHNIQUES) {
      expect(registered.has(technique)).toBe(true);
    }
  });

  it("has non-empty title, summary, explanation for every technique", () => {
    const techniques = TECHNIQUES as readonly Technique[];
    for (const technique of techniques) {
      const desc = TECHNIQUE_DESCRIPTIONS[technique];
      expect(desc).toBeDefined();
      expect(desc.title.length).toBeGreaterThan(0);
      expect(desc.summary.length).toBeGreaterThan(0);
      expect(desc.explanation.length).toBeGreaterThan(0);
    }
  });
});
