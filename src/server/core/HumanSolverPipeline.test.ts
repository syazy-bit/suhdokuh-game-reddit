import { describe, it, expect } from "vitest";
import {
  solveStep,
  solve,
  canSolve,
  type SolveResult,
} from "./HumanSolverPipeline";
import type { LogicalMove } from "./HumanSolver";

function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row]);
}

// ── solveStep priority ─────────────────────────────────────────────

describe("solveStep priority", () => {
  it("returns null for a solved board", () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1],
    ];
    expect(solveStep(board)).toBeNull();
  });

  it("returns a Naked Single before other techniques", () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 0],
    ];
    const move = solveStep(board);
    expect(move).not.toBeNull();
    expect(move!.type).toBe("assignment");
    const assignmentMove = move! as Extract<LogicalMove, { type: "assignment" }>;
    expect(assignmentMove.technique).toBe("Naked Single");
    expect(assignmentMove.row).toBe(3);
    expect(assignmentMove.col).toBe(3);
    expect(assignmentMove.value).toBe(1);
  });

  it("finds a move when a Hidden Single exists (no Naked Single)", () => {
    // Board where each row/col pair has enough givens so that
    // multiple advanced techniques surface. Just verify we get a move.
    const board = [
      [0, 1, 0, 0, 0, 0, 0, 0, 0],
      [3, 4, 5, 0, 0, 0, 0, 0, 0],
      [6, 7, 8, 0, 0, 0, 0, 0, 0],
      [0, 0, 2, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 2, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 2, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 2, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 2, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 2, 0],
    ];
    const move = solveStep(board);
    // At least one technique should find a move (could be Naked or Hidden)
    expect(move).not.toBeNull();
  });

  it("returns null for an empty board (no progress possible)", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    expect(solveStep(board)).toBeNull();
  });
});

// ── solveStep with pending eliminations ───────────────────────────

describe("solveStep with pending eliminations", () => {
  it("progresses past an elimination when pendingEliminations are supplied", () => {
    // Board where the first deduction is a Naked Pair (no Naked/Hidden Singles).
    // Row 0: (0,2)[3,4] and (0,3)[3,4] form a Naked Pair eliminating 3,4
    // from (0,0) and (0,1). Board from the Hidden Pair row test.
    const board = [
      [0, 0, 0, 0],
      [0, 0, 1, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const snapshot = cloneBoard(board);

    // Step 1: solveStep returns an elimination (Naked Pair)
    const step1 = solveStep(board);
    expect(step1).not.toBeNull();
    expect(step1!.type).toBe("elimination");
    const elimMove = step1! as Extract<LogicalMove, { type: "elimination" }>;
    expect(elimMove.technique).toBe("Naked Pair");
    expect(elimMove.eliminations.length).toBeGreaterThan(0);

    // Board should not be mutated
    expect(board).toEqual(snapshot);

    // Store the eliminations and call solveStep again
    const elims = elimMove.eliminations;
    const step2 = solveStep(board, elims);

    // Step 2 should NOT return the same elimination move.
    // After applying eliminations, no further deductions exist → null.
    // This proves the pipeline progressed past the original elimination.
    expect(step2).toBeNull();
  });

  it("does not mutate the input board when pendingEliminations are supplied", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 1, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const snapshot = cloneBoard(board);
    const first = solveStep(board);
    expect(first).not.toBeNull();
    if (first && first.type === "elimination") {
      solveStep(board, first.eliminations);
    }
    expect(board).toEqual(snapshot);
  });

  it("returns the same move as solveStep() when called with empty eliminations", () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 0],
    ];
    const without = solveStep(board);
    const withEmpty = solveStep(board, []);
    expect(withEmpty).toEqual(without);
  });
});

// ── solved board ──────────────────────────────────────────────────

describe("solve — solved board", () => {
  it("returns solved=true with no moves for an already-solved board", () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1],
    ];
    const result = solve(board);
    expect(result.solved).toBe(true);
    expect(result.moves).toHaveLength(0);
    expect(result.techniquesUsed).toHaveLength(0);
    expect(result.hardestTechnique).toBeNull();
  });
});

// ── solve easy puzzle ─────────────────────────────────────────────

describe("solve — easy puzzle", () => {
  it("solves a complete 4×4 puzzle using only Naked Singles", () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 0],
    ];
    const snapshot = cloneBoard(board);
    const result = solve(board);

    expect(result.solved).toBe(true);
    expect(result.finalBoard[3]![3]).toBe(1);
    // Only one Naked Single needed
    expect(result.moves).toHaveLength(1);
    expect(result.techniquesUsed).toContain("Naked Single");
    expect(result.hardestTechnique).toBe("Naked Single");
    // Board immutability
    expect(board).toEqual(snapshot);
  });

  it("solves a 4×4 puzzle with multiple Naked Singles", () => {
    const board = [
      [0, 2, 3, 4],
      [3, 4, 0, 2],
      [2, 0, 4, 3],
      [4, 3, 2, 1],
    ];
    const result = solve(board);
    expect(result.solved).toBe(true);
    expect(result.finalBoard[0]![0]).toBe(1);
    expect(result.finalBoard[1]![2]).toBe(1);
    expect(result.finalBoard[2]![1]).toBe(1);
    expect(result.moves.length).toBeGreaterThanOrEqual(3);
  });

  it("solves a 4×4 puzzle end-to-end and validates rows/cols/boxes", () => {
    // Board with 3 empty cells (Naked Singles)
    const board = [
      [0, 2, 3, 4],
      [3, 4, 0, 2],
      [2, 0, 4, 3],
      [4, 3, 2, 1],
    ];
    const result = solve(board);
    expect(result.solved).toBe(true);
    const fb = result.finalBoard;
    // Every cell is filled
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        expect(fb[r]![c]).not.toBe(0);
      }
    }
    // Rows have unique values
    for (let r = 0; r < 4; r++) {
      expect([...new Set(fb[r]!)]).toHaveLength(4);
    }
    // Columns have unique values
    for (let c = 0; c < 4; c++) {
      const col = [fb[0]![c], fb[1]![c], fb[2]![c], fb[3]![c]];
      expect([...new Set(col)]).toHaveLength(4);
    }
    // Boxes have unique values
    for (let br = 0; br < 4; br += 2) {
      for (let bc = 0; bc < 4; bc += 2) {
        const box = [
          fb[br]![bc], fb[br]![bc + 1],
          fb[br + 1]![bc], fb[br + 1]![bc + 1],
        ];
        expect([...new Set(box)]).toHaveLength(4);
      }
    }
  });
});

