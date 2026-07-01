import { maskFromValues } from "../../core/CandidateMask";
import type { GridSize, RngFn } from "../types";

export function fullMask(size: GridSize): number {
  return (1 << size) - 1;
}

export function emptyMask(): number {
  return 0;
}

export function randomMask(size: GridSize, rng: RngFn): number {
  let mask = 0;
  for (let v = 1; v <= size; v++) {
    if (rng() < 0.5) {
      mask |= 1 << (v - 1);
    }
  }
  return mask;
}

export function randomNonEmptyMask(size: GridSize, rng: RngFn): number {
  let mask = 0;
  while (mask === 0) {
    mask = randomMask(size, rng);
  }
  return mask;
}

export function randomSingleCandidateMask(size: GridSize, rng: RngFn): number {
  const value = Math.floor(rng() * size) + 1;
  return 1 << (value - 1);
}

export function randomCandidateMasks(size: GridSize, rng: RngFn, count: number): number[] {
  const masks: number[] = [];
  for (let i = 0; i < count; i++) {
    masks.push(randomMask(size, rng));
  }
  return masks;
}

export function maskWithValues(values: number[]): number {
  return maskFromValues(values);
}
