import type { Difficulty } from "../../shared/types/api";
import { isValidPlacement, countEmpty, difficultyTargets, type GridSize } from "./SudokuValidator";
import { hasUniqueSolution } from "./SudokuSolver";

export type { GridSize } from "./SudokuValidator";

export interface GeneratorConfig {
  size: GridSize;
  boxSize: number;
  difficulty: Difficulty;
}

export interface GeneratedPuzzle {
  puzzle: number[][];
  solution: number[][];
  size: GridSize;
  cellsRemoved: number;
}

export class SudokuGenerator {
  private size: GridSize;
  private boxSize: number;
  private difficulty: Difficulty;

  constructor(config: GeneratorConfig) {
    this.size = config.size;
    this.boxSize = config.boxSize;
    this.difficulty = config.difficulty;

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
    const solution = this.generateSolvedBoard();
    const puzzle = this.createPuzzleFromSolution(solution);

    return {
      puzzle,
      solution,
      size: this.size,
      cellsRemoved: this.countEmpty(puzzle),
    };
  }

  private generateSolvedBoard(): number[][] {
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

  private createPuzzleFromSolution(solution: number[][]): number[][] {
    const puzzle = solution.map((row) => [...row]);
    const targetRemoval = difficultyTargets[this.difficulty][this.size];
    const positions = this.buildPositionList();
    this.removeClues(puzzle, positions, targetRemoval);
    return puzzle;
  }

  private buildPositionList(): Array<[number, number]> {
    const positions: Array<[number, number]> = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        positions.push([r, c]);
      }
    }
    this.shuffleArray(positions);
    return positions;
  }

  private removeClues(puzzle: number[][], positions: Array<[number, number]>, targetRemoval: number): void {
    const rowRemoved = Array(this.size).fill(0);
    const colRemoved = Array(this.size).fill(0);
    const boxRemoved = Array(this.size).fill(0);

    const densityMultiplier = this.difficulty === "hard" ? 0.70 : 0.65;
    const maxPerRow = Math.ceil(this.size * densityMultiplier);
    const maxPerCol = Math.ceil(this.size * densityMultiplier);
    const maxPerBox = Math.ceil(this.size * densityMultiplier);

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

        if (puzzle[row]![col] === 0) continue;

        const box1 = getBoxIndex(row, col);
        const box2 = getBoxIndex(symRow, symCol);

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

        const backup1 = puzzle[row]![col]!;
        const backup2 = puzzle[symRow]![symCol]!;

        puzzle[row]![col] = 0;
        puzzle[symRow]![symCol] = 0;

        const isValid = this.verifyUniqueness(puzzle);

        if (isValid) {
          const delta = (row === symRow && col === symCol) ? 1 : 2;

          removed += delta;
          consecutiveFailures = 0;

          rowRemoved[row]!++;
          colRemoved[col]!++;
          boxRemoved[box1]!++;

          if (row !== symRow || col !== symCol) {
            rowRemoved[symRow]!++;
            colRemoved[symCol]!++;
            boxRemoved[box2]!++;
          }
        } else {
          puzzle[row]![col] = backup1;
          puzzle[symRow]![symCol] = backup2;
          consecutiveFailures++;
        }
      }
    }

    console.log(`[GENERATOR] Removed ${removed}/${targetRemoval} cells from ${this.size}×${this.size} puzzle`);
  }

  private verifyUniqueness(puzzle: number[][]): boolean {
    return hasUniqueSolution(puzzle, this.size, this.boxSize);
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
            if (isValidPlacement(grid, r, c, num, this.size, this.boxSize)) {
              grid[r]![c] = num;

              if (this.solveSudoku(grid)) {
                return true;
              }

              grid[r]![c] = 0;
            }
          }

          return false; // No valid number found
        }
      }
    }

    return true; // All cells filled
  }

  private countEmpty(grid: number[][]): number {
    return countEmpty(grid, this.size);
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
