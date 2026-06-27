import type { Difficulty } from "../../shared/types/api";
import { isValidPlacement, cloneGrid, type GridSize } from "./SudokuValidator";

export type { GridSize } from "./SudokuValidator";

export function hasDuplicateValues(arr: number[]): boolean {
  const seen = new Set<number>();
  for (const v of arr) {
    if (v !== 0) {
      if (seen.has(v)) return true;
      seen.add(v);
    }
  }
  return false;
}

/**
 * Independent uniqueness oracle — intentionally separate from the generator's
 * internal uniqueness check (SudokuSolver). This provides an independent
 * verification that generated puzzles truly have exactly one solution.
 */
export function countSolutions(grid: number[][], size: GridSize, limit: number, maxSteps: number): number {
  const bSize = size === 4 ? 2 : 3;

  let solutionCount = 0;
  let steps = 0;
  let cutoff = false;

  function solve(g: number[][]): void {
    if (cutoff) return;
    if (solutionCount >= limit) return;
    if (steps++ > maxSteps) { cutoff = true; return; }

    // MRV: find empty cell with the fewest legal candidates
    let mrvRow = -1;
    let mrvCol = -1;
    let mrvCount = size + 1;

    outer: for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (g[r]![c] !== 0) continue;

        let count = 0;
        for (let num = 1; num <= size; num++) {
          if (isValidPlacement(g, r, c, num, size, bSize)) {
            count++;
          }
        }

        if (count < mrvCount) {
          mrvCount = count;
          mrvRow = r;
          mrvCol = c;
          if (count <= 1) break outer;
        }
      }
    }

    if (mrvRow === -1) {
      solutionCount++;
      return;
    }

    if (mrvCount === 0) return;

    for (let num = 1; num <= size; num++) {
      if (isValidPlacement(g, mrvRow, mrvCol, num, size, bSize)) {
        g[mrvRow]![mrvCol] = num;
        solve(g);
        g[mrvRow]![mrvCol] = 0;
      }
    }
  }

  solve(cloneGrid(grid));
  return cutoff ? -1 : solutionCount;
}

export const difficultyCellsRemoved: Record<Difficulty, Record<GridSize, { min: number; max: number }>> = {
  easy:   { 4: { min: 4, max: 8 }, 9: { min: 25, max: 38 } },
  medium: { 4: { min: 6, max: 10 }, 9: { min: 38, max: 50 } },
  hard:   { 4: { min: 8, max: 12 }, 9: { min: 42, max: 55 } },
};
