#!/usr/bin/env tsx
/**
 * calibratePredictor.ts — Developer-only tool
 * =============================================
 *
 * Runs offline to compute suggested calibrated coefficients for the
 * Stage 2 predictor features via linear regression against actual
 * HumanSolver score deltas.
 *
 * Usage: npx tsx scripts/calibratePredictor.ts
 *
 * This file is NOT imported anywhere in production.
 * It does NOT run automatically.
 * It does NOT affect builds or tests.
 */

import type { AnyDifficulty } from "../src/shared/types/api";
import type { GridSize } from "../src/server/core/SudokuValidator";
import { SudokuGenerator } from "../src/server/core/SudokuGenerator";
import { solve } from "../src/server/core/HumanSolverPipeline";
import { analyzeSolveResult } from "../src/server/core/DifficultyAnalyzer";
import { evaluateCandidates, registerDefaultFeatures } from "../src/server/core/predictor/index";
import { buildCandidateMap } from "../src/server/core/CandidateEngine";
import { hasUniqueSolution } from "../src/server/core/SudokuSolver";
import { FEATURE_WEIGHTS, CALIBRATED_COEFFICIENTS } from "../src/server/core/predictor/PredictorWeights";
import type { RemovalCandidate, PredictorContextData } from "../src/server/core/predictor/types";

// ── Configuration ──────────────────────────────────────────────────────────

const SAMPLES_PER_DIFFICULTY = 20;
const DIFFICULTIES: AnyDifficulty[] = ["easy", "medium", "hard", "expert"];
const GRID_SIZE: GridSize = 9;

// ── Feature names (keys in FEATURE_WEIGHTS) ─────────────────────────────────

const FEATURE_NAMES = Object.keys(FEATURE_WEIGHTS);

// ── Data point collected during generation ──────────────────────────────────

interface TrainingDatum {
  difficulty: AnyDifficulty;
  featureVector: number[];
  actualDelta: number;
  label: string;
}

// ── Main ────────────────────────────────────────────────────────────────────

