import type { AnyDifficulty } from "../../../shared/types/api";
import type { GridSize, RngFn } from "../types";
import { chooseWeighted } from "../SeedManager";
import { SudokuGenerator, type GeneratedPuzzle } from "../../core/SudokuGenerator";

const DIFFICULTY_WEIGHTS_9X9: Array<{ difficulty: AnyDifficulty; weight: number }> = [
  { difficulty: "easy", weight: 0.40 },
  { difficulty: "medium", weight: 0.30 },
  { difficulty: "hard", weight: 0.20 },
  { difficulty: "expert", weight: 0.10 },
];

const DIFFICULTY_WEIGHTS_4X4: Array<{ difficulty: AnyDifficulty; weight: number }> = [
  { difficulty: "beginner", weight: 0.60 },
  { difficulty: "advanced", weight: 0.40 },
];

export function pickDifficulty(size: GridSize, rng: RngFn): AnyDifficulty {
  const weights = size === 4 ? DIFFICULTY_WEIGHTS_4X4 : DIFFICULTY_WEIGHTS_9X9;
  return chooseWeighted(
    rng,
    weights.map((w) => w.difficulty),
    weights.map((w) => w.weight),
  );
}

export function generatePuzzle(size: GridSize, difficulty: AnyDifficulty, rng: RngFn): GeneratedPuzzle {
  const boxSize = size === 4 ? 2 : 3;
  const generator = new SudokuGenerator({
    size,
    boxSize,
    difficulty,
    rng,
    maxAttempts: size === 9 ? 50 : 1,
    matchDifficulty: size === 9,
  });
  return generator.generate();
}

export function generateRandomPuzzle(size: GridSize, rng: RngFn): GeneratedPuzzle {
  const difficulty = pickDifficulty(size, rng);
  return generatePuzzle(size, difficulty, rng);
}
