import type { PropertyGroup } from "../types";
import { candidateMaskGroup } from "./CandidateMaskProperties";
import { peerCacheGroup } from "./PeerCacheProperties";
import { puzzleGeneratorGroup } from "./PuzzleGeneratorProperties";
import { boardGroup } from "./BoardProperties";
import { solverGroup } from "./SolverProperties";
import { candidateEngineGroup } from "./CandidateEngineProperties";
import { difficultyAnalyzerGroup } from "./DifficultyAnalyzerProperties";
import { difficultyPredictorGroup } from "./DifficultyPredictorProperties";
import { hintEngineGroup } from "./HintEngineProperties";

export const allGroups: PropertyGroup[] = [
  candidateMaskGroup,
  peerCacheGroup,
  puzzleGeneratorGroup,
  boardGroup,
  solverGroup,
  candidateEngineGroup,
  difficultyAnalyzerGroup,
  difficultyPredictorGroup,
  hintEngineGroup,
];

export { candidateMaskGroup } from "./CandidateMaskProperties";
export { peerCacheGroup } from "./PeerCacheProperties";
export { puzzleGeneratorGroup } from "./PuzzleGeneratorProperties";
export { boardGroup } from "./BoardProperties";
export { solverGroup } from "./SolverProperties";
export { candidateEngineGroup } from "./CandidateEngineProperties";
export { difficultyAnalyzerGroup } from "./DifficultyAnalyzerProperties";
export { difficultyPredictorGroup } from "./DifficultyPredictorProperties";
export { hintEngineGroup } from "./HintEngineProperties";
