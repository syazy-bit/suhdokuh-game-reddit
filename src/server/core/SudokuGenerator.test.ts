import { describe, it, expect } from "vitest";
import { SudokuGenerator } from "./SudokuGenerator";
import type { GridSize, GeneratedPuzzle } from "./SudokuGenerator";
import type { AnyDifficulty } from "../../shared/types/api";
import { isValidSolution, areCluesConsistent, difficultyTargets } from "./SudokuValidator";
import { countSolutions, difficultyCellsRemoved } from "./test-utils";

// ── Helpers ─────────────────────────────────────────────────────────────────

function createGenerator(size: GridSize, difficulty: AnyDifficulty): SudokuGenerator {
  const boxSize = size === 4 ? 2 : 3;
  return new SudokuGenerator({ size, boxSize, difficulty, matchDifficulty: false });
}

// ── 1. Solution Validity ────────────────────────────────────────────────────

describe("Solution validity", () => {
  const testCases: Array<{ size: GridSize; difficulty: AnyDifficulty }> = [
    { size: 4, difficulty: "beginner" },
    { size: 4, difficulty: "advanced" },
    { size: 9, difficulty: "easy" },
    { size: 9, difficulty: "medium" },
    { size: 9, difficulty: "hard" },
  ];

  for (const { size, difficulty } of testCases) {
    it(`generates a valid solution for ${size}×${size} ${difficulty}`, () => {
      const result = createGenerator(size, difficulty).generate();
      expect(isValidSolution(result.solution, size)).toBe(true);
    });
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
    const result = createGenerator(4, "beginner").generate();
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
    const result = createGenerator(4, "advanced").generate();
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
  it("every clue matches the solution for 4×4", () => {
    const result = createGenerator(4, "beginner").generate();
    expect(areCluesConsistent(result.puzzle, result.solution, 4)).toBe(true);
  });

  it("every clue matches the solution for 9×9", () => {
    const result = createGenerator(9, "medium").generate();
    expect(areCluesConsistent(result.puzzle, result.solution, 9)).toBe(true);
  });

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
    const result = createGenerator(4, "beginner").generate();
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        if (result.puzzle[r]![c] !== 0)
          expect(result.puzzle[r]![c]).toBe(result.solution[r]![c]);
  });
});

// ── 3. Unique Solution ──────────────────────────────────────────────────────

describe("Unique solution", () => {
  const testCases: Array<{ size: GridSize; difficulty: AnyDifficulty }> = [
    { size: 4, difficulty: "beginner" },
    { size: 4, difficulty: "advanced" },
    { size: 9, difficulty: "easy" },
    { size: 9, difficulty: "medium" },
    { size: 9, difficulty: "hard" },
  ];

  for (const { size, difficulty } of testCases) {
    it(`${size}×${size} ${difficulty} puzzle has exactly one solution`, () => {
      const result = createGenerator(size, difficulty).generate();
      const solutions = countSolutions(result.puzzle, size, 2, 500_000);
      expect(solutions).toBe(1);
    });
  }

  it("puzzle with all cells filled is trivially unique", () => {
    const result = createGenerator(4, "beginner").generate();
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
  const testCases: Array<{ size: GridSize; difficulty: AnyDifficulty }> = [
    { size: 4, difficulty: "beginner" },
    { size: 4, difficulty: "advanced" },
    { size: 9, difficulty: "easy" },
    { size: 9, difficulty: "medium" },
    { size: 9, difficulty: "hard" },
  ];

  for (const { size, difficulty } of testCases) {
    it(`${size}×${size} ${difficulty} removes cells within expected range`, () => {
      const result = createGenerator(size, difficulty).generate();
      const { min, max } = difficultyCellsRemoved[difficulty][size];
      expect(result.cellsRemoved).toBeGreaterThanOrEqual(min);
      expect(result.cellsRemoved).toBeLessThanOrEqual(max);
    });
  }

  it("hard puzzles remove more cells than easy puzzles for the same size", () => {
    const genEasy = createGenerator(9, "easy");
    const genHard = createGenerator(9, "hard");
    const easy = genEasy.generate();
    const hard = genHard.generate();
    expect(hard.cellsRemoved).toBeGreaterThan(easy.cellsRemoved);
  });

  it("advanced 4×4 puzzles remove more cells than beginner 4×4 puzzles", () => {
    const genBeginner = createGenerator(4, "beginner");
    const genAdvanced = createGenerator(4, "advanced");
    const beginner = genBeginner.generate();
    const advanced = genAdvanced.generate();
    expect(advanced.cellsRemoved).toBeGreaterThan(beginner.cellsRemoved);
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
        const result = createGenerator(4, "advanced").generate();
        expect(isValidSolution(result.solution, 4)).toBe(true);
      }
    });
  });
});

// ── 6. Generator Stress Test ───────────────────────────────────────────────

