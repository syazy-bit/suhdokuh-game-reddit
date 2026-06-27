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

    // MRV: find empty cell with the fewest legal candidates
    let mrvRow = -1;
    let mrvCol = -1;
    let mrvCount = size + 1;

    outer: for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (g[r]![c] !== 0) continue;

        let count = 0;
        for (let num = 1; num <= size; num++) {
          if (isValidPlacement(g, r, c, num, size, boxSize)) {
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
      if (isValidPlacement(g, mrvRow, mrvCol, num, size, boxSize)) {
        g[mrvRow]![mrvCol] = num;
        solve(g);
        g[mrvRow]![mrvCol] = 0;
      }
    }
  }

  solve(cloneGrid(grid));
  return !cutoffReached && solutionCount === 1;
}
