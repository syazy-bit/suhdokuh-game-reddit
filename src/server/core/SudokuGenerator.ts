import type { AnyDifficulty } from "../../shared/types/api";
import { isValidPlacement, countEmpty, difficultyTargets, type GridSize } from "./SudokuValidator";
import { hasUniqueSolution } from "./SudokuSolver";
import { solve } from "./HumanSolverPipeline";
import { analyzeSolveResult, createEmptyAnalysis, type AnalysisResult } from "./DifficultyAnalyzer";
import { buildCandidateMap } from "./CandidateEngine";
import { evaluateCandidates, estimateDelta, computeEligibleSet, registerDefaultFeatures, getLambda, getAbsoluteRMSE, type RemovalCandidate, type PredictorContextData } from "./predictor/index";

export type { GridSize } from "./SudokuValidator";

export interface GeneratorConfig {
  size: GridSize;
  boxSize: number;
  difficulty: AnyDifficulty;
  maxAttempts?: number;
  matchDifficulty?: boolean;
  useGuidedRemoval?: boolean;
  usePredictor?: boolean;
  usePredictorAwareBudget?: boolean;
  rng?: () => number;
}

export interface GeneratedPuzzle {
  puzzle: number[][];
  solution: number[][];
  size: GridSize;
  cellsRemoved: number;
  analysis: AnalysisResult;
}

export class SudokuGenerator {
  private size: GridSize;
  private boxSize: number;
  private difficulty: AnyDifficulty;
  private maxAttempts: number;
  private matchDifficulty: boolean;
  private useGuidedRemoval: boolean;
  private usePredictor: boolean;
  private usePredictorAwareBudget: boolean;
  private rng: () => number;

  constructor(config: GeneratorConfig) {
    this.size = config.size;
    this.boxSize = config.boxSize;
    this.difficulty = config.difficulty;
    this.maxAttempts = config.maxAttempts ?? 50;
    this.matchDifficulty = config.matchDifficulty ?? true;
    this.useGuidedRemoval = config.useGuidedRemoval ?? false;
    this.usePredictor = config.usePredictor ?? false;
    this.usePredictorAwareBudget = config.usePredictorAwareBudget ?? false;
    this.rng = config.rng ?? Math.random;

    if (this.maxAttempts < 1) {
      throw new Error(
        `Invalid configuration: maxAttempts must be >= 1 (got ${this.maxAttempts})`
      );
    }

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
    if (this.size === 4) {
      return this.generate4x4();
    }
    return this.generate9x9();
  }

  private generate4x4(): GeneratedPuzzle {
    if (this.difficulty !== "beginner" && this.difficulty !== "advanced") {
      throw new Error(
        `Failed to generate ${this.size}×${this.size} ${this.difficulty} puzzle: invalid difficulty for 4×4 mode`
      );
    }

    const start = performance.now();
    const solution = this.generateSolvedBoard();
    const targetRemoval = this.difficulty === "advanced" ? 8 : 6;
    const puzzle = this.createPuzzleFromSolution(solution, targetRemoval);
    const cellsRemoved = this.countEmpty(puzzle);
    const elapsed = Math.round(performance.now() - start);

    console.log(`Generated 4×4 ${this.difficulty} puzzle`);
    console.log(`Removed ${cellsRemoved} cells`);
    console.log(`Unique solution verified`);
    console.log(`Generation: ${elapsed} ms`);

    return {
      puzzle,
      solution,
      size: this.size,
      cellsRemoved,
      analysis: createEmptyAnalysis(),
    };
  }

