/**
 * Unified Sudoku Puzzle Generator
 * 
 * Generates valid Sudoku puzzles for both 4×4 and 9×9 grids using a single
 * parameterized algorithm. Ensures unique solutions and type-safe implementation.
 * 
 * @author Suhdokuh Team
 * @version 1.0.0
 */

import type { Difficulty } from "../../shared/types/api";

export type GridSize = 4 | 9;

export interface GeneratorConfig {
  size: GridSize;
  boxSize: number;
  difficulty: Difficulty;
}

export interface GeneratedPuzzle {
  puzzle: number[][];    // Grid with empty cells (0s)
  solution: number[][];  // Complete valid solution
  size: GridSize;
  cellsRemoved: number;  // Number of cells removed from solution
}

/**
 * Unified Sudoku Generator Class
 * 
 * Uses a single parameterized algorithm to generate puzzles for both 4×4 and 9×9 grids.
 * Zero code duplication - all logic adapts based on size and boxSize parameters.
 */
export class SudokuGenerator {
  private size: GridSize;
  private boxSize: number;
  private difficulty: Difficulty;

  constructor(config: GeneratorConfig) {
    this.size = config.size;
    this.boxSize = config.boxSize;
    this.difficulty = config.difficulty;

    // Validate configuration
    if (this.boxSize * this.boxSize !== this.size) {
      throw new Error(
        `Invalid configuration: boxSize^2 must equal size (${this.boxSize}^2 ≠ ${this.size})`
      );
    }
  }

  /**
   * Generate a complete puzzle with solution
   * @returns Generated puzzle and solution
   */
  public generate(): GeneratedPuzzle {
    const solution = this.generateSolution();
    const puzzle = this.createPuzzle(solution);

    return {
      puzzle,
      solution,
      size: this.size,
      cellsRemoved: this.countEmpty(puzzle),
    };
  }

  /**
   * Generate a complete valid Sudoku solution
   * Uses backtracking with randomization for variety
   * @returns Complete filled grid
   */
  private generateSolution(): number[][] {
    let grid: number[][] = [];
    let solved = false;
    
    // Loop until we find a set of diagonal boxes that can be successfully solved
    while (!solved) {
      // Create empty grid
      grid = Array.from({ length: this.size }, () =>
        Array(this.size).fill(0)
      );

      // Fill diagonal boxes first (they're independent)
      this.fillDiagonalBoxes(grid);

      // Fill remaining cells using backtracking
      solved = this.solveSudoku(grid);
    }

    return grid;
  }

  /**
   * Fill diagonal boxes (they don't interact with each other)
   * This reduces the search space for backtracking
   */
  private fillDiagonalBoxes(grid: number[][]): void {
    for (let box = 0; box < this.boxSize; box++) {
      const startRow = box * this.boxSize;
      const startCol = box * this.boxSize;
      this.fillBox(grid, startRow, startCol);
    }
  }

  /**
   * Fill a single box with random numbers
   */
  private fillBox(grid: number[][], startRow: number, startCol: number): void {
    const numbers = this.shuffleArray(
      Array.from({ length: this.size }, (_, i) => i + 1)
    );

    let idx = 0;
    for (let r = 0; r < this.boxSize; r++) {
      for (let c = 0; c < this.boxSize; c++) {
        grid[startRow + r]![startCol + c] = numbers[idx++]!;
      }
    }
  }