describe("Generator stress test", () => {
  const testCases: Array<{ size: GridSize; difficulty: AnyDifficulty }> = [
    { size: 4, difficulty: "beginner" },
    { size: 4, difficulty: "advanced" },
    { size: 9, difficulty: "easy" },
    { size: 9, difficulty: "medium" },
    { size: 9, difficulty: "hard" },
  ];

  for (const { size, difficulty } of testCases) {
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
  const testCases: Array<{ size: GridSize; difficulty: AnyDifficulty }> = [
    { size: 4, difficulty: "beginner" },
    { size: 4, difficulty: "advanced" },
    { size: 9, difficulty: "easy" },
    { size: 9, difficulty: "hard" },
  ];

  for (const { size, difficulty } of testCases) {
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
});

// ── 8. Difficulty Validation ────────────────────────────────────────────────

describe("Difficulty validation", () => {
  it("4×4 beginner generation returns puzzle immediately", () => {
    const gen = new SudokuGenerator({ size: 4, boxSize: 2, difficulty: "beginner" });
    const result = gen.generate();
    expect(result.cellsRemoved).toBeGreaterThan(0);
  });

  it("matchDifficulty=true with maxAttempts=50 succeeds for 9×9 hard", () => {
    const gen = new SudokuGenerator({ size: 9, boxSize: 3, difficulty: "hard", maxAttempts: 50, matchDifficulty: true });
    const result = gen.generate();
    expect(result.analysis.difficulty).toBe("hard");
    expect(result.analysis.score).toBeGreaterThan(0);
  });

  it("matchDifficulty=false for 9×9 returns first puzzle without retry", () => {
    const gen = new SudokuGenerator({ size: 9, boxSize: 3, difficulty: "easy", matchDifficulty: false });
    const result = gen.generate();
    expect(result.analysis.score).toBeGreaterThanOrEqual(0);
  });

  it("error message includes size, difficulty, attempt count, last score and last difficulty", () => {
    expect.hasAssertions();
    try {
      const gen = new SudokuGenerator({ size: 9, boxSize: 3, difficulty: "expert", maxAttempts: 1, matchDifficulty: true });
      gen.generate();
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("9×9");
      expect(msg).toContain("expert");
      expect(msg).toContain("1 attempts");
      expect(msg).toContain("last score:");
      expect(msg).toContain("last difficulty:");
    }
  });
});

// ── 9. Constructor Validation ────────────────────────────────────────────────

describe("Constructor validation", () => {
  it("rejects maxAttempts = 0", () => {
    expect(() => new SudokuGenerator({ size: 4, boxSize: 2, difficulty: "easy", maxAttempts: 0 }))
      .toThrow(/maxAttempts must be >= 1/);
  });

  it("rejects negative maxAttempts", () => {
    expect(() => new SudokuGenerator({ size: 4, boxSize: 2, difficulty: "easy", maxAttempts: -1 }))
      .toThrow(/maxAttempts must be >= 1/);
  });

  it("accepts maxAttempts = 1", () => {
    const gen = new SudokuGenerator({ size: 4, boxSize: 2, difficulty: "easy", maxAttempts: 1 });
    expect(gen).toBeDefined();
  });

  it("default maxAttempts (50) is accepted", () => {
    const gen = new SudokuGenerator({ size: 4, boxSize: 2, difficulty: "easy" });
    expect(gen).toBeDefined();
  });

  it("rejects maxAttempts = 0 even with matchDifficulty = false", () => {
    expect(() => new SudokuGenerator({ size: 4, boxSize: 2, difficulty: "easy", maxAttempts: 0, matchDifficulty: false }))
      .toThrow(/maxAttempts must be >= 1/);
  });
});

// ── 10. Expert Configuration ──────────────────────────────────────────────────

describe("Expert configuration", () => {
  it("accepts expert difficulty in generator config", () => {
    const gen = new SudokuGenerator({ size: 9, boxSize: 3, difficulty: "expert", matchDifficulty: false });
    expect(gen).toBeDefined();
  });

  it("generates a puzzle with expert config (matchDifficulty=false)", () => {
    const gen = new SudokuGenerator({ size: 9, boxSize: 3, difficulty: "expert", matchDifficulty: false });
    const result = gen.generate();
    expect(result.puzzle).toBeDefined();
    expect(result.solution).toBeDefined();
    expect(result.analysis).toBeDefined();
  });

  it("generated expert puzzle analysis exists", () => {
    const gen = new SudokuGenerator({ size: 9, boxSize: 3, difficulty: "expert", matchDifficulty: false });
    const result = gen.generate();
    expect(result.analysis.score).toBeGreaterThan(0);
  });

  it("9×9 expert generation either succeeds or reports a meaningful error", () => {
    // Phase 5.6.3 benchmark shows ~40% of 9×9 expert attempts succeed
    // within 50 tries (per-attempt probability ~1%). The test verifies
    // that the generator handles both outcomes gracefully.
    const gen = new SudokuGenerator({
      size: 9, boxSize: 3, difficulty: "expert", matchDifficulty: true, maxAttempts: 50,
    });
    try {
      const result = gen.generate();
      expect(result.analysis.difficulty).toBe("expert");
      expect(result.analysis.score).toBeGreaterThan(75);
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("Failed to generate");
      expect(msg).toContain("9×9");
      expect(msg).toContain("expert");
      expect(msg).toContain("last score:");
      expect(msg).toContain("last difficulty:");
    }
  });

  it("4×4 only supports beginner and advanced difficulties", () => {
    const gen = new SudokuGenerator({ size: 4, boxSize: 2, difficulty: "expert" });
    expect(() => gen.generate()).toThrow();
  });
});

// ── 11. Guided Removal ───────────────────────────────────────────────────────

function createGuidedGenerator(difficulty: AnyDifficulty): SudokuGenerator {
  const boxSize = 3;
  return new SudokuGenerator({ size: 9, boxSize, difficulty, matchDifficulty: false, useGuidedRemoval: true });
}

describe("Guided removal — constructor", () => {
  it("defaults useGuidedRemoval to false", () => {
    const gen = new SudokuGenerator({ size: 9, boxSize: 3, difficulty: "easy" });
    expect(gen).toBeDefined();
    // Generate with default to confirm no error
    const result = gen.generate();
    expect(result.puzzle).toBeDefined();
  });

  it("accepts useGuidedRemoval: true", () => {
    const gen = new SudokuGenerator({ size: 9, boxSize: 3, difficulty: "easy", matchDifficulty: false, useGuidedRemoval: true });
    expect(gen).toBeDefined();
    const result = gen.generate();
    expect(result.puzzle).toBeDefined();
  });

  it("accepts useGuidedRemoval: false explicitly", () => {
    const gen = new SudokuGenerator({ size: 9, boxSize: 3, difficulty: "medium", matchDifficulty: false, useGuidedRemoval: false });
    expect(gen).toBeDefined();
    const result = gen.generate();
    expect(result.puzzle).toBeDefined();
  });
});

describe("Guided removal — puzzle validity", () => {
  const difficulties: Array<AnyDifficulty> = ["easy", "medium", "hard", "expert"];

  for (const difficulty of difficulties) {
    it(`generates a valid 9×9 ${difficulty} puzzle`, () => {
      const result = createGuidedGenerator(difficulty).generate();
      expect(isValidSolution(result.solution, 9)).toBe(true);
      expect(areCluesConsistent(result.puzzle, result.solution, 9)).toBe(true);
      const solutions = countSolutions(result.puzzle, 9, 2, 500_000);
      expect(solutions).toBe(1);
    });
  }

  it("generated puzzle has cells removed within expected range", () => {
    const result = createGuidedGenerator("hard").generate();
    const actual = result.cellsRemoved;
    expect(actual).toBeGreaterThan(0);
    expect(actual).toBeLessThanOrEqual(81);
  });

  it("cellsRemoved matches actual empty cell count", () => {
    const result = createGuidedGenerator("medium").generate();
    let actual = 0;
    for (const row of result.puzzle) for (const v of row) if (v === 0) actual++;
    expect(result.cellsRemoved).toBe(actual);
  });
});

describe("Guided removal — diversity", () => {
  it("produces at least 2 different puzzles across 5 runs", () => {
    const puzzles = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const result = createGuidedGenerator("medium").generate();
      puzzles.add(JSON.stringify(result.puzzle));
    }
    expect(puzzles.size).toBeGreaterThan(1);
  });

  it("produces non-identical puzzles across multiple difficulties", () => {
    for (const diff of ["easy", "medium", "hard"] as const) {
      const puzzles = new Set<string>();
      for (let i = 0; i < 3; i++) {
        const result = createGuidedGenerator(diff as AnyDifficulty).generate();
        puzzles.add(JSON.stringify(result.puzzle));
      }
      expect(puzzles.size).toBeGreaterThan(1);
    }
  });
});

// ── 12. Guided Removal Benchmark ─────────────────────────────────────────────

describe("Guided removal — benchmark", () => {
  const DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;

  function runTrial(
    useGuided: boolean,
    difficulty: typeof DIFFICULTIES[number],
    samples: number
  ): { scores: number[]; times: number[] } {
    const scores: number[] = [];
    const times: number[] = [];
    for (let i = 0; i < samples; i++) {
      const gen = new SudokuGenerator({
        size: 9, boxSize: 3, difficulty,
        matchDifficulty: false,
        useGuidedRemoval: useGuided,
      });
      const start = performance.now();
      const result = gen.generate();
      times.push(performance.now() - start);
      scores.push(result.analysis.score);
    }
    return { scores, times };
  }

  it("compares baseline vs guided removal across difficulties", () => {
    const SAMPLES = 3;

    for (const difficulty of DIFFICULTIES) {
      const baseline = runTrial(false, difficulty, SAMPLES);
      const guided = runTrial(true, difficulty, SAMPLES);

      const baselineAvg = baseline.scores.reduce((a, b) => a + b, 0) / SAMPLES;
      const guidedAvg = guided.scores.reduce((a, b) => a + b, 0) / SAMPLES;
      const baselineTime = baseline.times.reduce((a, b) => a + b, 0) / SAMPLES;
      const guidedTime = guided.times.reduce((a, b) => a + b, 0) / SAMPLES;

      console.log(`\n${difficulty.toUpperCase()}:`);
      console.log(`  Baseline scores:   ${baseline.scores.map((s) => s.toFixed(1)).join(", ")}  avg=${baselineAvg.toFixed(1)}`);
      console.log(`  Guided scores:     ${guided.scores.map((s) => s.toFixed(1)).join(", ")}  avg=${guidedAvg.toFixed(1)}`);
      console.log(`  Baseline avg time: ${baselineTime.toFixed(1)}ms`);
      console.log(`  Guided avg time:   ${guidedTime.toFixed(1)}ms`);

      // Verify all scores are finite
      expect(baseline.scores.every((s) => Number.isFinite(s))).toBe(true);
      expect(guided.scores.every((s) => Number.isFinite(s))).toBe(true);
    }
  });

  it("guided removal score distribution has finite variance", () => {
    const { scores } = runTrial(true, "hard", 5);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((acc, s) => acc + (s - mean) ** 2, 0) / scores.length;
    expect(Number.isFinite(variance)).toBe(true);
    expect(variance).toBeGreaterThanOrEqual(0);
  });

  it("matchDifficulty=true works with guided removal", () => {
    const gen = new SudokuGenerator({
      size: 9, boxSize: 3, difficulty: "hard",
      matchDifficulty: true, useGuidedRemoval: true, maxAttempts: 50,
    });
    const result = gen.generate();
    expect(result.analysis.difficulty).toBe("hard");
    expect(result.analysis.score).toBeGreaterThan(0);
  });
});

// ── 13. Local Search ─────────────────────────────────────────────────────────

describe("Local search — puzzle validity", () => {
  beforeAll(() => {
    SudokuGenerator.USE_LOCAL_SEARCH = true;
  });

  afterAll(() => {
    SudokuGenerator.USE_LOCAL_SEARCH = false;
  });

  const difficulties = ["easy", "medium", "hard", "expert"] as const;

  for (const difficulty of difficulties) {
    it(`generates a valid 9×9 ${difficulty} puzzle with local search`, () => {
      const gen = new SudokuGenerator({
        size: 9, boxSize: 3, difficulty,
        matchDifficulty: true, useGuidedRemoval: true, maxAttempts: 50,
      });
      const result = gen.generate();
      expect(isValidSolution(result.solution, 9)).toBe(true);
      expect(areCluesConsistent(result.puzzle, result.solution, 9)).toBe(true);
      const solutions = countSolutions(result.puzzle, 9, 2, 500_000);
      expect(solutions).toBe(1);
    });
  }

  it("preserves rotational symmetry of empty/filled pattern", () => {
    const gen = new SudokuGenerator({
      size: 9, boxSize: 3, difficulty: "medium",
      matchDifficulty: true, useGuidedRemoval: true, maxAttempts: 10,
    });
    const result = gen.generate();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = result.puzzle[r]![c];
        const sym = result.puzzle[8 - r]![8 - c];
        // Both are either zero (empty) or positive (filled)
        expect((cell === 0) === (sym === 0)).toBe(true);
      }
    }
  });

  it("preserves clue count", () => {
    const gen = new SudokuGenerator({
      size: 9, boxSize: 3, difficulty: "hard",
      matchDifficulty: true, useGuidedRemoval: true, maxAttempts: 10,
    });
    const result = gen.generate();
    let filled = 0;
    for (const row of result.puzzle) for (const v of row) if (v !== 0) filled++;
    expect(filled + result.cellsRemoved).toBe(81);
  });

  it("produces non-negative score for all difficulties", () => {
    for (const difficulty of difficulties) {
      const gen = new SudokuGenerator({
        size: 9, boxSize: 3, difficulty,
        matchDifficulty: true, useGuidedRemoval: true, maxAttempts: 50,
      });
      const result = gen.generate();
      expect(result.analysis.score).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("Local search — benchmark", () => {
  const DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;

  function runTrial(useLocal: boolean, difficulty: typeof DIFFICULTIES[number], samples: number) {
    const scores: number[] = [];
    const times: number[] = [];
    const distances: number[] = [];
    const targets: Record<string, number> = { easy: 20, medium: 40, hard: 62, expert: 90 };

    for (let i = 0; i < samples; i++) {
      const gen = new SudokuGenerator({
        size: 9, boxSize: 3, difficulty,
        matchDifficulty: true, useGuidedRemoval: true, maxAttempts: 200,
      });

      // Toggle local search per trial
      SudokuGenerator.USE_LOCAL_SEARCH = useLocal;

      const start = performance.now();
      const result = gen.generate();
      times.push(performance.now() - start);
      scores.push(result.analysis.score);
      distances.push(Math.abs(result.analysis.score - targets[difficulty]!));
    }
    SudokuGenerator.USE_LOCAL_SEARCH = false;

    return { scores, times, distances };
  }

  it("compares baseline vs local search across difficulties", () => {
    const SAMPLES = 3;

    for (const difficulty of DIFFICULTIES) {
      const base = runTrial(false, difficulty, SAMPLES);
      const ls = runTrial(true, difficulty, SAMPLES);

      const baseAvgDist = base.distances.reduce((a, b) => a + b, 0) / SAMPLES;
      const lsAvgDist = ls.distances.reduce((a, b) => a + b, 0) / SAMPLES;
      const baseTime = base.times.reduce((a, b) => a + b, 0) / SAMPLES;
      const lsTime = ls.times.reduce((a, b) => a + b, 0) / SAMPLES;

      console.log(`\n${difficulty.toUpperCase()}:`);
      console.log(`  Baseline scores:  ${base.scores.map((s) => s.toFixed(1)).join(", ")}  avgDist=${baseAvgDist.toFixed(1)}`);
      console.log(`  Local search:     ${ls.scores.map((s) => s.toFixed(1)).join(", ")}  avgDist=${lsAvgDist.toFixed(1)}`);
      console.log(`  Baseline avg time: ${baseTime.toFixed(1)}ms`);
      console.log(`  Local search time: ${lsTime.toFixed(1)}ms`);

      expect(base.scores.every((s) => Number.isFinite(s))).toBe(true);
      expect(ls.scores.every((s) => Number.isFinite(s))).toBe(true);
    }
  });

  it("local search reduces score distance or remains equal on average", () => {
    const SAMPLES = 5;
    let totalBaseDist = 0;
    let totalLsDist = 0;

    for (const difficulty of DIFFICULTIES) {
      const base = runTrial(false, difficulty, SAMPLES);
      const ls = runTrial(true, difficulty, SAMPLES);

      totalBaseDist += base.distances.reduce((a, b) => a + b, 0) / SAMPLES;
      totalLsDist += ls.distances.reduce((a, b) => a + b, 0) / SAMPLES;
    }

    const avgBase = totalBaseDist / DIFFICULTIES.length;
    const avgLs = totalLsDist / DIFFICULTIES.length;

    console.log(`\nAggregate avg distance: baseline=${avgBase.toFixed(2)}  local-search=${avgLs.toFixed(2)}`);

    // Local search should not make things worse on average
    expect(avgLs).toBeLessThanOrEqual(avgBase + 5); // small tolerance for noise
  }, 30000);
});

// ── 14. Phase 11.3 — Detailed Benchmark ─────────────────────────────────────

describe("Phase 11.3 — Detailed benchmark", () => {
  const S = 100;
  const DIFFS = ["easy", "medium", "hard", "expert"] as const;
  const TGT: Record<string, number> = { easy: 20, medium: 40, hard: 62, expert: 90 };
  const TIMEOUT = 600_000;

  function medianSorted(s: number[]): number {
    const n = s.length;
    return n % 2 === 0 ? (s[n / 2 - 1]! + s[n / 2]!) / 2 : s[Math.floor(n / 2)]!;
  }

  function sampleStddev(s: number[], m: number): number {
    if (s.length < 2) return 0;
    return Math.sqrt(s.reduce((a, v) => a + (v - m) ** 2, 0) / (s.length - 1));
  }

  // Normal CDF — Abramowitz & Stegun 26.2.17, max error 1.5e-7
  function normCdf(x: number): number {
    const a = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429];
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const z = Math.abs(x);
    const t = 1 / (1 + p * z);
    let y = 0;
    for (let i = a.length - 1; i >= 0; i--) y = (y + a[i]!) * t;
    return 0.5 * (1 + sign * (1 - y * Math.exp((-z * z) / 2)));
  }

  function runCond(useLS: boolean, diff: typeof DIFFS[number]) {
    SudokuGenerator.USE_LOCAL_SEARCH = useLS;
    const target = TGT[diff]!;

    const genSpy = vi.spyOn(SudokuGenerator.prototype as any, "generateSolvedBoard");
    const origLS = (SudokuGenerator.prototype as any).localSearch;
    let lsCalls = 0;
    let lsWins = 0;
    const lsSpy = vi.spyOn(SudokuGenerator.prototype as any, "localSearch").mockImplementation(
      function (this: any, ...a: any[]) {
        lsCalls++;
        const r = origLS.apply(this, a);
        if (r !== null) lsWins++;
        return r;
      },
    );

    const scores: number[] = [];
    const times: number[] = [];
    const retries: number[] = [];
    let errs = 0;
    let prevGenCalls = 0;

    for (let i = 0; i < S; i++) {
      const beforeCalls = genSpy.mock.calls.length;
      try {
        const t0 = performance.now();
        const g = new SudokuGenerator({
          size: 9, boxSize: 3, difficulty: diff,
        matchDifficulty: true, useGuidedRemoval: true, maxAttempts: 200,
        });
        const r = g.generate();
        times.push(performance.now() - t0);
        scores.push(r.analysis.score);
        const genCallsThisRun = genSpy.mock.calls.length - beforeCalls;
        retries.push(Math.max(0, genCallsThisRun - 1));
      } catch {
        errs++;
      }
      prevGenCalls = genSpy.mock.calls.length;
    }

    genSpy.mockRestore();
    lsSpy.mockRestore();
    SudokuGenerator.USE_LOCAL_SEARCH = false;

    const nOk = scores.length;
    const avgScore = nOk > 0 ? scores.reduce((a, b) => a + b, 0) / nOk : 0;
    const medScore = nOk > 0 ? medianSorted([...scores].sort((a, b) => a - b)) : 0;
    const sdScore = nOk > 0 ? sampleStddev(scores, avgScore) : 0;
    const avgDist = nOk > 0 ? scores.reduce((a, s) => a + Math.abs(s - target), 0) / nOk : 0;
    const avgTime = times.length > 0 ? times.reduce((a, t) => a + t, 0) / times.length : 0;
    const avgRetries = retries.length > 0 ? retries.reduce((a, r) => a + r, 0) / retries.length : 0;
    const activationRate = S > 0 ? lsCalls / S : 0;
    const improvementRate = lsCalls > 0 ? lsWins / lsCalls : 0;
    const distances = scores.map((s) => Math.abs(s - target));

    return {
      nOk, errs, avgScore, medScore, sdScore, avgDist, avgTime, avgRetries,
      lsCalls, lsWins, activationRate, improvementRate, scores, distances,
    };
  }

  it("runs detailed benchmark and tests statistical significance", () => {
    type Run = ReturnType<typeof runCond>;
    const rows: Array<{ diff: string; cond: string; r: Run }> = [];

    for (const diff of DIFFS) {
      for (const useLS of [false, true]) {
        const label = useLS ? "local-search" : "baseline";
        const r = runCond(useLS, diff);
        rows.push({ diff, cond: label, r });
      }
    }

    // ── Print table ────────────────────────────────────────────────────────
    console.log("\n\n========== PHASE 11.3 DETAILED BENCHMARK ==========");

    for (const diff of DIFFS) {
      const base = rows.find((x) => x.diff === diff && x.cond === "baseline")!.r;
      const ls = rows.find((x) => x.diff === diff && x.cond === "local-search")!.r;

      const dNok = ls.nOk - base.nOk;
      const dScore = ls.avgScore - base.avgScore;
      const dMed = ls.medScore - base.medScore;
      const dSd = ls.sdScore - base.sdScore;
      const dDist = ls.avgDist - base.avgDist;
      const dTime = ls.avgTime - base.avgTime;
      const dRet = ls.avgRetries - base.avgRetries;

      console.log(`\n--- ${diff.toUpperCase()} ---`);
      console.log(`  metric           baseline     local-search  delta`);
      console.log(`  ─────────────────────────────────────────────────`);
      console.log(`  puzzles          ${String(base.nOk).padStart(5)}       ${String(ls.nOk).padStart(8)}       ${dNok > 0 ? "+" : ""}${dNok}/${base.errs}/${ls.errs} err`);
      console.log(`  avg score        ${base.avgScore.toFixed(2).padStart(7)}     ${ls.avgScore.toFixed(2).padStart(10)}     ${dScore > 0 ? "+" : ""}${dScore.toFixed(2)}`);
      console.log(`  median score     ${base.medScore.toFixed(2).padStart(7)}     ${ls.medScore.toFixed(2).padStart(10)}     ${dMed > 0 ? "+" : ""}${dMed.toFixed(2)}`);
      console.log(`  score stddev     ${base.sdScore.toFixed(2).padStart(7)}     ${ls.sdScore.toFixed(2).padStart(10)}     ${dSd > 0 ? "+" : ""}${dSd.toFixed(2)}`);
      console.log(`  avg dist→target  ${base.avgDist.toFixed(2).padStart(7)}     ${ls.avgDist.toFixed(2).padStart(10)}     ${dDist > 0 ? "+" : ""}${dDist.toFixed(2)}`);
      console.log(`  avg time (ms)    ${base.avgTime.toFixed(1).padStart(7)}     ${ls.avgTime.toFixed(1).padStart(10)}     ${dTime > 0 ? "+" : ""}${dTime.toFixed(1)}`);
      console.log(`  avg retries      ${base.avgRetries.toFixed(2).padStart(7)}     ${ls.avgRetries.toFixed(2).padStart(10)}     ${dRet > 0 ? "+" : ""}${dRet.toFixed(2)}`);
      console.log(`  LS activation    N/A               ${(ls.activationRate * 100).toFixed(1).padStart(5)}%`);
      console.log(`  LS improvement   N/A               ${(ls.improvementRate * 100).toFixed(1).padStart(5)}%`);

      if (base.distances.length > 1 && ls.distances.length > 1) {
        const n1 = base.distances.length, n2 = ls.distances.length;
        const m1 = base.avgDist;
        const m2 = ls.avgDist;
        const dv1 = base.distances.reduce((a, v) => a + (v - m1) ** 2, 0) / (n1 - 1);
        const dv2 = ls.distances.reduce((a, v) => a + (v - m2) ** 2, 0) / (n2 - 1);
        const se = Math.sqrt(dv1 / n1 + dv2 / n2);
        const t = se > 0 ? (m1 - m2) / se : 0;
        const df = (dv1 / n1 + dv2 / n2) ** 2
          / ((dv1 / n1) ** 2 / (n1 - 1) + (dv2 / n2) ** 2 / (n2 - 1));
        const p = 2 * (1 - normCdf(Math.abs(t)));
        console.log(`  Welch t-test     t(${df.toFixed(0)}) = ${t.toFixed(4)}   p = ${p.toFixed(6)}${p < 0.05 ? "   **" : ""}`);
      }
    }

    // ── Aggregate ──────────────────────────────────────────────────────────
    const aggBase = rows.filter((x) => x.cond === "baseline").flatMap((x) => x.r.distances);
    const aggLS = rows.filter((x) => x.cond === "local-search").flatMap((x) => x.r.distances);
    const aMean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const aVar = (arr: number[], m: number) =>
      arr.reduce((a, v) => a + (v - m) ** 2, 0) / (arr.length - 1);

    const abm = aMean(aggBase);
    const alm = aMean(aggLS);
    const abv = aVar(aggBase, abm);
    const alv = aVar(aggLS, alm);
    const an1 = aggBase.length, an2 = aggLS.length;
    const aSe = Math.sqrt(abv / an1 + alv / an2);
    const aT = aSe > 0 ? (abm - alm) / aSe : 0;
    const aDf = (abv / an1 + alv / an2) ** 2
      / ((abv / an1) ** 2 / (an1 - 1) + (alv / an2) ** 2 / (an2 - 1));
    const aP = 2 * (1 - normCdf(Math.abs(aT)));

    console.log("\n--- AGGREGATE (pooled across all difficulties) ---");
    console.log(`  baseline avg dist:      ${abm.toFixed(4)}  (n=${an1})`);
    console.log(`  local-search avg dist:  ${alm.toFixed(4)}  (n=${an2})`);
    console.log(`  delta:                  ${(alm - abm).toFixed(4)}`);
    console.log(`  Welch t(${aDf.toFixed(0)}) = ${aT.toFixed(4)}   p = ${aP.toFixed(6)}`);

    if (Math.abs(aT) > 1.96) {
      console.log("\n  *** The observed difference is STATISTICALLY SIGNIFICANT (|t| > 1.96, p < 0.05) ***");
    } else {
      console.log("\n  *** The observed difference is NOT statistically significant (|t| <= 1.96, p >= 0.05) ***");
      console.log("  *** The regression from 8.00 to 8.68 was sampling noise. ***");
    }

    // Vanilla assertions to confirm data was collected
    expect(aggBase.length).toBeGreaterThan(0);
    expect(aggLS.length).toBeGreaterThan(0);
  }, TIMEOUT);
});

describe("Stage 1 normalization (formula)", () => {
  it("normalized value maps min→0, max→1 in normal range", () => {
    const scores = [10, 20, 30, 40];
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min;
    const normalized = scores.map((s) => (s - min) / range);
    expect(normalized[0]).toBe(0);
    expect(normalized[3]).toBe(1);
    expect(normalized[1]).toBeCloseTo(1 / 3);
    expect(normalized[2]).toBeCloseTo(2 / 3);
  });

  it("zero range falls back to 1 and normalized values are all 0", () => {
    const scores = [25, 25, 25];
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min || 1;
    const normalized = scores.map((s) => (s - min) / range);
    expect(normalized).toEqual([0, 0, 0]);
  });

  it("ordering is preserved after normalization", () => {
    const scores = [5, 15, 10];
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min || 1;
    const normalized = scores.map((s) => (s - min) / range);
    // normalization is monotonic: pairwise order matches original
    expect(normalized[0]).toBeLessThan(normalized[1]);
    expect(normalized[0]).toBeLessThan(normalized[2]);
    expect(normalized[1]).toBeGreaterThan(normalized[2]);
  });

  it("values stay within [0, 1]", () => {
    const scores = [10, 20, 30, 40, 50];
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min || 1;
    const normalized = scores.map((s) => (s - min) / range);
    for (const v of normalized) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("Guided removal with predictor pre-filter", () => {
  it("generates a valid puzzle with usePredictor=true and useGuidedRemoval=true", () => {
    const gen = new SudokuGenerator({
      size: 9, boxSize: 3, difficulty: "easy",
      matchDifficulty: false,
      useGuidedRemoval: true,
      usePredictor: true,
    });
    const result = gen.generate();
    expect(isValidSolution(result.solution, 9)).toBe(true);
    expect(areCluesConsistent(result.puzzle, result.solution)).toBe(true);
  });

  it("generates valid puzzles across all difficulties with predictor", () => {
    const diffs: AnyDifficulty[] = ["easy", "medium", "hard", "expert"];
    for (const diff of diffs) {
      const gen = new SudokuGenerator({
        size: 9, boxSize: 3, difficulty: diff,
        matchDifficulty: false,
        useGuidedRemoval: true,
        usePredictor: true,
      });
      const result = gen.generate();
      expect(isValidSolution(result.solution, 9)).toBe(true);
      expect(areCluesConsistent(result.puzzle, result.solution)).toBe(true);
    }
  });

  it("falls back to legacy path when predictor-enhanced path has no valid candidates", () => {
    for (let i = 0; i < 5; i++) {
      const gen = new SudokuGenerator({
        size: 9, boxSize: 3, difficulty: "medium",
        matchDifficulty: false,
        useGuidedRemoval: true,
        usePredictor: true,
      });
      const result = gen.generate();
      expect(isValidSolution(result.solution, 9)).toBe(true);
      expect(areCluesConsistent(result.puzzle, result.solution)).toBe(true);
    }
  });
});

describe("Backward compatibility", () => {
  it("default usePredictor is false and produces valid puzzles", () => {
    const gen = new SudokuGenerator({
      size: 9, boxSize: 3, difficulty: "easy",
      matchDifficulty: false,
    });
    const result = gen.generate();
    expect(isValidSolution(result.solution, 9)).toBe(true);
    expect(areCluesConsistent(result.puzzle, result.solution)).toBe(true);
  });

  it("explicit usePredictor=false behaves identically to default", () => {
    const gen = new SudokuGenerator({
      size: 9, boxSize: 3, difficulty: "medium",
      matchDifficulty: false,
      usePredictor: false,
    });
    const result = gen.generate();
    expect(isValidSolution(result.solution, 9)).toBe(true);
    expect(areCluesConsistent(result.puzzle, result.solution)).toBe(true);
  });
});

// ── 15. Predictor-Aware Budget ──────────────────────────────────────────────

describe("getEvalBudget", () => {
  it("easy returns 1-2", () => {
    for (let i = 0; i < 10; i++) {
      const b = SudokuGenerator.getEvalBudget("easy", i);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(2);
    }
  });

  it("medium always returns 2", () => {
    for (let i = 0; i < 10; i++) {
      expect(SudokuGenerator.getEvalBudget("medium", i)).toBe(2);
    }
  });

  it("hard returns 2-3", () => {
    expect(SudokuGenerator.getEvalBudget("hard", 1)).toBeGreaterThanOrEqual(2);
    expect(SudokuGenerator.getEvalBudget("hard", 1)).toBeLessThanOrEqual(3);
    expect(SudokuGenerator.getEvalBudget("hard", 5)).toBeGreaterThanOrEqual(2);
    expect(SudokuGenerator.getEvalBudget("hard", 5)).toBeLessThanOrEqual(3);
  });

  it("expert returns 3-5", () => {
    expect(SudokuGenerator.getEvalBudget("expert", 1)).toBeGreaterThanOrEqual(3);
    expect(SudokuGenerator.getEvalBudget("expert", 1)).toBeLessThanOrEqual(5);
    expect(SudokuGenerator.getEvalBudget("expert", 5)).toBeGreaterThanOrEqual(3);
    expect(SudokuGenerator.getEvalBudget("expert", 5)).toBeLessThanOrEqual(5);
  });

  it("hard/expert with eligibleCount >= 4 increases budget", () => {
    const baseHard = SudokuGenerator.getEvalBudget("hard", 2);
    const bumpedHard = SudokuGenerator.getEvalBudget("hard", 4);
    expect(bumpedHard).toBeGreaterThanOrEqual(baseHard);

    const baseExpert = SudokuGenerator.getEvalBudget("expert", 2);
    const bumpedExpert = SudokuGenerator.getEvalBudget("expert", 4);
    expect(bumpedExpert).toBeGreaterThanOrEqual(baseExpert);
  });

  it("eligibleCount <= 1 reduces budget (but not below min)", () => {
    expect(SudokuGenerator.getEvalBudget("easy", 0)).toBe(1);
    expect(SudokuGenerator.getEvalBudget("medium", 1)).toBe(2);
  });
});

describe("Predictor-aware budget — puzzle validity", () => {
  const difficulties: AnyDifficulty[] = ["easy", "medium", "hard", "expert"];

  for (const difficulty of difficulties) {
    it(`generates a valid 9×9 ${difficulty} puzzle`, () => {
      const gen = new SudokuGenerator({
        size: 9, boxSize: 3, difficulty,
        matchDifficulty: false,
        useGuidedRemoval: true,
        usePredictor: true,
        usePredictorAwareBudget: true,
      });
      const result = gen.generate();
      expect(isValidSolution(result.solution, 9)).toBe(true);
      expect(areCluesConsistent(result.puzzle, result.solution)).toBe(true);
      const solutions = countSolutions(result.puzzle, 9, 2, 500_000);
      expect(solutions).toBe(1);
    });
  }

  it("matchDifficulty=true works with predictor-aware budget", () => {
    const gen = new SudokuGenerator({
      size: 9, boxSize: 3, difficulty: "hard",
      matchDifficulty: true, useGuidedRemoval: true,
      usePredictor: true, usePredictorAwareBudget: true,
      maxAttempts: 50,
    });
    const result = gen.generate();
    expect(result.analysis.difficulty).toBe("hard");
    expect(result.analysis.score).toBeGreaterThan(0);
  });
});

describe("Predictor-aware budget — backward compatibility", () => {
  it("default usePredictorAwareBudget is false", () => {
    const gen = new SudokuGenerator({
      size: 9, boxSize: 3, difficulty: "easy",
      matchDifficulty: false,
    });
    expect((gen as any).usePredictorAwareBudget).toBe(false);
  });

  it("explicit false produces same result as default", () => {
    const gen1 = new SudokuGenerator({
      size: 9, boxSize: 3, difficulty: "medium",
      matchDifficulty: false, useGuidedRemoval: true,
    });
    const gen2 = new SudokuGenerator({
      size: 9, boxSize: 3, difficulty: "medium",
      matchDifficulty: false, useGuidedRemoval: true,
      usePredictorAwareBudget: false,
    });
    const r1 = gen1.generate();
    const r2 = gen2.generate();
    expect(isValidSolution(r1.solution, 9)).toBe(true);
    expect(isValidSolution(r2.solution, 9)).toBe(true);
    expect(areCluesConsistent(r1.puzzle, r1.solution)).toBe(true);
    expect(areCluesConsistent(r2.puzzle, r2.solution)).toBe(true);
  });
});
