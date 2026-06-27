import { isValidPlacement, cloneGrid, type GridSize } from "./SudokuValidator";

export function hasUniqueSolution(
  grid: number[][],
  size: GridSize,
  boxSize: number,
  maxSteps?: number
): boolean {
  let solutionCount = 0;
  let steps = 0;
  let cutoffReached = false;
  const limit = maxSteps ?? (size === 9 ? 200_000 : Number.POSITIVE_INFINITY);

  function solve(g: number[][]): void {
    if (cutoffReached) return;
    if (solutionCount >= 2) return;
    if (steps++ > limit) {
      cutoffReached = true;
      return;
    }

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (g[r]![c] === 0) {
          for (let num = 1; num <= size; num++) {
            if (isValidPlacement(g, r, c, num, size, boxSize)) {
              g[r]![c] = num;
              solve(g);
              g[r]![c] = 0;
            }
          }
          return;
        }
      }
    }

    solutionCount++;
  }

  solve(cloneGrid(grid));
  return !cutoffReached && solutionCount === 1;
}
