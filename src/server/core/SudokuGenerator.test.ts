import { describe, it, expect } from "vitest";
import { SudokuGenerator } from "./SudokuGenerator";
import type { GridSize, GeneratedPuzzle } from "./SudokuGenerator";
import type { Difficulty } from "../../shared/types/api";
import { isValidSolution, areCluesConsistent, difficultyTargets } from "./SudokuValidator";
import { countSolutions, difficultyCellsRemoved } from "./test-utils";

// ── Helpers ─────────────────────────────────────────────────────────────────

function createGenerator(size: GridSize, difficulty: Difficulty): SudokuGenerator {
  const boxSize = size === 4 ? 2 : 3;
  return new SudokuGenerator({ size, boxSize, difficulty });
}

function generateValidPuzzle(size: GridSize, difficulty: Difficulty, maxAttempts = 5): GeneratedPuzzle {
  for (let i = 0; i < maxAttempts; i++) {
    const gen = createGenerator(size, difficulty);
    const result = gen.generate();
    if (countSolutions(result.puzzle, size, 2, 500_000) === 1) return result;
  }
  throw new Error(`Could not generate valid ${size}×${size} ${difficulty} puzzle after ${maxAttempts} attempts`);
}

// ── 1. Solution Validity ────────────────────────────────────────────────────