  private generate9x9(): GeneratedPuzzle {
    if (this.difficulty === "beginner" || this.difficulty === "advanced") {
      throw new Error(
        `Failed to generate ${this.size}×${this.size} ${this.difficulty} puzzle: invalid difficulty for 9×9 mode`
      );
    }

    const solution = this.generateSolvedBoard();
    const targetRemoval = difficultyTargets[this.difficulty][9];
    const puzzle = this.createPuzzleFromSolution(solution, targetRemoval);
    const solveResult = solve(puzzle);
    const analysis = analyzeSolveResult(solveResult);

    if (!this.matchDifficulty) {
      return {
        puzzle,
        solution,
        size: this.size,
        cellsRemoved: this.countEmpty(puzzle),
        analysis,
      };
    }

    if (analysis.difficulty === this.difficulty) {
      return {
        puzzle,
        solution,
        size: this.size,
        cellsRemoved: this.countEmpty(puzzle),
        analysis,
      };
    }

    // ── Local search phase ──────────────────────────────────────────────────
    if (SudokuGenerator.USE_LOCAL_SEARCH) {
      const improved = this.localSearch(puzzle, solution, analysis);
      if (improved !== null) {
        return {
          puzzle: improved.puzzle,
          solution,
          size: this.size,
          cellsRemoved: this.countEmpty(improved.puzzle),
          analysis: improved.analysis,
        };
      }
    }

    let lastAnalysis = analysis;

    for (let attempt = 2; attempt <= this.maxAttempts; attempt++) {
      const nextSolution = this.generateSolvedBoard();
      const nextTargetRemoval = difficultyTargets[this.difficulty][9];
      const nextPuzzle = this.createPuzzleFromSolution(nextSolution, nextTargetRemoval);

      const nextSolveResult = solve(nextPuzzle);
      const nextAnalysis = analyzeSolveResult(nextSolveResult);
      lastAnalysis = nextAnalysis;

      if (nextAnalysis.difficulty === this.difficulty) {
        return {
          puzzle: nextPuzzle,
          solution: nextSolution,
          size: this.size,
          cellsRemoved: this.countEmpty(nextPuzzle),
          analysis: nextAnalysis,
        };
      }
    }

    throw new Error(
      `Failed to generate ${this.size}×${this.size} ${this.difficulty} puzzle after ${this.maxAttempts} attempts` +
      ` (last score: ${lastAnalysis.score}, last difficulty: ${lastAnalysis.difficulty})`
    );
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

  private createPuzzleFromSolution(solution: number[][], targetRemoval: number): number[][] {
    const puzzle = solution.map((row) => [...row]);
    const positions = this.buildPositionList();
    this.removeClues(puzzle, positions, targetRemoval);
    return puzzle;
  }

  private static predictorInitialized = false;

  private static ensurePredictorInitialized(): void {
    if (!SudokuGenerator.predictorInitialized) {
      registerDefaultFeatures();
      SudokuGenerator.predictorInitialized = true;
    }
  }

  private static readonly GUIDED_REMOVAL_THRESHOLD = 12;
  private static readonly TOPK = 10;
  private static readonly SAMPLE_SIZE = 5;
  private static readonly DISTANCE_THRESHOLD = 3;

  /** @internal Set to true during benchmarking. Disabled by default — no config flag. */
  static USE_LOCAL_SEARCH = false;
  private static readonly LOCAL_SEARCH_MAX_ITERATIONS = 15;
  private static readonly LOCAL_SEARCH_CANDIDATES = 10;
  private static readonly LOCAL_SEARCH_CLOSE_THRESHOLD = 25;

  private getTargetScore(): number {
    switch (this.difficulty) {
      case "easy": return 20;
      case "medium": return 40;
      case "hard": return 62;
      case "expert": return 90;
      default: return 50;
    }
  }

  private getTolerance(): number {
    const target = this.getTargetScore();
    if (this.difficulty === "easy" || this.difficulty === "medium") {
      return 0.10 * target;
    }
    return 0.15 * target;
  }

  static getEvalBudget(difficulty: string, eligibleCount: number): number {
    const base: Record<string, number> = {
      easy: 1, medium: 2, hard: 2, expert: 3,
    };
    const min: Record<string, number> = {
      easy: 1, medium: 2, hard: 2, expert: 3,
    };
    const max: Record<string, number> = {
      easy: 2, medium: 2, hard: 3, expert: 5,
    };

    let budget = base[difficulty] ?? 2;
    if ((difficulty === "hard" || difficulty === "expert") && eligibleCount >= 4) {
      budget += 1;
    }
    if (eligibleCount <= 1) {
      budget = Math.max(budget - 1, 1);
    }
    return Math.max(min[difficulty] ?? 1, Math.min(max[difficulty] ?? 5, budget));
  }

  private guidedRemovalStep(
    candidates: Array<{
      row: number; col: number; symRow: number; symCol: number;
      box1: number; box2: number; score: number;
    }>,
    puzzle: number[][],
    usePredictorOrder: boolean = false,
    usePredictorAwareBudget: boolean = false,
  ): {
    row: number; col: number; symRow: number; symCol: number;
    box1: number; box2: number; delta: number;
  } | null {
    const sampled = usePredictorOrder
      ? candidates.slice(0, SudokuGenerator.SAMPLE_SIZE)
      : this.shuffleArray(candidates.slice(0, SudokuGenerator.TOPK)).slice(0, SudokuGenerator.SAMPLE_SIZE);

    type Evaluation = {
      row: number; col: number; symRow: number; symCol: number;
      box1: number; box2: number; distance: number;
    };

    // ── Shared predictor context ─────────────────────────────────────────
    let currentScore = 0;
    const targetScore = this.getTargetScore();
    let ctx: PredictorContextData | null = null;

    if (usePredictorOrder) {
      const currentSolveResult = solve(puzzle);
      if (currentSolveResult.solved) {
        const currentAnalysis = analyzeSolveResult(currentSolveResult);
        currentScore = currentAnalysis.score;
        const beforeMap = buildCandidateMap(puzzle, this.size, this.boxSize);
        ctx = {
          board: puzzle, size: this.size, boxSize: this.boxSize,
          beforeCandidateMap: beforeMap,
        };
      }
    }

    // ── Predictor-aware budget path ───────────────────────────────────────
    if (usePredictorOrder && usePredictorAwareBudget && ctx !== null) {
      const rc: RemovalCandidate[] = candidates.map((c) => ({
        row: c.row, col: c.col, symRow: c.symRow, symCol: c.symCol,
        box1: c.box1, box2: c.box2,
        balanceScore: 0, predictorScore: 0, finalScore: 0,
      }));

      const estimated = computeEligibleSet(ctx, rc, this.difficulty, currentScore, targetScore);
      if (estimated.length === 0) return null;

      const tolerance = this.getTolerance();
      const rmse = getAbsoluteRMSE(this.difficulty);
      const threshold = tolerance + rmse;

      const eligible = estimated.filter((e) => e.distance <= threshold);
      const toEval = eligible.length > 0 ? eligible : [estimated[0]!];

      const budget = SudokuGenerator.getEvalBudget(this.difficulty, eligible.length);
      const evalCount = Math.min(budget, toEval.length);

      const evaluated: Evaluation[] = [];

      for (let i = 0; i < evalCount; i++) {
        const e = toEval[i]!;
        const backupRow = puzzle[e.candidate.row]![e.candidate.col]!;
        const backupSym = puzzle[e.candidate.symRow]![e.candidate.symCol]!;
        puzzle[e.candidate.row]![e.candidate.col] = 0;
        puzzle[e.candidate.symRow]![e.candidate.symCol] = 0;

        let accepted = false;
        try {
          if (!hasUniqueSolution(puzzle, this.size, this.boxSize)) continue;
          const solveResult = solve(puzzle);
          if (!solveResult.solved) continue;
          const analysis = analyzeSolveResult(solveResult);
          const actualDistance = Math.abs(analysis.score - targetScore);
          evaluated.push({
            row: e.candidate.row, col: e.candidate.col,
            symRow: e.candidate.symRow, symCol: e.candidate.symCol,
            box1: e.candidate.box1, box2: e.candidate.box2,
            distance: actualDistance,
          });

          // Early stopping: if actual score lands in the target window, accept immediately
          if (actualDistance <= tolerance) {
            accepted = true;
            const delta = (e.candidate.row === e.candidate.symRow && e.candidate.col === e.candidate.symCol) ? 1 : 2;
            return {
              row: e.candidate.row, col: e.candidate.col,
              symRow: e.candidate.symRow, symCol: e.candidate.symCol,
              box1: e.candidate.box1, box2: e.candidate.box2, delta,
            };
          }
        } finally {
          if (!accepted) {
            puzzle[e.candidate.row]![e.candidate.col] = backupRow;
            puzzle[e.candidate.symRow]![e.candidate.symCol] = backupSym;
          }
        }
      }

      // Budget exhausted — pick best evaluated
      if (evaluated.length > 0) {
        evaluated.sort((a, b) => a.distance - b.distance);
        const best = evaluated[0]!;
        puzzle[best.row]![best.col] = 0;
        puzzle[best.symRow]![best.symCol] = 0;
        const delta = (best.row === best.symRow && best.col === best.symCol) ? 1 : 2;
        return {
          row: best.row, col: best.col, symRow: best.symRow, symCol: best.symCol,
          box1: best.box1, box2: best.box2, delta,
        };
      }
    }

    // ── Original predictor-enhanced path ──
    if (usePredictorOrder && ctx !== null) {
      const estimated: Array<{
        row: number; col: number; symRow: number; symCol: number;
        box1: number; box2: number; estimatedDistance: number;
      }> = [];

      for (const c of sampled) {
        const base: RemovalCandidate = {
          row: c.row, col: c.col, symRow: c.symRow, symCol: c.symCol,
          box1: c.box1, box2: c.box2,
          balanceScore: 0, predictorScore: 0, finalScore: 0,
        };
        const pred = estimateDelta(ctx, base, this.difficulty);
        if (!pred.passedStage1) continue;
        estimated.push({
          row: c.row, col: c.col, symRow: c.symRow, symCol: c.symCol,
          box1: c.box1, box2: c.box2,
          estimatedDistance: Math.abs(currentScore + pred.delta - targetScore),
        });
      }

      estimated.sort((a, b) => a.estimatedDistance - b.estimatedDistance);
      const evaluated: Evaluation[] = [];
      const maxToEval = Math.min(2, estimated.length);

      for (let i = 0; i < maxToEval; i++) {
        const e = estimated[i]!;
        const backupRow = puzzle[e.row]![e.col]!;
        const backupSym = puzzle[e.symRow]![e.symCol]!;
        puzzle[e.row]![e.col] = 0;
        puzzle[e.symRow]![e.symCol] = 0;

        try {
          if (!hasUniqueSolution(puzzle, this.size, this.boxSize)) continue;
          const solveResult = solve(puzzle);
          if (!solveResult.solved) continue;
          const analysis = analyzeSolveResult(solveResult);
          evaluated.push({
            row: e.row, col: e.col, symRow: e.symRow, symCol: e.symCol,
            box1: e.box1, box2: e.box2,
            distance: Math.abs(analysis.score - targetScore),
          });
        } finally {
          puzzle[e.row]![e.col] = backupRow;
          puzzle[e.symRow]![e.symCol] = backupSym;
        }
      }

      if (evaluated.length > 0) {
        evaluated.sort((a, b) => a.distance - b.distance);
        const minDistance = evaluated[0]!.distance;
        const tied = evaluated.filter(
          (e) => Math.abs(e.distance - minDistance) <= SudokuGenerator.DISTANCE_THRESHOLD
        );
        const picked = tied[Math.floor(this.rng() * tied.length)]!;
        puzzle[picked.row]![picked.col] = 0;
        puzzle[picked.symRow]![picked.symCol] = 0;
        const delta = (picked.row === picked.symRow && picked.col === picked.symCol) ? 1 : 2;
        return {
          row: picked.row, col: picked.col, symRow: picked.symRow, symCol: picked.symCol,
          box1: picked.box1, box2: picked.box2, delta,
        };
      }
    }

    // ── Fallback: evaluate all sampled candidates via HumanSolver ─────────
    const evaluated: Evaluation[] = [];

    for (const { row, col, symRow, symCol, box1, box2 } of sampled) {
      const backupRow = puzzle[row]![col]!;
      const backupSym = puzzle[symRow]![symCol]!;
      puzzle[row]![col] = 0;
      puzzle[symRow]![symCol] = 0;

      try {
        if (!hasUniqueSolution(puzzle, this.size, this.boxSize)) continue;

        const solveResult = solve(puzzle);
        if (!solveResult.solved) continue;

        const analysis = analyzeSolveResult(solveResult);
        const distance = Math.abs(analysis.score - this.getTargetScore());

        evaluated.push({ row, col, symRow, symCol, box1, box2, distance });
      } finally {
        puzzle[row]![col] = backupRow;
        puzzle[symRow]![symCol] = backupSym;
      }
    }

    if (evaluated.length === 0) return null;

    evaluated.sort((a, b) => a.distance - b.distance);
    const minDistance = evaluated[0]!.distance;
    const tied = evaluated.filter(
      (e) => Math.abs(e.distance - minDistance) <= SudokuGenerator.DISTANCE_THRESHOLD
    );
    const picked = tied[Math.floor(this.rng() * tied.length)]!;

    puzzle[picked.row]![picked.col] = 0;
    puzzle[picked.symRow]![picked.symCol] = 0;

    const delta = (picked.row === picked.symRow && picked.col === picked.symCol) ? 1 : 2;

    return { row: picked.row, col: picked.col, symRow: picked.symRow, symCol: picked.symCol, box1: picked.box1, box2: picked.box2, delta };
  }

  private collectSymmetryPairs(
    puzzle: number[][],
  ): {
    removedPairs: Array<{ r: number; c: number; symR: number; symC: number }>;
    filledPairs: Array<{ r: number; c: number; symR: number; symC: number }>;
  } {
    const visited = Array.from({ length: this.size }, () => Array(this.size).fill(false));
    const removedPairs: Array<{ r: number; c: number; symR: number; symC: number }> = [];
    const filledPairs: Array<{ r: number; c: number; symR: number; symC: number }> = [];

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (visited[r]![c]) continue;

        const symR = this.size - 1 - r;
        const symC = this.size - 1 - c;
        visited[r]![c] = true;
        visited[symR]![symC] = true;

        if (puzzle[r]![c] === 0) {
          removedPairs.push({ r, c, symR, symC });
        } else {
          filledPairs.push({ r, c, symR, symC });
        }
      }
    }

