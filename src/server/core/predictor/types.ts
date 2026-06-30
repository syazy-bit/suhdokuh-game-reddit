import type { GridSize } from "../SudokuValidator";
import type { AnyDifficulty } from "../../../shared/types/api";

export interface RemovalCandidate {
  row: number;
  col: number;
  symRow: number;
  symCol: number;
  box1: number;
  box2: number;
  balanceScore: number;
  predictorScore: number;
  finalScore: number;
}

export interface PredictorContextData {
  board: number[][];
  size: GridSize;
  boxSize: number;
  beforeCandidateMap: number[][][];
}

export interface Stage1FilterDefinition {
  name: string;
  enabledForDifficulty: (difficulty: AnyDifficulty) => boolean;
  filter: (ctx: PredictorContextData, candidate: RemovalCandidate) => boolean;
}

export interface Stage2FeatureDefinition {
  name: string;
  enabledForDifficulty: (difficulty: AnyDifficulty) => boolean;
  compute: (ctx: PredictorContextData, candidate: RemovalCandidate) => number;
}

export interface EligibleCandidate {
  candidate: RemovalCandidate;
  distance: number;
  predictedDelta: number;
}
