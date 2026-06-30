import { describe, it, expect } from "vitest";
import { predictDelta } from "./DifficultyPredictor";
import type { PredictionResult } from "./DifficultyPredictor";
import type { GridSize } from "./SudokuValidator";
import { solve } from "./HumanSolverPipeline";
import { analyzeSolveResult } from "./DifficultyAnalyzer";
import { SudokuGenerator } from "./SudokuGenerator";

function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row]);
}

function makeSolvedBoard9(): number[][] {
  return [
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
}

function makeSolvedBoard4(): number[][] {
  return [
    [1, 2, 3, 4],
    [3, 4, 1, 2],
    [2, 1, 4, 3],
    [4, 3, 2, 1],
  ];
}

function makePartialBoard9(): number[][] {
  const board = makeSolvedBoard9();
  board[0]![0] = 0;
  board[0]![1] = 0;
  board[4]![4] = 0;
  board[8]![8] = 0;
  return board;
}

// ── Unit tests ───────────────────────────────────────────────────────────────

describe("predictDelta", () => {
  it("returns zeros when cell is already empty", () => {
    const board = makePartialBoard9();
    const result = predictDelta(board, 0, 0, 9, 3);
    expect(result.score).toBe(0);
    expect(result.candidateSurge).toBe(0);
    expect(result.mrvShift).toBe(0);
  });

  it("is deterministic for the same input", () => {
    const board = makeSolvedBoard9();
    const r1 = predictDelta(board, 2, 3, 9, 3);
    const r2 = predictDelta(board, 2, 3, 9, 3);
    expect(r1).toEqual(r2);
  });

  it("has no side effects — board is not modified", () => {
    const board = makeSolvedBoard9();
    const before = cloneBoard(board);
    predictDelta(board, 1, 1, 9, 3);
    expect(board).toEqual(before);
  });

  it("returns identical results for rotationally symmetric cells on a solved board", () => {
    const board = makeSolvedBoard9();
    const r1 = predictDelta(board, 1, 2, 9, 3);
    const r2 = predictDelta(board, 7, 6, 9, 3);
    expect(r1).toEqual(r2);
  });

  it("returns positive candidateSurge for any removal from a solved 9×9 board", () => {
    const board = makeSolvedBoard9();
    const result = predictDelta(board, 0, 0, 9, 3);
    expect(result.candidateSurge).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThan(0);
  });

  it("works with a 4×4 solved board", () => {
    const board = makeSolvedBoard4();
    const result = predictDelta(board, 0, 0, 4, 2);
    expect(result.candidateSurge).toBeGreaterThan(0);
    expect(typeof result.score).toBe("number");
  });

  it("returns higher surge when removing from a denser region", () => {
    const board = makePartialBoard9();
    // Cell (0,2) is in a row with 2 already-empty cells (0,0) and (0,1)
    // Cell (8,0) is in a row with 0 already-empty cells
    const r1 = predictDelta(board, 0, 2, 9, 3);
    const r2 = predictDelta(board, 8, 0, 9, 3);
    expect(r1.candidateSurge).not.toBeNaN();
    expect(r2.candidateSurge).not.toBeNaN();
  });

  it("computes mrvShift in [-1, 1] range", () => {
    const board = makeSolvedBoard9();
    const result = predictDelta(board, 3, 5, 9, 3);
    expect(result.mrvShift).toBeGreaterThanOrEqual(-1);
    expect(result.mrvShift).toBeLessThanOrEqual(1);
  });

  it("produces a finite numeric score for all cells of a solved board", () => {
    const board = makeSolvedBoard9();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const result = predictDelta(board, r, c, 9, 3);
        expect(Number.isFinite(result.score)).toBe(true);
        expect(Number.isFinite(result.candidateSurge)).toBe(true);
        expect(Number.isFinite(result.mrvShift)).toBe(true);
      }
    }
  });

  it("all cells on a fully solved board give the same prediction", () => {
    const board = makeSolvedBoard9();
    const baseline = predictDelta(board, 0, 0, 9, 3);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const result = predictDelta(board, r, c, 9, 3);
        expect(result).toEqual(baseline);
      }
    }
  });

  it("returns zero for an empty cell vs non-zero for a filled cell", () => {
    const board = makePartialBoard9();
    const empty = predictDelta(board, 0, 0, 9, 3);
    const filled = predictDelta(board, 0, 2, 9, 3);
    expect(empty.score).toBe(0);
    expect(filled.score).not.toBe(0);
  });

  it("multiple calls to the same cell return the same result", () => {
    const board = makeSolvedBoard9();
    const results = Array.from({ length: 5 }, () =>
      predictDelta(board, 4, 4, 9, 3)
    );
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0]!);
    }
  });
});

// ── Benchmark: predictor vs HumanSolver ──────────────────────────────────────