    return { removedPairs, filledPairs };
  }

  private localSearch(
    puzzle: number[][],
    solution: number[][],
    currentAnalysis: AnalysisResult,
  ): { puzzle: number[][]; analysis: AnalysisResult } | null {
    const targetScore = this.getTargetScore();
    let currentDistance = Math.abs(currentAnalysis.score - targetScore);

    if (currentDistance > SudokuGenerator.LOCAL_SEARCH_CLOSE_THRESHOLD) return null;

    let improved = false;
    let lastAnalysis = currentAnalysis;

    for (let iter = 0; iter < SudokuGenerator.LOCAL_SEARCH_MAX_ITERATIONS; iter++) {
      const { removedPairs, filledPairs } = this.collectSymmetryPairs(puzzle);

      if (removedPairs.length === 0 || filledPairs.length === 0) break;

      const shuffledR = this.shuffleArray(removedPairs);
      const shuffledF = this.shuffleArray(filledPairs);

      type EvalResult = {
        restoreR: number; restoreC: number; restoreSymR: number; restoreSymC: number;
        removeR: number; removeC: number; removeSymR: number; removeSymC: number;
        score: number;
      };

      let bestEval: EvalResult | null = null;
      let bestDist = currentDistance;
      let candidateCount = 0;

      for (const rp of shuffledR) {
        for (const fp of shuffledF) {
          if (candidateCount >= SudokuGenerator.LOCAL_SEARCH_CANDIDATES) break;
          candidateCount++;

          const backupRestoreR = puzzle[rp.r]![rp.c]!;
          const backupRestoreSymR = puzzle[rp.symR]![rp.symC]!;
          const backupRemoveR = puzzle[fp.r]![fp.c]!;
          const backupRemoveSymR = puzzle[fp.symR]![fp.symC]!;

          puzzle[rp.r]![rp.c] = solution[rp.r]![rp.c]!;
          puzzle[rp.symR]![rp.symC] = solution[rp.symR]![rp.symC]!;
          puzzle[fp.r]![fp.c] = 0;
          puzzle[fp.symR]![fp.symC] = 0;

          try {
            if (!hasUniqueSolution(puzzle, this.size, this.boxSize)) continue;

            const solveResult = solve(puzzle);
            if (!solveResult.solved) continue;

            const analysis = analyzeSolveResult(solveResult);
            const distance = Math.abs(analysis.score - targetScore);

            if (distance < bestDist) {
              bestDist = distance;
              bestEval = {
                restoreR: rp.r, restoreC: rp.c, restoreSymR: rp.symR, restoreSymC: rp.symC,
                removeR: fp.r, removeC: fp.c, removeSymR: fp.symR, removeSymC: fp.symC,
                score: analysis.score,
              };
              lastAnalysis = analysis;
            }
          } finally {
            puzzle[rp.r]![rp.c] = backupRestoreR;
            puzzle[rp.symR]![rp.symC] = backupRestoreSymR;
            puzzle[fp.r]![fp.c] = backupRemoveR;
            puzzle[fp.symR]![fp.symC] = backupRemoveSymR;
          }
        }
        if (candidateCount >= SudokuGenerator.LOCAL_SEARCH_CANDIDATES) break;
      }

      if (bestEval === null) break;

      puzzle[bestEval.restoreR]![bestEval.restoreC] = solution[bestEval.restoreR]![bestEval.restoreC]!;
      puzzle[bestEval.restoreSymR]![bestEval.restoreSymC] = solution[bestEval.restoreSymR]![bestEval.restoreSymC]!;
      puzzle[bestEval.removeR]![bestEval.removeC] = 0;
      puzzle[bestEval.removeSymR]![bestEval.removeSymC] = 0;

      currentDistance = bestDist;
      improved = true;

      if (currentDistance === 0) break;
    }

    if (!improved) return null;

    return { puzzle, analysis: lastAnalysis };
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

      // Build scored candidate list (single pass, single array)
      let candidates: Array<{
        row: number; col: number; symRow: number; symCol: number;
        box1: number; box2: number; score: number;
      }> = [];

      for (const [r, c] of positions) {
        if (puzzle[r]![c] === 0) continue;

        const symR = this.size - 1 - r;
        const symC = this.size - 1 - c;
        const b1 = getBoxIndex(r, c);
        const b2 = getBoxIndex(symR, symC);

        if (
          rowRemoved[r]! >= maxPerRow ||
          colRemoved[c]! >= maxPerCol ||
          boxRemoved[b1]! >= maxPerBox ||
          rowRemoved[symR]! >= maxPerRow ||
          colRemoved[symC]! >= maxPerCol ||
          boxRemoved[b2]! >= maxPerBox
        ) {
          continue;
        }

        const balanceScore = (
          (this.size - rowRemoved[r]!) +
          (this.size - colRemoved[c]!) +
          (this.size - boxRemoved[b1]!) +
          (this.size - rowRemoved[symR]!) +
          (this.size - colRemoved[symC]!) +
          (this.size - boxRemoved[b2]!)
        ) / (6 * this.size);

        const emptyNeighbors =
          this.countEmptyNeighbors(puzzle, r, c) +
          this.countEmptyNeighbors(puzzle, symR, symC);
        const sparsityPenalty = emptyNeighbors * 0.15;

        candidates.push({
          row: r, col: c, symRow: symR, symCol: symC,
          box1: b1, box2: b2,
          score: balanceScore - sparsityPenalty,
        });
      }

      // ── Predictor re-ranking (Stage 1 + Stage 2 + normalized blend) ────
      if (this.usePredictor) {
        SudokuGenerator.ensurePredictorInitialized();
        const beforeMap = buildCandidateMap(puzzle, this.size, this.boxSize);
        const ctx: PredictorContextData = {
          board: puzzle,
          size: this.size,
          boxSize: this.boxSize,
          beforeCandidateMap: beforeMap,
        };
        const predictorCandidates: RemovalCandidate[] = candidates.map((c) => ({
          row: c.row, col: c.col, symRow: c.symRow, symCol: c.symCol,
          box1: c.box1, box2: c.box2, balanceScore: c.score,
          predictorScore: 0, finalScore: 0,
        }));
        const scored = evaluateCandidates(ctx, predictorCandidates, this.difficulty);

        const predScores = scored.map((c) => c.predictorScore);
        const minPred = Math.min(...predScores);
        const maxPred = Math.max(...predScores);
        const pRange = maxPred - minPred || 1;
        const lambda = getLambda(this.difficulty);

        candidates = scored.map((c) => ({
          row: c.row, col: c.col, symRow: c.symRow, symCol: c.symCol,
          box1: c.box1, box2: c.box2,
          score: c.balanceScore + lambda * ((c.predictorScore - minPred) / pRange),
        }));
        candidates.sort((a, b) => b.score - a.score);
      } else {
        candidates.sort((a, b) => b.score - a.score);
      }

      const remaining = targetRemoval - removed;
      let guidedSucceeded = false;

      if (this.useGuidedRemoval && remaining <= SudokuGenerator.GUIDED_REMOVAL_THRESHOLD && candidates.length > 0) {
        const picked = this.guidedRemovalStep(candidates, puzzle, this.usePredictor, this.usePredictorAwareBudget);
        if (picked !== null) {
          guidedSucceeded = true;
          removed += picked.delta;
          consecutiveFailures = 0;

          rowRemoved[picked.row]!++;
          colRemoved[picked.col]!++;
          boxRemoved[picked.box1]!++;

          if (picked.row !== picked.symRow || picked.col !== picked.symCol) {
            rowRemoved[picked.symRow]!++;
            colRemoved[picked.symCol]!++;
            boxRemoved[picked.box2]!++;
          }
        }
      }

      if (!guidedSucceeded) {
        for (const { row, col, symRow, symCol, box1, box2 } of candidates) {
          if (removed >= targetRemoval || consecutiveFailures >= maxConsecutiveFailures) break;
          if (puzzle[row]![col] === 0) continue;

          const backup1 = puzzle[row]![col]!;
          const backup2 = puzzle[symRow]![symCol]!;

          puzzle[row]![col] = 0;
          puzzle[symRow]![symCol] = 0;

          if (this.verifyUniqueness(puzzle)) {
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
    }

  }

  private verifyUniqueness(puzzle: number[][]): boolean {
    return hasUniqueSolution(puzzle, this.size, this.boxSize);
  }

  private countEmptyNeighbors(puzzle: number[][], row: number, col: number): number {
    let count = 0;
    if (row > 0 && puzzle[row - 1]![col] === 0) count++;
    if (row < this.size - 1 && puzzle[row + 1]![col] === 0) count++;
    if (col > 0 && puzzle[row]![col - 1] === 0) count++;
    if (col < this.size - 1 && puzzle[row]![col + 1] === 0) count++;
    return count;
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
      const j = Math.floor(this.rng() * (i + 1));
      const temp = shuffled[i];
      shuffled[i] = shuffled[j]!;
      shuffled[j] = temp!;
    }
    return shuffled;
  }
}
