import { toArray } from "./CandidateMask";

export type CandidateMaskMap = number[][];

export function maskMapToArrayMap(maskMap: CandidateMaskMap, size: number): number[][][] {
  const result: number[][][] = [];
  for (let r = 0; r < size; r++) {
    result[r] = [];
    for (let c = 0; c < size; c++) {
      result[r]![c] = toArray(maskMap[r]![c]!);
    }
  }
  return result;
}
