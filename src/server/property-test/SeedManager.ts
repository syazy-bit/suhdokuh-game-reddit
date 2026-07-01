import type { RngFn, GridSize } from "./types";

export function createRng(seed: number): RngFn {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

export function forkRng(globalSeed: number, groupName: string, size: GridSize, iteration: number): RngFn {
  const groupHash = hashString(groupName);
  const combined = (globalSeed + groupHash * 31 + size * 997 + iteration * 7919) >>> 0;
  return createRng(combined || 1);
}

export function chooseWeighted<T>(rng: RngFn, items: T[], weights: number[]): T {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    const w = weights[i]!;
    r -= w;
    if (r <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}