  /**
   * Create puzzle by removing cells from solution
   * Unified approach with uniqueness validation for both 4×4 and 9×9
   */
  private createPuzzle(solution: number[][]): number[][] {
    const puzzle = solution.map((row) => [...row]);

    // Target removal count based on size and difficulty
    const targets: Record<Difficulty, Record<GridSize, number>> = {
      easy:   { 4: 6, 9: 30 },
      medium: { 4: 8, 9: 45 },
      hard:   { 4: 10, 9: 50 },
    };
    const targetRemoval = targets[this.difficulty][this.size];
    
    // Create shuffled list of all cell positions
    const positions: Array<[number, number]> = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        positions.push([r, c]);
      }
    }
    this.shuffleArray(positions);

    // Density guard: track removals per row/col/box to prevent clustering
    const rowRemoved = Array(this.size).fill(0);
    const colRemoved = Array(this.size).fill(0);
    const boxRemoved = Array(this.size).fill(0);

    const densityMultiplier = this.difficulty === "hard" ? 0.70 : 0.65;
    const maxPerRow = Math.ceil(this.size * densityMultiplier);
    const maxPerCol = Math.ceil(this.size * densityMultiplier);
    const maxPerBox = Math.ceil(this.size * densityMultiplier);

    // Helper to compute box index
    const getBoxIndex = (r: number, c: number) =>
      Math.floor(r / this.boxSize) * this.boxSize +
      Math.floor(c / this.boxSize);

    let removed = 0;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 10;
    let prevRemoved = -1;

    while (removed < targetRemoval && removed > prevRemoved && consecutiveFailures < maxConsecutiveFailures) {
      prevRemoved = removed;

      if (removed > 0) {
        this.shuffleArray(positions);
      }

      for (let i = 0; i < positions.length && removed < targetRemoval && consecutiveFailures < maxConsecutiveFailures; i++) {
        const [row, col] = positions[i]!;
        const symRow = this.size - 1 - row;
        const symCol = this.size - 1 - col;

        // Skip if already removed
        if (puzzle[row]![col] === 0) continue;

        const box1 = getBoxIndex(row, col);
        const box2 = getBoxIndex(symRow, symCol);

        // Density guard: prevent ugly clustering
        if (
          rowRemoved[row]! >= maxPerRow ||
          colRemoved[col]! >= maxPerCol ||
          boxRemoved[box1]! >= maxPerBox ||
          rowRemoved[symRow]! >= maxPerRow ||
          colRemoved[symCol]! >= maxPerCol ||
          boxRemoved[box2]! >= maxPerBox
        ) {
          continue;
        }

        // Backup both cells
        const backup1 = puzzle[row]![col]!;
        const backup2 = puzzle[symRow]![symCol]!;

        // Remove both cells (symmetric removal)
        puzzle[row]![col] = 0;
        puzzle[symRow]![symCol] = 0;

        // Validate uniqueness
        const isValid = this.validatePuzzleRemoval(puzzle);

        if (isValid) {
          // Count how many cells we actually removed (1 if center, 2 otherwise)
          const delta = (row === symRow && col === symCol) ? 1 : 2;

          removed += delta;
          consecutiveFailures = 0;

          // Update density counters
          rowRemoved[row]!++;
          colRemoved[col]!++;
          boxRemoved[box1]!++;

          if (row !== symRow || col !== symCol) {
            rowRemoved[symRow]!++;
            colRemoved[symCol]!++;
            boxRemoved[box2]!++;
          }
        } else {
          // Restore both cells if it breaks uniqueness
          puzzle[row]![col] = backup1;
          puzzle[symRow]![symCol] = backup2;
          consecutiveFailures++;
        }
      }
    }

    console.log(`[GENERATOR] Removed ${removed}/${targetRemoval} cells from ${this.size}×${this.size} puzzle`);
    return puzzle;
  }

  /**
   * Validate that removing a cell maintains puzzle solvability
   * Uses optimized validation based on grid size
   */
  private validatePuzzleRemoval(puzzle: number[][]): boolean {
    return this.size === 4
      ? this.hasUniqueSolution(puzzle)
      : this.hasUniqueSolutionOptimized(puzzle);
  }

  /**
   * Optimized uniqueness check for larger grids
   * Limits search depth to avoid timeout
   */
  private hasUniqueSolutionOptimized(puzzle: number[][]): boolean {
    let solutionCount = 0;
    let cutoffReached = false;
    let steps = 0;
    const MAX_STEPS = 200_000; // mobile-safe cutoff

    const countSolutions = (grid: number[][]): void => {
      if (cutoffReached) return;
      if (solutionCount >= 2) return;
      if (steps++ > MAX_STEPS) {
        cutoffReached = true;
        return;
      }

      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (grid[r]![c] === 0) {
            for (let num = 1; num <= this.size; num++) {
              if (this.isValid(grid, r, c, num)) {
                grid[r]![c] = num;
                countSolutions(grid);
                grid[r]![c] = 0;
              }
            }
            return;
          }
        }
      }

      solutionCount++;
    };

    const gridCopy = puzzle.map((row) => [...row]);
    countSolutions(gridCopy);

    return !cutoffReached && solutionCount === 1;
  }

  /**
   * Check if puzzle has exactly one unique solution
   * Uses backtracking with early termination
   */
  private hasUniqueSolution(puzzle: number[][]): boolean {
    let solutionCount = 0;

    const countSolutions = (grid: number[][]): void => {
      if (solutionCount >= 2) return; // Early termination

      // Find empty cell
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (grid[r]![c] === 0) {
            // Try each number
            for (let num = 1; num <= this.size; num++) {
              if (this.isValid(grid, r, c, num)) {
                grid[r]![c] = num;
                countSolutions(grid);
                grid[r]![c] = 0; // Backtrack
              }
            }
            return;
          }
        }
      }

      // No empty cells = found a solution
      solutionCount++;
    };

    // Work on a copy
    const gridCopy = puzzle.map((row) => [...row]);
    countSolutions(gridCopy);

    return solutionCount === 1;
  }

  /**
   * Solve Sudoku using backtracking
   * Modifies grid in place
   * @returns true if solved, false if no solution
   */
  private solveSudoku(grid: number[][]): boolean {
    // Find empty cell
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (grid[r]![c] === 0) {
          // Try numbers in random order for variety
          const numbers = this.shuffleArray(
            Array.from({ length: this.size }, (_, i) => i + 1)
          );

          for (const num of numbers) {
            if (this.isValid(grid, r, c, num)) {
              grid[r]![c] = num;

              if (this.solveSudoku(grid)) {
                return true;
              }

              grid[r]![c] = 0; // Backtrack
            }
          }

          return false; // No valid number found
        }
      }
    }

    return true; // All cells filled
  }

  /**
   * Check if placing num at (row, col) is valid
   * Validates row, column, and box constraints
   */
  private isValid(
    grid: number[][],
    row: number,
    col: number,
    num: number
  ): boolean {
    // Check row
    for (let c = 0; c < this.size; c++) {
      if (grid[row]![c] === num) return false;
    }

    // Check column
    for (let r = 0; r < this.size; r++) {
      if (grid[r]![col] === num) return false;
    }

    // Check box (parameterized by boxSize)
    const boxRow = Math.floor(row / this.boxSize) * this.boxSize;
    const boxCol = Math.floor(col / this.boxSize) * this.boxSize;

    for (let r = boxRow; r < boxRow + this.boxSize; r++) {
      for (let c = boxCol; c < boxCol + this.boxSize; c++) {
        if (grid[r]![c] === num) return false;
      }
    }

    return true;
  }

  /**
   * Count empty cells (0s) in grid
   */
  private countEmpty(grid: number[][]): number {
    let count = 0;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (grid[r]![c] === 0) count++;
      }
    }
    return count;
  }

  /**
   * Fisher-Yates shuffle algorithm
   * Works for both arrays of numbers and arrays of tuples
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i];
      shuffled[i] = shuffled[j]!;
      shuffled[j] = temp!;
    }
    return shuffled;
  }
}
