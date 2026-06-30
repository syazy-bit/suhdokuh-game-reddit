#!/usr/bin/env tsx

import type { AnyDifficulty } from "../src/shared/types/api";
import type { GridSize } from "../src/server/core/SudokuValidator";
import { SudokuGenerator } from "../src/server/core/SudokuGenerator";
import { solve } from "../src/server/core/HumanSolverPipeline";
import { analyzeSolveResult } from "../src/server/core/DifficultyAnalyzer";
import { registerDefaultFeatures, getStage2Features } from "../src/server/core/predictor/FeatureRegistry";
import { buildCandidateMap } from "../src/server/core/CandidateEngine";
import { hasUniqueSolution } from "../src/server/core/SudokuSolver";
import { getStage1Filters } from "../src/server/core/predictor/FeatureRegistry";
import type { RemovalCandidate, PredictorContextData } from "../src/server/core/predictor/types";
import * as fs from "node:fs";
import * as path from "node:path";

const SAMPLES_PER_DIFFICULTY = 50;
const HOLDOUT_FRAC = 0.2;
const DIFFICULTIES: AnyDifficulty[] = ["easy", "medium", "hard", "expert"];
const GRID_SIZE: GridSize = 9;
const MAX_ATTEMPTS = 50;
const SEED = 42;

export interface CalibrationSample {
  difficulty: AnyDifficulty;
  featureNames: string[];
  featureVector: number[];
  actualDelta: number;
  currentScore: number;
  afterScore: number;
  targetDifficulty: AnyDifficulty;
  wasAccepted: boolean;
  removalIndex: number;
}

export interface CalibrationDataset {
  seed: number;
  generated: string;
  config: {
    samplesPerDifficulty: number;
    difficulties: AnyDifficulty[];
    gridSize: GridSize;
  };
  difficultyOrder: AnyDifficulty[];
  featureNames: string[];
  samples: CalibrationSample[];
}

function seededShuffle<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }
  return shuffled;
}

