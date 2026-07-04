export type GridSize = 4 | 9;

/**
 * Find every cell in the same row, column, or box as (row, col) that already
 * contains `num`.  The target cell itself is excluded.
 * Duplicates at intersections (e.g. a cell in both row and column) are
 * returned once.
 */
export function getConflictingCells(
  grid: number[][],
  row: number,
  col: number,
  num: number,
  size: GridSize,
  boxSize: number
): Array<{ r: number; c: number }> {
  const conflicts: Array<{ r: number; c: number }> = [];
  const seen = new Set<string>();
  const cellKey = (r: number, c: number) => `${r},${c}`;

  for (let c = 0; c < size; c++) {
    if (c !== col && grid[row]![c] === num && !seen.has(cellKey(row, c))) {
      seen.add(cellKey(row, c));
      conflicts.push({ r: row, c });
    }
  }
  for (let r = 0; r < size; r++) {
    if (r !== row && grid[r]![col] === num && !seen.has(cellKey(r, col))) {
      seen.add(cellKey(r, col));
      conflicts.push({ r, c: col });
    }
  }
  const boxRow = Math.floor(row / boxSize) * boxSize;
  const boxCol = Math.floor(col / boxSize) * boxSize;
  for (let r = boxRow; r < boxRow + boxSize; r++) {
    for (let c = boxCol; c < boxCol + boxSize; c++) {
      if ((r !== row || c !== col) && grid[r]![c] === num && !seen.has(cellKey(r, c))) {
        seen.add(cellKey(r, c));
        conflicts.push({ r, c });
      }
    }
  }

  return conflicts;
}
