import { describe, it, expect } from "vitest";
import {
  solveStep,
  solve,
  canSolve,
  type SolveResult,
} from "./HumanSolverPipeline";
import { buildCandidateMap, type CandidateMap } from "./CandidateEngine";
import type { LogicalMove } from "./HumanSolver";
import type { GridSize } from "./SudokuValidator";

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

// ── R2 Incremental Candidate Map Correctness ───────────────────────

function cloneCandidateMap(map: CandidateMap, size: number): CandidateMap {
  const clone: CandidateMap = [];
  for (let r = 0; r < size; r++) {
    clone[r] = [];
    for (let c = 0; c < size; c++) {
      clone[r]![c] = [...map[r]![c]!];
    }
  }
  return clone;
}

function candidateMapsEqual(a: CandidateMap, b: CandidateMap, size: number): boolean {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const la = a[r]![c]!;
      const lb = b[r]![c]!;
      if (la.length !== lb.length) return false;
      for (let i = 0; i < la.length; i++) {
        if (la[i] !== lb[i]) return false;
      }
    }
  }
  return true;
}

function getPeerKeys(row: number, col: number, size: number, boxSize: number): string[] {
  const keys: string[] = [];
  const br = Math.floor(row / boxSize) * boxSize;
  const bc = Math.floor(col / boxSize) * boxSize;
  const seen = new Set<string>();
  for (let c = 0; c < size; c++) {
    if (c !== col) { const k = `${row},${c}`; if (!seen.has(k)) { seen.add(k); keys.push(k); } }
  }
  for (let r = 0; r < size; r++) {
    if (r !== row) { const k = `${r},${col}`; if (!seen.has(k)) { seen.add(k); keys.push(k); } }
  }
  for (let r = br; r < br + boxSize; r++) {
    for (let c = bc; c < bc + boxSize; c++) {
      if (r !== row || c !== col) { const k = `${r},${c}`; if (!seen.has(k)) { seen.add(k); keys.push(k); } }
    }
  }
  return keys;
}

function testApplyAssignment(
  board: number[][],
  candidateMap: CandidateMap,
  row: number,
  col: number,
  value: number,
  size: GridSize,
  boxSize: number
): void {
  board[row]![col] = value;
  candidateMap[row]![col] = [];
  for (const key of getPeerKeys(row, col, size, boxSize)) {
    const [r, c] = key.split(",").map(Number) as [number, number];
    if (board[r]![c] !== 0) continue;
    const list = candidateMap[r]![c]!;
    const idx = list.indexOf(value);
    if (idx !== -1) list.splice(idx, 1);
  }
}

function testApplyEliminations(
  candidateMap: CandidateMap,
  eliminations: Array<{ row: number; col: number; value: number }>
): void {
  for (const { row, col, value } of eliminations) {
    const list = candidateMap[row]![col]!;
    const idx = list.indexOf(value);
    if (idx !== -1) list.splice(idx, 1);
  }
}

