import { cloneGrid, type GridSize } from "../../core/SudokuValidator";
import type { RngFn } from "../types";
import { SudokuGenerator } from "../../core/SudokuGenerator";

function shuffleArray<T>(array: T[], rng: RngFn): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }
  return shuffled;
}

export function randomSolvedBoard(size: GridSize, rng: RngFn): number[][] {
  const boxSize = size === 4 ? 2 : 3;
  const difficulty = size === 4 ? "beginner" : "easy";
  const generator = new SudokuGenerator({
    size,
    boxSize,
    difficulty,
    rng,
    matchDifficulty: false,
    maxAttempts: 1,
  });
  const result = generator.generate();
  return cloneGrid(result.solution);
}

export interface PartialBoardWithSolution {
  partial: number[][];
  solution: number[][];
}

export function randomPartialBoardWithSolution(size: GridSize, rng: RngFn, fillRatio?: number): PartialBoardWithSolution {
  const solved = randomSolvedBoard(size, rng);
  const ratio = fillRatio ?? 0.5;

  const flat: Array<{ r: number; c: number; v: number }> = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      flat.push({ r, c, v: solved[r]![c]! });
    }
  }
  const shuffled = shuffleArray(flat, rng);
  const keepCount = Math.round(flat.length * ratio);

  const partial: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  for (let i = 0; i < keepCount; i++) {
    const cell = shuffled[i]!;
    partial[cell.r]![cell.c] = cell.v;
  }
  return { partial, solution: solved };
}

export function randomPartialBoard(size: GridSize, rng: RngFn, fillRatio?: number): number[][] {
  return randomPartialBoardWithSolution(size, rng, fillRatio).partial;
}

export function cloneBoard(grid: number[][]): number[][] {
  return cloneGrid(grid);
}