function main(): number {
  registerDefaultFeatures();

  const allData: TrainingDatum[] = [];
  let puzzlesGenerated = 0;

  for (const difficulty of DIFFICULTIES) {
    console.log(`\nCollecting data for ${difficulty}...`);

    for (let i = 0; i < SAMPLES_PER_DIFFICULTY; i++) {
      const generator = new SudokuGenerator({
        size: GRID_SIZE,
        boxSize: 3,
        difficulty,
        maxAttempts: 10,
        useGuidedRemoval: true,
        usePredictor: false,
      });

      const result = generator.generate();

      // Collect training data: for each guided removal step,
      // record the feature vector and the actual delta.
      const puzzle = result.puzzle;
      const solution = result.solution;

      // Build a full board from the solution, then iteratively
      // remove cells and record feature + delta pairs.
      const board: number[][] = solution.map((r) => [...r]);

      // Determine which cells were removed (clue = 0 in puzzle, != 0 in solution)
      const removedCells: Array<{ row: number; col: number }> = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (puzzle[r]![c]! === 0) {
            removedCells.push({ row: r, col: c });
          }
        }
      }

      // Process each removal in reverse order (last removed first)
      // to build up the board state before each removal.
      for (let ri = removedCells.length - 1; ri >= 0; ri--) {
        const { row, col } = removedCells[ri]!;

        // Compute current score (board state BEFORE this removal)
        const currentSolveResult = solve(board);
        if (!currentSolveResult.solved) continue;
        const currentScore = analyzeSolveResult(currentSolveResult).score;

        // Remove the cell
        board[row]![col] = 0;
        // For simplicity, we don't handle symmetry here (calibration
        // focuses on individual cell removals).

        // Verify uniqueness
        if (!hasUniqueSolution(board, GRID_SIZE, 3)) {
          board[row]![col] = solution[row]![col]!; // restore
          continue;
        }

        // Compute actual score after removal
        const afterSolveResult = solve(board);
        if (!afterSolveResult.solved) {
          board[row]![col] = solution[row]![col]!; // restore
          continue;
        }
        const afterScore = analyzeSolveResult(afterSolveResult).score;
        const actualDelta = afterScore - currentScore;

        // ── Compute Stage 2 feature vector ──────────────────────────
        // Build a PredictorContextData from the current board state
        // (after removal, since that's what we're evaluating).
        const beforeMap = buildCandidateMap(board, GRID_SIZE, 3);
        const ctx: PredictorContextData = {
          board,
          size: GRID_SIZE,
          boxSize: 3,
          beforeCandidateMap: beforeMap,
        };

        const candidate: RemovalCandidate = {
          row,
          col,
          symRow: row,
          symCol: col,
          box1: 0,
          box2: 0,
          balanceScore: 0,
          predictorScore: 0,
          finalScore: 0,
        };

        const scored = evaluateCandidates(ctx, [candidate], difficulty);
        if (scored.length === 0) {
          board[row]![col] = solution[row]![col]!; // restore
          continue;
        }

        const featureVector: number[] = [];
        // TODO: extract per-feature raw values.
        // Currently evaluateCandidates returns only the blended score.
        // A dedicated "getRawFeatureVector" export is needed for
        // proper calibration.  For now featureVector is populated
        // with a single placeholder value (predictorScore).
        featureVector.push(scored[0]!.predictorScore);

        allData.push({
          difficulty,
          featureVector,
          actualDelta,
          label: `${difficulty} (${row},${col})`,
        });

        // Don't restore — keep the cell removed for the next iteration
        // (previous removal in reverse order).
      }

      puzzlesGenerated++;
      if ((i + 1) % 5 === 0) {
        console.log(`  ${i + 1}/${SAMPLES_PER_DIFFICULTY} puzzles processed`);
      }
    }
  }

  // ── Summary & regression ──────────────────────────────────────────────────

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Collected ${allData.length} training data points across ${puzzlesGenerated} puzzles`);
  console.log(`${"=".repeat(60)}`);

  if (allData.length === 0) {
    console.log("No data collected — check puzzle generation and solver logic.");
    return 1;
  }

  // Per-difficulty stats
  for (const difficulty of DIFFICULTIES) {
    const subset = allData.filter((d) => d.difficulty === difficulty);
    if (subset.length === 0) continue;
    const deltas = subset.map((d) => d.actualDelta);
    const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const min = Math.min(...deltas);
    const max = Math.max(...deltas);
    console.log(`\n${difficulty}: ${subset.length} points, avg delta=${avg.toFixed(2)}, range=[${min.toFixed(1)}, ${max.toFixed(1)}]`);
  }

  // ── TODO: linear regression ───────────────────────────────────────────────
  //
  // Once per-feature raw values are available, perform ordinary least-squares
  // regression to fit coefficients that minimise ||Xβ - y||² where:
  //
  //   X — n×k matrix of raw Stage 2 feature values (n data points, k features)
  //   y — vector of actual HumanSolver deltas
  //   β — coefficient vector to solve for
  //
  // Implementation sketch:
  //
  //   import { solveLinearRegression } from "./regression";   // not yet created
  //
  //   const X: number[][] = allData.map((d) => d.featureVector);
  //   const y: number[]   = allData.map((d) => d.actualDelta);
  //   const coefficients = solveLinearRegression(X, y);
  //
  //   console.log("\nSuggested CALIBRATED_COEFFICIENTS:");
  //   for (let i = 0; i < FEATURE_NAMES.length; i++) {
  //     console.log(`  ${FEATURE_NAMES[i]}: ${coefficients[i]?.toFixed(4)}`);
  //   }
  //
  // For now, print the current heuristic coefficients as a reference.

  console.log(`\nCurrent heuristics (from FEATURE_WEIGHTS):`);
  for (const name of FEATURE_NAMES) {
    const w = FEATURE_WEIGHTS[name];
    if (w !== undefined) {
      console.log(`  ${name}: ${w}`);
    }
  }

  console.log(`\nCurrent CALIBRATED_COEFFICIENTS (copy of heuristics):`);
  for (const name of FEATURE_NAMES) {
    const c = CALIBRATED_COEFFICIENTS[name];
    if (c !== undefined) {
      console.log(`  ${name}: ${c}`);
    }
  }

  console.log(`\nDone.  To enable regression, replace the placeholder above`);
  console.log(`with a call to your preferred linear algebra library.`);

  return 0;
}

process.exit(main());