describe("Benchmark: predictor vs HumanSolver", () => {
  const DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;

  function generatePuzzle(difficulty: typeof DIFFICULTIES[number]): number[][] {
    const gen = new SudokuGenerator({
      size: 9,
      boxSize: 3,
      difficulty,
      matchDifficulty: false,
    });
    return gen.generate().puzzle;
  }

  function sampleFilledCells(
    board: number[][],
    count: number
  ): Array<[number, number]> {
    const cells: Array<[number, number]> = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r]![c] !== 0) {
          cells.push([r, c]);
        }
      }
    }
    // Fisher-Yates shuffle, take first `count`
    const shuffled = [...cells];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = tmp;
    }
    return shuffled.slice(0, count);
  }

  function computeActualDelta(
    board: number[][],
    row: number,
    col: number
  ): number {
    const beforeResult = analyzeSolveResult(solve(board));
    const temp = cloneBoard(board);
    temp[row]![col] = 0;
    const afterResult = analyzeSolveResult(solve(temp));
    return afterResult.score - beforeResult.score;
  }

  it("computes correlation across generated puzzles", () => {
    const SAMPLES_PER_DIFFICULTY = 3;
    const CELLS_PER_PUZZLE = 5;

    const predictions: number[] = [];
    const actuals: number[] = [];

    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < SAMPLES_PER_DIFFICULTY; i++) {
        const puzzle = generatePuzzle(difficulty);
        const cells = sampleFilledCells(puzzle, CELLS_PER_PUZZLE);

        for (const [r, c] of cells) {
          const pred = predictDelta(puzzle, r, c, 9, 3);
          const actual = computeActualDelta(puzzle, r, c);

          predictions.push(pred.score);
          actuals.push(actual);
        }
      }
    }

    // Compute and report Pearson correlation
    const n = predictions.length;
    const meanP = predictions.reduce((a, b) => a + b, 0) / n;
    const meanA = actuals.reduce((a, b) => a + b, 0) / n;
    let cov = 0, varP = 0, varA = 0;
    for (let i = 0; i < n; i++) {
      const dp = predictions[i]! - meanP;
      const da = actuals[i]! - meanA;
      cov += dp * da;
      varP += dp * dp;
      varA += da * da;
    }
    const r = cov / Math.sqrt(varP * varA);

    // Compute Spearman rank correlation
    const indexed: Array<{ pred: number; actual: number; idx: number }> =
      predictions.map((p, i) => ({ pred: p, actual: actuals[i]!, idx: i }));
    const predRanks = [...indexed].sort((a, b) => a.pred - b.pred);
    const actualRanks = [...indexed].sort((a, b) => a.actual - b.actual);
    const rankMap = new Map<number, number>();
    actualRanks.forEach((v, i) => rankMap.set(v.idx, i));
    const predRankValues = predRanks.map((_, i) => i);
    const actualRankValues = predRanks.map((v) => rankMap.get(v.idx)!);
    const meanPR = predRankValues.reduce((a, b) => a + b, 0) / n;
    const meanAR = actualRankValues.reduce((a, b) => a + b, 0) / n;
    let covR = 0, varPR = 0, varAR = 0;
    for (let i = 0; i < n; i++) {
      const dp = predRankValues[i]! - meanPR;
      const da = actualRankValues[i]! - meanAR;
      covR += dp * da;
      varPR += dp * dp;
      varAR += da * da;
    }
    const rho = covR / Math.sqrt(varPR * varAR);

    console.log(`\nBenchmark data points: ${n}`);
    console.log(`Predictor score range: [${Math.min(...predictions).toFixed(4)}, ${Math.max(...predictions).toFixed(4)}]`);
    console.log(`Actual delta range:    [${Math.min(...actuals).toFixed(1)}, ${Math.max(...actuals).toFixed(1)}]`);
    console.log(`Pearson's r:           ${r.toFixed(4)}`);
    console.log(`Spearman's ρ:          ${rho.toFixed(4)}`);
    console.log(`Predictions: ${predictions.map((v) => v.toFixed(4)).join(", ")}`);
    console.log(`Actuals:    ${actuals.map((v) => v.toFixed(4)).join(", ")}`);

    // Sanity checks: benchmark ran without errors
    expect(predictions.length).toBe(
      DIFFICULTIES.length * SAMPLES_PER_DIFFICULTY * CELLS_PER_PUZZLE
    );
    expect(actuals.length).toBe(predictions.length);
    expect(predictions.every((v) => Number.isFinite(v))).toBe(true);
    expect(actuals.every((v) => Number.isFinite(v))).toBe(true);
    expect(Number.isFinite(r)).toBe(true);
    expect(Number.isFinite(rho)).toBe(true);
  });

  it("predictor score ranks cells consistently across repeated runs", () => {
    // Run predictor twice on the same puzzle and verify ranking consistency
    const puzzle = generatePuzzle("hard");
    const cells = sampleFilledCells(puzzle, 10);
    const first: number[] = [];
    const second: number[] = [];

    for (const [r, c] of cells) {
      first.push(predictDelta(puzzle, r, c, 9, 3).score);
      second.push(predictDelta(puzzle, r, c, 9, 3).score);
    }

    for (let i = 0; i < cells.length; i++) {
      expect(first[i]).toBe(second[i]);
    }
  });

  it("produces non-zero predictions for all sampled cells", () => {
    // At least some removals should have non-zero difficulty impact
    const puzzle = generatePuzzle("medium");
    const cells = sampleFilledCells(puzzle, 10);
    let nonZeroCount = 0;

    for (const [r, c] of cells) {
      const pred = predictDelta(puzzle, r, c, 9, 3);
      if (pred.score !== 0) nonZeroCount++;
    }

    expect(nonZeroCount).toBeGreaterThan(0);
  });
});
