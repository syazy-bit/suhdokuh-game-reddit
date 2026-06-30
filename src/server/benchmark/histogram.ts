import type { HistogramBin } from "./result";

export function freedmanDiaconisBins(samples: number[]): number {
  const n = samples.length;
  if (n < 2) return 1;
  const sorted = [...samples].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(n * 0.25)]!;
  const q3 = sorted[Math.floor(n * 0.75)]!;
  const iqr = q3 - q1;
  const binWidth = 2 * iqr * Math.pow(n, -1 / 3);
  if (binWidth <= 0) return Math.min(20, n);
  const dataRange = sorted[n - 1]! - sorted[0]!;
  const bins = Math.ceil(dataRange / binWidth);
  return Math.max(1, Math.min(50, bins));
}

export function computeHistogram(samples: number[], binCount?: number): HistogramBin[] {
  if (samples.length === 0) return [];
  const sorted = [...samples].sort((a, b) => a - b);
  const bins = binCount ?? freedmanDiaconisBins(samples);
  const dataMin = sorted[0]!;
  const dataMax = sorted[samples.length - 1]!;
  const range = dataMax - dataMin;
  if (range === 0) {
    return [{ lower: dataMin, upper: dataMax, count: samples.length }];
  }
  const binWidth = range / bins;

  const result: HistogramBin[] = [];
  for (let i = 0; i < bins; i++) {
    const lower = dataMin + i * binWidth;
    const upper = i === bins - 1 ? dataMax : dataMin + (i + 1) * binWidth;
    const count = sorted.filter((v) => v >= lower && (i === bins - 1 ? v <= upper : v < upper)).length;
    if (count > 0) {
      result.push({ lower, upper, count });
    }
  }
  return result;
}
