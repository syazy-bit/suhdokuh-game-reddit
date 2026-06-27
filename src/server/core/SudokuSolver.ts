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

  function propagateSingles(g: number[][]): { ok: boolean; filled: Array<{ r: number; c: number }> } {
    const filled: Array<{ r: number; c: number }> = [];
    let progress = true;
    while (progress) {
      progress = false;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (g[r]![c] !== 0) continue;

          let last = -1;
          let count = 0;
          for (let num = 1; num <= size; num++) {
            if (isValidPlacement(g, r, c, num, size, boxSize)) {
              count++;
              last = num;
              if (count > 1) break;
            }
          }

          if (count === 0) return { ok: false, filled };
          if (count === 1) {
            g[r]![c] = last;
            filled.push({ r, c });
            progress = true;
          }
        }
      }
    }
    return { ok: true, filled };
  }

  function solve(g: number[][]): void {
    if (cutoffReached) return;
    if (solutionCount >= 2) return;
    if (steps++ > limit) {
      cutoffReached = true;
      return;
    }

    // Constraint propagation: fill Naked Singles repeatedly
    const { ok, filled } = propagateSingles(g);
    if (!ok) {
      for (const { r, c } of filled) g[r]![c] = 0;
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
    } else if (mrvCount > 0) {
      for (let num = 1; num <= size; num++) {
        if (isValidPlacement(g, mrvRow, mrvCol, num, size, boxSize)) {
          g[mrvRow]![mrvCol] = num;
          solve(g);
          g[mrvRow]![mrvCol] = 0;
        }
      }
    }

    for (const { r, c } of filled) g[r]![c] = 0;
  }

  solve(cloneGrid(grid));
  return !cutoffReached && solutionCount === 1;
}