describe("Solution validity", () => {
  const sizes: GridSize[] = [4, 9];
  const difficulties: Difficulty[] = ["easy", "medium", "hard"];

  for (const size of sizes) {
    for (const difficulty of difficulties) {
      it(`generates a valid solution for ${size}×${size} ${difficulty}`, () => {
        const result = createGenerator(size, difficulty).generate();
        expect(isValidSolution(result.solution, size)).toBe(true);
      });
    }
  }

  it("every row contains digits 1–N exactly once", () => {
    const result = createGenerator(9, "easy").generate();
    for (let r = 0; r < 9; r++) {
      const row = result.solution[r]!;
      expect(new Set(row).size).toBe(9);
      expect(row.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
  });

  it("every column contains digits 1–N exactly once", () => {
    const result = createGenerator(4, "easy").generate();
    for (let c = 0; c < 4; c++) {
      const col = result.solution.map((r) => r[c]!);
      expect(new Set(col).size).toBe(4);
      expect(col.sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    }
  });

  it("every box contains digits 1–N exactly once", () => {
    const result = createGenerator(9, "medium").generate();
    for (let br = 0; br < 9; br += 3) {
      for (let bc = 0; bc < 9; bc += 3) {
        const box: number[] = [];
        for (let r = br; r < br + 3; r++)
          for (let c = bc; c < bc + 3; c++)
            box.push(result.solution[r]![c]!);
        expect(new Set(box).size).toBe(9);
        expect(box.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      }
    }
  });

  it("no value in solution is outside 1..size", () => {
    const result = createGenerator(4, "hard").generate();
    for (const row of result.solution)
      for (const v of row)
        expect(v).toBeGreaterThanOrEqual(1);
    for (const row of result.solution)
      for (const v of row)
        expect(v).toBeLessThanOrEqual(4);
  });
});

// ── 2. Puzzle Validity ──────────────────────────────────────────────────────

describe("Puzzle validity", () => {
  const sizes: GridSize[] = [4, 9];

  for (const size of sizes) {
    it(`every clue matches the solution for ${size}×${size}`, () => {
      const result = createGenerator(size, "medium").generate();
      expect(areCluesConsistent(result.puzzle, result.solution, size)).toBe(true);
    });
  }

  it("puzzle cells contain only valid values (0 or 1..size)", () => {
    const result = createGenerator(9, "hard").generate();
    for (const row of result.puzzle)
      for (const v of row)
        expect(v).toBeGreaterThanOrEqual(0);
    for (const row of result.puzzle)
      for (const v of row)
        expect(v).toBeLessThanOrEqual(9);
  });

  it("no contradictions exist between puzzle clues and solution", () => {
    const result = createGenerator(4, "easy").generate();
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        if (result.puzzle[r]![c] !== 0)
          expect(result.puzzle[r]![c]).toBe(result.solution[r]![c]);
  });
});

// ── 3. Unique Solution ──────────────────────────────────────────────────────

describe("Unique solution", () => {
  const sizes: GridSize[] = [4, 9];
  const difficulties: Difficulty[] = ["easy", "medium", "hard"];

  for (const size of sizes) {
    for (const difficulty of difficulties) {
      it(`${size}×${size} ${difficulty} puzzle has exactly one solution`, () => {
        const result = createGenerator(size, difficulty).generate();
        const solutions = countSolutions(result.puzzle, size, 2, 500_000);
        expect(solutions).toBe(1);
      });
    }
  }

  it("puzzle with all cells filled is trivially unique", () => {
    const result = createGenerator(4, "easy").generate();
    const full = result.solution.map((r) => [...r]);
    expect(countSolutions(full, 4, 2, 100_000)).toBe(1);
  });

  it("puzzle is not the same as solution (cells were actually removed)", () => {
    const result = createGenerator(9, "medium").generate();
    let hasZero = false;
    for (const row of result.puzzle) for (const v of row) if (v === 0) hasZero = true;
    expect(hasZero).toBe(true);
  });
});

// ── 4. Difficulty Consistency ───────────────────────────────────────────────

describe("Difficulty consistency", () => {
  const sizes: GridSize[] = [4, 9];

  for (const size of sizes) {
    for (const difficulty of ["easy", "medium", "hard"] as Difficulty[]) {
      it(`${size}×${size} ${difficulty} removes cells within expected range`, () => {
        const result = createGenerator(size, difficulty).generate();
        const { min, max } = difficultyCellsRemoved[difficulty][size];
        expect(result.cellsRemoved).toBeGreaterThanOrEqual(min);
        expect(result.cellsRemoved).toBeLessThanOrEqual(max);
      });
    }
  }

  it("hard puzzles remove more cells than easy puzzles for the same size", () => {
    const genEasy = createGenerator(9, "easy");
    const genHard = createGenerator(9, "hard");
    const easy = genEasy.generate();
    const hard = genHard.generate();
    expect(hard.cellsRemoved).toBeGreaterThan(easy.cellsRemoved);
  });

  it("4×4 puzzles remove fewer cells than 9×9 puzzles at same difficulty", () => {
    const gen4 = createGenerator(4, "medium");
    const gen9 = createGenerator(9, "medium");
    const p4 = gen4.generate();
    const p9 = gen9.generate();
    expect(p4.cellsRemoved).toBeLessThan(p9.cellsRemoved);
  });

  it("cellsRemoved matches actual empty cell count", () => {
    const result = createGenerator(9, "hard").generate();
    let actual = 0;
    for (const row of result.puzzle) for (const v of row) if (v === 0) actual++;
    expect(result.cellsRemoved).toBe(actual);
  });
});

// ── 5. Regression Tests (Phase 0 bugs) ─────────────────────────────────────

describe("Regression tests (Phase 0)", () => {
  // ── 5a. Invalid solution grid detection ──
  describe("invalid solution grids are rejected", () => {
    it("detects duplicate values in a row", () => {
      const badSolution = [
        [1, 2, 3, 4],
        [2, 3, 4, 1],
        [3, 4, 1, 2],
        [4, 1, 2, 2], // last column has duplicate 2 in row
      ];
      expect(isValidSolution(badSolution, 4)).toBe(false);
    });

    it("detects duplicate values in a column", () => {
      const badSolution = [
        [1, 3, 4, 2],
        [4, 2, 3, 1],
        [2, 1, 4, 3],
        [3, 4, 1, 2], // col 2 has 4,3,4,1 — duplicate 4s (same as Phase 0 4×4 Easy #2)
      ];
      expect(isValidSolution(badSolution, 4)).toBe(false);
    });

    it("detects duplicate values in a box", () => {
      const badSolution = [
        [2, 4, 3, 1],
        [4, 2, 1, 3],
        [1, 3, 4, 2],
        [3, 1, 2, 4], // all boxes have paired duplicates (same as Phase 0 4×4 Hard #2)
      ];
      expect(isValidSolution(badSolution, 4)).toBe(false);
    });
  });

  // ── 5b. Clue mismatch detection ──
  describe("clue mismatches are detected", () => {
    it("detects a clue contradicting the solution at (1,2)", () => {
      const puzzle = [
        [0, 3, 0, 2],
        [4, 0, 2, 0],
        [0, 1, 0, 3],
        [3, 0, 1, 0],
      ];
      const solution = [
        [1, 3, 4, 2],
        [4, 2, 3, 1],
        [2, 1, 4, 3],
        [3, 4, 1, 2],
      ];
      expect(areCluesConsistent(puzzle, solution, 4)).toBe(false);
    });

    it("detects a clue contradicting the solution at (8,7)", () => {
      const puzzle = [
        [0, 0, 0, 6, 0, 0, 4, 0, 0],
        [7, 0, 0, 0, 0, 0, 6, 0, 0],
        [0, 0, 0, 0, 0, 1, 0, 8, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 5, 0, 0, 8, 0, 0, 0, 3],
        [0, 0, 0, 3, 0, 0, 0, 0, 5],
        [0, 4, 0, 2, 0, 0, 0, 6, 0],
        [9, 0, 3, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 4, 0], // (8,7)=4 but solution has 9
      ];
      const solution = [
        [5, 8, 1, 6, 7, 2, 4, 3, 9],
        [7, 9, 2, 8, 4, 3, 6, 5, 1],
        [3, 6, 4, 5, 9, 1, 7, 8, 2],
        [4, 3, 8, 9, 5, 7, 2, 1, 6],
        [2, 5, 6, 1, 8, 4, 9, 7, 3],
        [1, 7, 9, 3, 2, 6, 8, 4, 5],
        [8, 4, 5, 2, 1, 9, 3, 6, 7],
        [9, 1, 3, 7, 6, 8, 5, 2, 4],
        [6, 2, 7, 4, 3, 5, 1, 9, 8],
      ];
      expect(areCluesConsistent(puzzle, solution, 9)).toBe(false);
    });
  });

  // ── 5c. Multiple-solution puzzle detection ──
  describe("non-unique puzzles are detected", () => {
    it("detects a puzzle with 0 solutions", () => {
      // Cell (0,0) is the first empty cell found by the solver (row-major).
      // Row 0 has 1,2,3 in cols 1,2,3 → blocks 1,2,3.
      // Column 0 has 4 in row 3 → blocks 4.
      // All 4 candidates fail → solver returns 0.
      const puzzle = [
        [0, 1, 2, 3],
        [1, 9, 9, 9],
        [2, 9, 9, 9],
        [4, 9, 9, 9],
      ];
      const solutions = countSolutions(puzzle, 4, 3, 100_000);
      expect(solutions).toBe(0);
    });

    it("detects a puzzle with 2+ solutions (underconstrained)", () => {
      // Very sparse 4×4 puzzle — likely multiple solutions
      const puzzle = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];
      const solutions = countSolutions(puzzle, 4, 3, 100_000);
      expect(solutions).toBeGreaterThan(1);
    });
  });

  // ── 5d. Invalid fallback data (reproduces Phase 0 failures) ──
  describe("invalid fallback data (Phase 0 reproductions)", () => {
    const badSolution4x4 = [
      [1, 3, 4, 2],
      [4, 2, 3, 1],
      [2, 1, 4, 3],
      [3, 4, 1, 2],
    ];

    it("4×4 solution with duplicate columns is not valid", () => {
      expect(isValidSolution(badSolution4x4, 4)).toBe(false);
    });

    it("9×9 puzzle with 2+ solutions fails uniqueness check", () => {
      // An underconstrained 9×9 puzzle (same pattern as Phase 0 9×9 Hard #1)
      const puzzle = [
        [0, 3, 0, 0, 7, 0, 0, 0, 0],
        [6, 0, 0, 0, 9, 5, 0, 0, 0],
        [0, 0, 8, 0, 0, 0, 0, 6, 0],
        [8, 0, 0, 0, 0, 0, 0, 0, 3],
        [0, 0, 0, 8, 0, 0, 0, 0, 0],
        [7, 0, 0, 0, 2, 0, 0, 0, 6],
        [0, 6, 0, 0, 0, 0, 0, 8, 0],
        [0, 0, 0, 4, 1, 9, 0, 0, 5],
        [0, 0, 0, 0, 8, 0, 0, 7, 0],
      ];
      const solutions = countSolutions(puzzle, 9, 3, 500_000);
      expect(solutions).not.toBe(1);
    });

    it("generated puzzle does not replicate Phase 0 column-duplicate bug", () => {
      for (let i = 0; i < 10; i++) {
        const result = createGenerator(4, "hard").generate();
        expect(isValidSolution(result.solution, 4)).toBe(true);
      }
    });
  });
});

// ── 6. Generator Stress Test ───────────────────────────────────────────────

describe("Generator stress test", () => {
  const sizes: GridSize[] = [4, 9];
  const difficulties: Difficulty[] = ["easy", "medium", "hard"];

  for (const size of sizes) {
    for (const difficulty of difficulties) {
      it(`generates 20 valid ${size}×${size} ${difficulty} puzzles`, () => {
        for (let i = 0; i < 20; i++) {
          const result = createGenerator(size, difficulty).generate();
          expect(isValidSolution(result.solution, size)).toBe(true);
          expect(areCluesConsistent(result.puzzle, result.solution, size)).toBe(true);
          const solutions = countSolutions(result.puzzle, size, 2, 500_000);
          expect(solutions).toBe(1);
        }
      });
    }
  }

  it("all generated puzzles within the same category are not identical (checks variety)", () => {
    const puzzles = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const result = createGenerator(9, "medium").generate();
      const key = JSON.stringify(result.puzzle);
      puzzles.add(key);
    }
    // At least 2 different puzzles out of 10 (highly likely)
    expect(puzzles.size).toBeGreaterThan(1);
  });
});

// ── 7. Performance Baseline ────────────────────────────────────────────────

describe("Performance baseline", () => {
  const sizes: GridSize[] = [4, 9];

  for (const size of sizes) {
    for (const difficulty of ["easy", "hard"] as Difficulty[]) {
      it(`measures generation time for ${size}×${size} ${difficulty}`, () => {
        const gen = createGenerator(size, difficulty);
        const times: number[] = [];

        for (let i = 0; i < 10; i++) {
          const start = performance.now();
          gen.generate();
          times.push(performance.now() - start);
        }

        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);

        console.log(
          `  ${size}×${size} ${difficulty}: avg=${avg.toFixed(1)}ms min=${min.toFixed(1)}ms max=${max.toFixed(1)}ms`
        );

        // Soft threshold: generation should complete in reasonable time
        expect(max).toBeLessThan(size === 9 ? 10000 : 1000);
      });
    }
  }
});