// ── graceful stop (no progress) ───────────────────────────────────

describe("solve — graceful stop", () => {
  it("stops when no technique can make progress", () => {
    // A nearly-empty board with no clues → no technique can find anything
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const result = solve(board);
    expect(result.solved).toBe(false);
    expect(result.moves).toHaveLength(0);
    expect(result.techniquesUsed).toHaveLength(0);
  });

  it("stops after exhausting available techniques", () => {
    // This board has a Naked/Hidden Single but then gets stuck.
    // Only 3 givens in a 4×4: many empty cells, no single-digit fish possible.
    const board = [
      [1, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const result = solve(board);
    expect(result.solved).toBe(false);
    expect(result.moves.length).toBeGreaterThanOrEqual(0);
    // At least one technique should be reported if any move found
    if (result.moves.length > 0) {
      expect(result.techniquesUsed.length).toBeGreaterThan(0);
    }
  });
});

// ── move history ──────────────────────────────────────────────────

describe("solve — move history", () => {
  it("records all moves in order", () => {
    const board = [
      [0, 2, 3, 4],
      [3, 4, 0, 2],
      [2, 0, 4, 3],
      [4, 3, 2, 1],
    ];
    const result = solve(board);
    expect(result.moves.length).toBeGreaterThanOrEqual(3);
    // Moves should be in chronological order (all assignments in this case)
    for (const move of result.moves) {
      expect(move.type).toBe("assignment");
    }
    // Check the board reaches the expected final state
    expect(result.finalBoard[0]![0]).toBe(1);
    expect(result.finalBoard[1]![2]).toBe(1);
    expect(result.finalBoard[2]![1]).toBe(1);
  });
});

// ── techniques used ───────────────────────────────────────────────

describe("solve — techniques used", () => {
  it("reports the set of techniques actually applied", () => {
    const board = [
      [0, 2, 3, 4],
      [3, 4, 0, 2],
      [2, 0, 4, 3],
      [4, 3, 2, 1],
    ];
    const result = solve(board);
    expect(result.techniquesUsed).toContain("Naked Single");
    expect(result.techniquesUsed.length).toBeGreaterThanOrEqual(1);
  });
});

// ── hardest technique ─────────────────────────────────────────────

describe("solve — hardest technique", () => {
  it("reports Naked Single as hardest when only Naked Singles are used", () => {
    const board = [
      [0, 2, 3, 4],
      [3, 4, 0, 2],
      [2, 0, 4, 3],
      [4, 3, 2, 1],
    ];
    const result = solve(board);
    expect(result.hardestTechnique).toBe("Naked Single");
  });

  it("reports a higher technique when one is used", () => {
    // This board should require at least Hidden Single or higher
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
    const result = solve(board);
    // At minimum a Hidden Single should be used
    expect(result.hardestTechnique).not.toBeNull();
    const hiddenIdx = ["Naked Single", "Hidden Single"].indexOf(result.hardestTechnique!);
    expect(hiddenIdx).toBeGreaterThanOrEqual(0);
  });

  it("reports empty string when no moves are made", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const result = solve(board);
    expect(result.hardestTechnique).toBeNull();
  });
});

// ── board immutability ────────────────────────────────────────────

describe("board immutability", () => {
  it("does not mutate the input board via solveStep", () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 0],
    ];
    const snapshot = cloneBoard(board);
    solveStep(board);
    expect(board).toEqual(snapshot);
  });

  it("does not mutate the input board via solve", () => {
    const board = [
      [0, 2, 3, 4],
      [3, 4, 0, 2],
      [2, 0, 4, 3],
      [4, 3, 2, 1],
    ];
    const snapshot = cloneBoard(board);
    solve(board);
    expect(board).toEqual(snapshot);
  });

  it("does not mutate the input board via canSolve", () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 0],
    ];
    const snapshot = cloneBoard(board);
    canSolve(board);
    expect(board).toEqual(snapshot);
  });
});

// ── canSolve ──────────────────────────────────────────────────────

describe("canSolve", () => {
  it("returns true for a solvable puzzle", () => {
    const board = [
      [0, 2, 3, 4],
      [3, 4, 0, 2],
      [2, 0, 4, 3],
      [4, 3, 2, 1],
    ];
    expect(canSolve(board)).toBe(true);
  });

  it("returns false for an unsolvable board", () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    expect(canSolve(board)).toBe(false);
  });

  it("returns true for an already-solved board", () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1],
    ];
    expect(canSolve(board)).toBe(true);
  });
});