function main(): number {
  registerDefaultFeatures();

  const stage2Features = getStage2Features();
  const featureNames = stage2Features.map((f) => f.name);

  const allSamples: CalibrationSample[] = [];

  for (const difficulty of DIFFICULTIES) {
    console.log(`\nCollecting data for ${difficulty}...`);

    for (let i = 0; i < SAMPLES_PER_DIFFICULTY; i++) {
      const puzzleSeed = SEED + DIFFICULTIES.indexOf(difficulty) * 10000 + i;

      let puzzle: number[][];
      let solution: number[][];
      try {
        const gen = new SudokuGenerator({
          size: GRID_SIZE,
          boxSize: 3,
          difficulty,
          maxAttempts: MAX_ATTEMPTS,
          useGuidedRemoval: true,
          usePredictor: false,
        });
        const result = gen.generate();
        puzzle = result.puzzle;
        solution = result.solution;
      } catch {
        console.log(`  Puzzle ${i + 1}/${SAMPLES_PER_DIFFICULTY} generation failed, skipping`);
        continue;
      }

      const board: number[][] = solution.map((r) => [...r]);

      const removedCells: Array<{ row: number; col: number; symRow: number; symCol: number }> = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (puzzle[r]![c]! === 0) {
            const symR = GRID_SIZE - 1 - r;
            const symC = GRID_SIZE - 1 - c;
            removedCells.push({ row: r, col: c, symRow: symR, symCol: symC });
          }
        }
      }

      const shuffledCells = seededShuffle(removedCells, puzzleSeed);
      if (shuffledCells.length === 0) {
        console.log(`  Puzzle ${i + 1}/${SAMPLES_PER_DIFFICULTY} has no removed cells, skipping`);
        continue;
      }

      for (let ri = 0; ri < shuffledCells.length; ri++) {
        const { row, col, symRow, symCol } = shuffledCells[ri]!;

        const currentSolveResult = solve(board);
        if (!currentSolveResult.solved) continue;
        const currentScore = analyzeSolveResult(currentSolveResult).score;

        const backup1 = board[row]![col]!;
        const isSymDiff = symRow !== row || symCol !== col;
        const backup2 = isSymDiff ? board[symRow]![symCol]! : 0;

        const beforeMap = buildCandidateMap(board, GRID_SIZE, 3);

        board[row]![col] = 0;
        if (isSymDiff) board[symRow]![symCol] = 0;

        if (!hasUniqueSolution(board, GRID_SIZE, 3)) {
          board[row]![col] = backup1;
          if (isSymDiff) board[symRow]![symCol] = backup2;
          continue;
        }

        const afterSolveResult = solve(board);
        if (!afterSolveResult.solved) {
          board[row]![col] = backup1;
          if (isSymDiff) board[symRow]![symCol] = backup2;
          continue;
        }
        const afterScore = analyzeSolveResult(afterSolveResult).score;
        const actualDelta = afterScore - currentScore;

        const accepted = (ri === 0);

        const ctx: PredictorContextData = {
          board,
          size: GRID_SIZE,
          boxSize: 3,
          beforeCandidateMap: beforeMap,
        };

        const candidate: RemovalCandidate = {
          row, col, symRow, symCol,
          box1: Math.floor(row / 3) * 3 + Math.floor(col / 3),
          box2: Math.floor(symRow / 3) * 3 + Math.floor(symCol / 3),
          balanceScore: 0,
          predictorScore: 0,
          finalScore: 0,
        };

        const stage1Filters = getStage1Filters();
        let passed = true;
        for (const filter of stage1Filters) {
          if (filter.enabledForDifficulty(difficulty)) {
            if (!filter.filter(ctx, candidate)) {
              passed = false;
              break;
            }
          }
        }

        if (!passed) {
          board[row]![col] = backup1;
          if (isSymDiff) board[symRow]![symCol] = backup2;
          continue;
        }

        const featureVector: number[] = [];
        for (const feature of stage2Features) {
          if (feature.enabledForDifficulty(difficulty)) {
            const raw = feature.compute(ctx, candidate);
            featureVector.push(raw);
          } else {
            featureVector.push(0);
          }
        }

        allSamples.push({
          difficulty,
          featureNames,
          featureVector,
          actualDelta,
          currentScore,
          afterScore,
          targetDifficulty: difficulty,
          wasAccepted: accepted,
          removalIndex: ri,
        });
      }
    }
  }

  const dataset: CalibrationDataset = {
    seed: SEED,
    generated: new Date().toISOString(),
    config: {
      samplesPerDifficulty: SAMPLES_PER_DIFFICULTY,
      difficulties: DIFFICULTIES,
      gridSize: GRID_SIZE,
    },
    difficultyOrder: [...DIFFICULTIES],
    featureNames,
    samples: allSamples,
  };

  const shuffled = seededShuffle(allSamples, SEED);
  const holdoutCount = Math.ceil(shuffled.length * HOLDOUT_FRAC);
  const holdout = shuffled.slice(0, holdoutCount);
  const training = shuffled.slice(holdoutCount);

  const outDir = path.resolve(import.meta.dirname, "..", "data", "calibration");
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(
    path.join(outDir, "training.json"),
    JSON.stringify({ ...dataset, samples: training }, null, 2),
  );
  fs.writeFileSync(
    path.join(outDir, "holdout.json"),
    JSON.stringify({ ...dataset, samples: holdout }, null, 2),
  );

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Total samples: ${allSamples.length}`);
  console.log(`Training:      ${training.length}`);
  console.log(`Holdout:       ${holdout.length}`);
  console.log(`Feature count: ${featureNames.length}`);
  console.log(`Output:        ${outDir}`);
  console.log(`${"=".repeat(60)}`);

  return 0;
}

process.exit(main());
