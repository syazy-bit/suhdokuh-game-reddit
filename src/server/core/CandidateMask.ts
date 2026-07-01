const POPCOUNT = new Uint8Array(512);
for (let i = 0; i < 512; i++) {
  let x = i;
  while (x) { POPCOUNT[i]!++; x &= x - 1; }
}

function popcount(x: number): number {
  return POPCOUNT[x & 0x1FF] ?? 0;
}

export function hasCandidate(mask: number, value: number): boolean {
  return (mask & (1 << (value - 1))) !== 0;
}

export function addCandidate(mask: number, value: number): number {
  return mask | (1 << (value - 1));
}

export function removeCandidate(mask: number, value: number): number {
  return mask & ~(1 << (value - 1));
}

export function candidateCount(mask: number): number {
  return popcount(mask);
}

export function iterateCandidates(mask: number, callback: (value: number) => void): void {
  while (mask) {
    const lsb = mask & -mask;
    callback(popcount(lsb - 1) + 1);
    mask ^= lsb;
  }
}

export function firstCandidate(mask: number): number | null {
  if (mask === 0) return null;
  const lsb = mask & -mask;
  return popcount(lsb - 1) + 1;
}

export function candidateKey(mask: number): string {
  const parts: string[] = [];
  iterateCandidates(mask, (v) => parts.push(String(v)));
  return parts.join(",");
}

export function hasIntersection(mask: number, pattern: number): boolean {
  return (mask & pattern) !== 0;
}

export function maskFromValues(values: number[]): number {
  let mask = 0;
  for (const v of values) {
    mask |= 1 << (v - 1);
  }
  return mask;
}

export function toArray(mask: number): number[] {
  const result: number[] = [];
  iterateCandidates(mask, (v) => result.push(v));
  return result;
}

export function maskSize(mask: number): number {
  return popcount(mask);
}

export function intersectionCount(mask: number, pattern: number): number {
  return popcount(mask & pattern);
}