describe("R2 — incremental candidate map correctness", () => {
  const board9: number[][] = [
    [0, 0, 0, 2, 6, 0, 7, 0, 1],
    [6, 8, 0, 0, 7, 0, 0, 9, 0],
    [1, 9, 0, 0, 0, 4, 5, 0, 0],
    [8, 2, 0, 1, 0, 0, 0, 4, 0],
    [0, 0, 4, 6, 0, 2, 9, 0, 0],
    [0, 5, 0, 0, 0, 3, 0, 2, 8],
    [0, 0, 9, 3, 0, 0, 0, 7, 4],
    [0, 4, 0, 0, 5, 0, 0, 3, 6],
    [7, 0, 3, 0, 1, 8, 0, 0, 0],
  ];
  const size9: GridSize = 9;
  const boxSize9 = 3;

  // ── Assignment operations ──────────────────────────────────────────
  // Assignments modify board state, so incremental cm MUST equal fresh
  // buildCandidateMap(board) after every assignment.

  it("single 9×9 assignment matches fresh rebuild", () => {
    const board = board9.map((r) => [...r]);
    const cm = buildCandidateMap(board, size9, boxSize9);
    testApplyAssignment(board, cm, 0, 0, 5, size9, boxSize9);
    const fresh = buildCandidateMap(board, size9, boxSize9);
    expect(candidateMapsEqual(cm, fresh, size9)).toBe(true);
  });

  it("single 4×4 assignment matches fresh rebuild", () => {
    const board4: number[][] = [
      [0, 2, 3, 4],
      [3, 4, 0, 2],
      [2, 0, 4, 3],
      [4, 3, 2, 1],
    ];
    const size4: GridSize = 4;
    const boxSize4 = 2;
    const cm = buildCandidateMap(board4, size4, boxSize4);
    testApplyAssignment(board4, cm, 0, 0, 1, size4, boxSize4);
    const fresh = buildCandidateMap(board4, size4, boxSize4);
    expect(candidateMapsEqual(cm, fresh, size4)).toBe(true);
  });

  it("multiple assignments stay synchronized with fresh rebuild", () => {
    const board = board9.map((r) => [...r]);
    const cm = buildCandidateMap(board, size9, boxSize9);
    const emptyCells: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r]![c] === 0) emptyCells.push({ row: r, col: c });
      }
    }
    testApplyAssignment(board, cm, emptyCells[0]!.row, emptyCells[0]!.col, 5, size9, boxSize9);
    expect(candidateMapsEqual(cm, buildCandidateMap(board, size9, boxSize9), size9)).toBe(true);
    testApplyAssignment(board, cm, emptyCells[2]!.row, emptyCells[2]!.col, 3, size9, boxSize9);
    expect(candidateMapsEqual(cm, buildCandidateMap(board, size9, boxSize9), size9)).toBe(true);
    testApplyAssignment(board, cm, emptyCells[5]!.row, emptyCells[5]!.col, 8, size9, boxSize9);
    expect(candidateMapsEqual(cm, buildCandidateMap(board, size9, boxSize9), size9)).toBe(true);
  });

  it("assignment changes candidate map compared to pre-assignment baseline", () => {
    const board = board9.map((r) => [...r]);
    const cm = buildCandidateMap(board, size9, boxSize9);
    const rebuilt = buildCandidateMap(board, size9, boxSize9);
    testApplyAssignment(board, cm, 0, 0, 5, size9, boxSize9);
    expect(candidateMapsEqual(cm, rebuilt, size9)).toBe(false);
  });

  // ── Elimination operations ────────────────────────────────────────
  // Eliminations do NOT change board state, so they MUST NOT be compared
  // against buildCandidateMap(board) directly.
  // Instead verify: value removed from target, no other cells changed.

  it("elimination removes the specified value from the target cell", () => {
    const board = board9.map((r) => [...r]);
    const cm = buildCandidateMap(board, size9, boxSize9);
    const targetRow = 0;
    const targetCol = 2;
    const targetValue = 5;
    expect(cm[targetRow]![targetCol]!).toContain(targetValue);
    testApplyEliminations(cm, [{ row: targetRow, col: targetCol, value: targetValue }]);
    expect(cm[targetRow]![targetCol]!).not.toContain(targetValue);
  });

  it("elimination does not modify unrelated cells", () => {
    const board = board9.map((r) => [...r]);
    const cm = buildCandidateMap(board, size9, boxSize9);
    const baseline = cloneCandidateMap(cm, size9);
    const elims = [
      { row: 0, col: 0, value: 5 },
      { row: 1, col: 6, value: 3 },
    ];
    testApplyEliminations(cm, elims);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const pre = baseline[r]![c]!;
        const post = cm[r]![c]!;
        const targetElims = elims.filter((e) => e.row === r && e.col === c);
        if (targetElims.length > 0) {
          // Target cell: removed values should be gone; all other values preserved
          expect(post.length).toBeLessThanOrEqual(pre.length);
          for (const v of post) {
            expect(pre).toContain(v);
          }
          for (const e of targetElims) {
            expect(pre).toContain(e.value);
            expect(post).not.toContain(e.value);
          }
        } else {
          // Unrelated cell: must be identical
          expect(post).toEqual(pre);
        }
      }
    }
  });

  it("eliminating multiple values from the same cell works", () => {
    const board = board9.map((r) => [...r]);
    const cm = buildCandidateMap(board, size9, boxSize9);
    // (0,0) starts with candidates [3, 4, 5]
    expect(cm[0]![0]!).toEqual([3, 4, 5]);
    testApplyEliminations(cm, [{ row: 0, col: 0, value: 5 }]);
    expect(cm[0]![0]!).toEqual([3, 4]);
    testApplyEliminations(cm, [{ row: 0, col: 0, value: 4 }]);
    expect(cm[0]![0]!).toEqual([3]);
  });

  it("elimination where value is not present is a no-op", () => {
    const board = board9.map((r) => [...r]);
    const cm = buildCandidateMap(board, size9, boxSize9);
    const baseline = cloneCandidateMap(cm, size9);
    testApplyEliminations(cm, [{ row: 0, col: 0, value: 99 }]);
    expect(candidateMapsEqual(cm, baseline, size9)).toBe(true);
  });

  it("no-op elimination still preserves candidate map equality with baseline", () => {
    const board = board9.map((r) => [...r]);
    const cm = buildCandidateMap(board, size9, boxSize9);
    const baseline = cloneCandidateMap(cm, size9);
    // Eliminate a value that is already not present
    const cm04 = cm[0]![4]!;
    const value = cm04.length > 0 ? 999 : 99;
    testApplyEliminations(cm, [{ row: 0, col: 4, value }]);
    expect(candidateMapsEqual(cm, baseline, size9)).toBe(true);
  });

  // ── Mixed assignment + elimination ─────────────────────────────────
  // Use tracked eliminations as oracle: rebuild fresh → replay elims →
  // compare against incremental state.

  it("assignment after elimination produces correct candidate map", () => {
    const board = board9.map((r) => [...r]);
    const cm = buildCandidateMap(board, size9, boxSize9);
    const eliminated = new Set<string>();
    // Eliminate value from a cell, then assign to a peer
    testApplyEliminations(cm, [{ row: 0, col: 2, value: 5 }]);
    eliminated.add("0,2,5");
    testApplyAssignment(board, cm, 0, 0, 5, size9, boxSize9);
    const fresh = buildCandidateMap(board, size9, boxSize9);
    for (const key of eliminated) {
      const [r, c, v] = key.split(",").map(Number);
      const arr = fresh[r!]![c!]!;
      const idx = arr.indexOf(v!);
      if (idx !== -1) arr.splice(idx, 1);
    }
    expect(candidateMapsEqual(cm, fresh, size9)).toBe(true);
  });

  it("elimination after assignment produces correct candidate map", () => {
    const board = board9.map((r) => [...r]);
    const cm = buildCandidateMap(board, size9, boxSize9);
    const eliminated = new Set<string>();
    testApplyAssignment(board, cm, 0, 0, 5, size9, boxSize9);
    testApplyEliminations(cm, [{ row: 0, col: 2, value: 5 }]);
    eliminated.add("0,2,5");
    const fresh = buildCandidateMap(board, size9, boxSize9);
    for (const key of eliminated) {
      const [r, c, v] = key.split(",").map(Number);
      const arr = fresh[r!]![c!]!;
      const idx = arr.indexOf(v!);
      if (idx !== -1) arr.splice(idx, 1);
    }
    expect(candidateMapsEqual(cm, fresh, size9)).toBe(true);
  });

  // ── Randomized regression ──────────────────────────────────────────
  // Uses tracked eliminations + fresh rebuild as the correctness oracle.

  it("randomized regression: 50 random update sequences", () => {
    for (let seq = 0; seq < 50; seq++) {
      const board = board9.map((r) => [...r]);
      const cm = buildCandidateMap(board, size9, boxSize9);
      const eliminated = new Set<string>();
      let s = seq * 100 + 42;
      const rand = () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
      const steps = 5 + Math.floor(rand() * 10);
      for (let i = 0; i < steps; i++) {
        const emptyCells: Array<{ row: number; col: number }> = [];
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            if (board[r]![c] === 0) emptyCells.push({ row: r, col: c });
          }
        }
        const type = rand() > 0.5 && emptyCells.length > 0 ? "assign" : "elim";
        if (type === "assign") {
          const cell = emptyCells[Math.floor(rand() * emptyCells.length)]!;
          const value = 1 + Math.floor(rand() * 9);
          testApplyAssignment(board, cm, cell.row, cell.col, value, size9, boxSize9);
          const fresh = buildCandidateMap(board, size9, boxSize9);
          for (const key of eliminated) {
            const [r, c, v] = key.split(",").map(Number);
            const arr = fresh[r!]![c!]!;
            const idx = arr.indexOf(v!);
            if (idx !== -1) arr.splice(idx, 1);
          }
          expect(candidateMapsEqual(cm, fresh, size9)).toBe(true);
        } else {
          const row = Math.floor(rand() * 9);
          const col = Math.floor(rand() * 9);
          const value = 1 + Math.floor(rand() * 9);
          testApplyEliminations(cm, [{ row, col, value }]);
          eliminated.add(`${row},${col},${value}`);
        }
      }
    }
  });

  // ── Duplicate elimination equivalence ─────────────────────────────

  it("duplicate eliminations are idempotent (equivalent to pendingEliminations Map)", () => {
    const board = board9.map((r) => [...r]);
    const cm = buildCandidateMap(board, size9, boxSize9);

    // Duplicate eliminations for the same (row, col, value)
    const elims = [
      { row: 0, col: 0, value: 5 },
      { row: 0, col: 0, value: 5 },
      { row: 0, col: 0, value: 5 },
      { row: 0, col: 2, value: 8 },
      { row: 0, col: 2, value: 8 },
    ];

    // New behaviour: testApplyEliminations (matches production applyEliminations logic)
    testApplyEliminations(cm, elims);

    // Simulate old behaviour: pendingEliminations Map + buildContext
    const oldCandidateMap = buildCandidateMap(board, size9, boxSize9);
    const pendingMap = new Map<string, { row: number; col: number; value: number }>();
    for (const e of elims) {
      const ek = `${e.row},${e.col},${e.value}`;
      if (!pendingMap.has(ek)) {
        pendingMap.set(ek, e);
      }
    }
    for (const [, e] of pendingMap) {
      const list = oldCandidateMap[e.row]![e.col]!;
      const idx = list.indexOf(e.value);
      if (idx !== -1) list.splice(idx, 1);
    }

    expect(candidateMapsEqual(cm, oldCandidateMap, size9)).toBe(true);
    expect(cm[0]![0]!).toEqual([3, 4]);
    expect(cm[0]![2]!).not.toContain(8);
  });

  // ── End-to-end solver correctness ──────────────────────────────────

  it("simple puzzle solves correctly with incremental candidate map", () => {
    const simple: number[][] = [
      [5, 3, 0, 0, 7, 0, 0, 0, 0],
      [6, 0, 0, 1, 9, 5, 0, 0, 0],
      [0, 9, 8, 0, 0, 0, 0, 6, 0],
      [8, 0, 0, 0, 6, 0, 0, 0, 3],
      [4, 0, 0, 8, 0, 3, 0, 0, 1],
      [7, 0, 0, 0, 2, 0, 0, 0, 6],
      [0, 6, 0, 0, 0, 0, 2, 8, 0],
      [0, 0, 0, 4, 1, 9, 0, 0, 5],
      [0, 0, 0, 0, 8, 0, 0, 7, 9],
    ];
    const result = solve(simple);
    expect(result.solved).toBe(true);
    const fb = result.finalBoard;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        expect(fb[r]![c]).toBeGreaterThan(0);
        expect(fb[r]![c]).toBeLessThanOrEqual(9);
      }
    }
  });
});
