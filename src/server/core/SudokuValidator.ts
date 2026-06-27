import type { Difficulty } from "../../shared/types/api";

export type GridSize = 4 | 9;

export function isValidPlacement(
  grid: number[][],
  row: number,
  col: number,
  num: number,
  size: GridSize,
  boxSize: number
): boolean {
  for (let c = 0; c < size; c++) if (grid[row]![c] === num) return false;
  for (let r = 0; r < size; r++) if (grid[r]![col] === num) return false;
  const boxRow = Math.floor(row / boxSize) * boxSize;
  const boxCol = Math.floor(col / boxSize) * boxSize;
  for (let r = boxRow; r < boxRow + boxSize; r++)
    for (let c = boxCol; c < boxCol + boxSize; c++)
      if (grid[r]![c] === num) return false;
  return true;
}

export function isValidSolution(grid: number[][], size: GridSize): boolean {
  const boxSize = size === 4 ? 2 : 3;
  const expectedSum = (size * (size + 1)) / 2;

  for (let r = 0; r < size; r++) {
    const row = grid[r]!;
    if (new Set(row).size !== size || row.reduce((a, b) => a + b, 0) !== expectedSum) return false;
  }

  for (let c = 0; c < size; c++) {
    const col: number[] = [];
    for (let r = 0; r < size; r++) col.push(grid[r]![c]!);
    if (new Set(col).size !== size || col.reduce((a, b) => a + b, 0) !== expectedSum) return false;
  }

  for (let br = 0; br < size; br += boxSize) {
    for (let bc = 0; bc < size; bc += boxSize) {
      const box: number[] = [];
      for (let r = br; r < br + boxSize; r++)
        for (let c = bc; c < bc + boxSize; c++)
          box.push(grid[r]![c]!);
      if (new Set(box).size !== size || box.reduce((a, b) => a + b, 0) !== expectedSum) return false;
    }
  }

  return true;
}

export function areCluesConsistent(puzzle: number[][], solution: number[][], size: GridSize): boolean {
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (puzzle[r]![c] !== 0 && puzzle[r]![c] !== solution[r]![c]) return false;
  return true;
}

export function cloneGrid<T>(grid: T[][]): T[][] {
  return grid.map((row) => [...row]);
}

export function countEmpty(grid: number[][], size: GridSize): number {
  let count = 0;
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (grid[r]![c] === 0) count++;
  return count;
}

export const difficultyTargets: Record<Difficulty, Record<GridSize, number>> = {
  easy:   { 4: 6, 9: 30 },
  medium: { 4: 8, 9: 45 },
  hard:   { 4: 10, 9: 50 },
  // TODO: calibrate expert targets — may only be reachable for 9×9
  expert: { 4: 12, 9: 55 },
};
