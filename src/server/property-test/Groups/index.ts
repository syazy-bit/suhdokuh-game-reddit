import type { PropertyGroup } from "../types";
import { candidateMaskGroup } from "./CandidateMaskProperties";
import { peerCacheGroup } from "./PeerCacheProperties";
import { puzzleGeneratorGroup } from "./PuzzleGeneratorProperties";
import { boardGroup } from "./BoardProperties";

export const allGroups: PropertyGroup[] = [
  candidateMaskGroup,
  peerCacheGroup,
  puzzleGeneratorGroup,
  boardGroup,
];

export { candidateMaskGroup } from "./CandidateMaskProperties";
export { peerCacheGroup } from "./PeerCacheProperties";
export { puzzleGeneratorGroup } from "./PuzzleGeneratorProperties";
export { boardGroup } from "./BoardProperties";
