export function mean(samples: number[]): number {
  if (samples.length === 0) return 0;
  return samples.reduce((a, b) => a + b, 0) / samples.length;
}

export function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const n = sorted.length;
  if (n % 2 === 1) return sorted[Math.floor(n / 2)]!;
  return (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

export function min(samples: number[]): number {
  if (samples.length === 0) return 0;
  return Math.min(...samples);
}

export function max(samples: number[]): number {
  if (samples.length === 0) return 0;
  return Math.max(...samples);
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))]!;
}

export function p90(sorted: number[]): number {
  return percentile(sorted, 90);
}

export function p95(sorted: number[]): number {
  return percentile(sorted, 95);
}

export function stddev(samples: number[], avg: number): number {
  if (samples.length < 2) return 0;
  const squaredDiffs = samples.map((s) => (s - avg) ** 2);
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (samples.length - 1));
}
