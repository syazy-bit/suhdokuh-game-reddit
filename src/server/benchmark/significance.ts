export interface MannWhitneyUResult {
  UStatistic: number;
  pValue: number;
  n1: number;
  n2: number;
}

export interface WelchTTestResult {
  tStat: number;
  df: number;
  pValue: number;
}

export interface CohenDResult {
  d: number;
  interpretation: "negligible" | "small" | "medium" | "large";
}

export interface ConfidenceIntervalResult {
  lower: number;
  upper: number;
  mean: number;
  margin: number;
  confidence: number;
}

// ── Normal CDF (Abramowitz & Stegun 26.2.17) ────────────────────────────────

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return 0.5 * (1 + sign * (y - 0.5) * 2);
}

// ── Log Gamma (Lanczos approximation) ────────────────────────────────────────

function logGamma(z: number): number {
  const g = 7;
  const c: number[] = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];

  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }

  z -= 1;
  let x = c[0]!;
  for (let i = 1; i < g + 2; i++) {
    x += c[i]! / (z + i);
  }

  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

// ── Regularized Incomplete Beta Function (Lentz's continued fraction) ────────

function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x < 0 || x > 1) return NaN;
  if (x === 0 || x === 1) return x;

  // Use symmetry for numerical stability
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - regularizedIncompleteBeta(b, a, 1 - x);
  }

  const lbeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta - Math.log(a));

  // Lentz's continued fraction (modified)
  const MAX_ITER = 200;
  const TINY = 1e-30;
  const EPSILON = 3e-12;

  let f = 1.0;
  let c = 1.0;
  let d = 1.0 - ((a + b) * x) / (a + 1);

  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  f = d;

  for (let m = 1; m <= MAX_ITER; m++) {
    let numerator: number;

    // Even step
    const evenM = 2 * m;
    numerator = (m * (b - m) * x) / ((a + evenM - 1) * (a + evenM));
    c = 1 + numerator / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 + numerator * d;
    if (Math.abs(d) < TINY) d = TINY;
    d = 1 / d;
    f *= c * d;

    // Odd step
    const oddM = 2 * m + 1;
    numerator = -((a + m) * (a + b + m) * x) / ((a + oddM - 1) * (a + oddM));
    c = 1 + numerator / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 + numerator * d;
    if (Math.abs(d) < TINY) d = TINY;
    d = 1 / d;
    const delta = c * d;
    f *= delta;

    if (Math.abs(delta - 1) < EPSILON) {
      break;
    }
  }

  return front * f;
}

// ── t-distribution CDF ───────────────────────────────────────────────────────

function tDistributionCDF(t: number, df: number): number {
  if (df <= 0) return NaN;
  if (df !== Math.floor(df)) {
    // For fractional df (Welch-Satterthwaite), use the general formula
    const x = df / (df + t * t);
    const p = 1 - 0.5 * regularizedIncompleteBeta(df / 2, 0.5, x);
    return t >= 0 ? p : 1 - p;
  }

  // Integer df: use the standard beta ratio
  const x = df / (df + t * t);
  const p = 1 - 0.5 * regularizedIncompleteBeta(df / 2, 0.5, x);
  return t >= 0 ? p : 1 - p;
}

// ── Two-tailed p-value from t-distribution ───────────────────────────────────

function twoTailTTest(t: number, df: number): number {
  const cdf = tDistributionCDF(Math.abs(t), df);
  return 2 * (1 - cdf);
}

// ── Mann-Whitney U Test ─────────────────────────────────────────────────────

export function mannWhitneyU(a: number[], b: number[]): MannWhitneyUResult {
  const n1 = a.length;
  const n2 = b.length;

  if (n1 === 0 || n2 === 0) {
    return { UStatistic: NaN, pValue: NaN, n1, n2 };
  }

  // Combine, sort, and rank
  const combined: Array<{ value: number; group: 0 | 1 }> = [];
  for (let idx = 0; idx < n1; idx++) {
    combined.push({ value: a[idx]!, group: 0 });
  }
  for (let idx = 0; idx < n2; idx++) {
    combined.push({ value: b[idx]!, group: 1 });
  }

  combined.sort((x, y) => x.value - y.value);

  // Assign ranks with tie correction
  let rankSum1 = 0;
  let tieCorrection = 0;
  let pos = 0;
  const N = n1 + n2;

  while (pos < N) {
    let j = pos;
    while (j < N - 1 && combined[j + 1]!.value === combined[pos]!.value) {
      j++;
    }
    const tieCount = j - pos + 1;
    const averageRank = pos + (tieCount + 1) / 2;

    if (tieCount > 1) {
      tieCorrection += tieCount * tieCount * tieCount - tieCount;
    }

    for (let k = pos; k <= j; k++) {
      if (combined[k]!.group === 0) {
        rankSum1 += averageRank;
      }
    }

    pos = j + 1;
  }

  const U1 = rankSum1 - (n1 * (n1 + 1)) / 2;
  const U2 = n1 * n2 - U1;
  const UStatistic = Math.min(U1, U2);

  // Normal approximation (valid for n1, n2 >= 8 or total >= 20)
  const muU = (n1 * n2) / 2;
  const variance = (n1 * n2 / 12) * (N + 1 - tieCorrection / (N * (N - 1)));
  const sigmaU = Math.sqrt(variance);

  if (sigmaU === 0) {
    return { UStatistic, pValue: 1, n1, n2 };
  }

  // Continuity correction
  const z = (UStatistic - muU - 0.5 * Math.sign(muU - UStatistic)) / sigmaU;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  return { UStatistic, pValue: Math.min(1, Math.max(0, pValue)), n1, n2 };
}

// ── Welch t-test ────────────────────────────────────────────────────────────

export function welchTTest(a: number[], b: number[]): WelchTTestResult {
  const n1 = a.length;
  const n2 = b.length;

  if (n1 < 2 || n2 < 2) {
    return { tStat: NaN, df: NaN, pValue: NaN };
  }

  const mean1 = a.reduce((s, v) => s + v, 0) / n1;
  const mean2 = b.reduce((s, v) => s + v, 0) / n2;

  const var1 = a.reduce((s, v) => s + (v - mean1) ** 2, 0) / (n1 - 1);
  const var2 = b.reduce((s, v) => s + (v - mean2) ** 2, 0) / (n2 - 1);

  const se1 = var1 / n1;
  const se2 = var2 / n2;
  const se = Math.sqrt(se1 + se2);

  if (se === 0) {
    // Both groups have zero variance
    const pValue = Math.abs(mean1 - mean2) < 1e-15 ? 1 : 0;
    const tStat = Math.abs(mean1 - mean2) < 1e-15 ? 0 : (mean1 > mean2 ? Infinity : -Infinity);
    return { tStat, df: NaN, pValue };
  }

  const tStat = (mean1 - mean2) / se;

  // Welch-Satterthwaite df
  const num = (se1 + se2) ** 2;
  const denom = (se1 * se1) / (n1 - 1) + (se2 * se2) / (n2 - 1);
  const df = denom > 0 ? num / denom : 0;

  if (df <= 0) {
    return { tStat: NaN, df: NaN, pValue: NaN };
  }

  const pValue = twoTailTTest(tStat, df);

  return { tStat, df, pValue: Math.min(1, Math.max(0, pValue)) };
}

// ── Cohen's d ───────────────────────────────────────────────────────────────

export function cohensD(a: number[], b: number[]): CohenDResult {
  const n1 = a.length;
  const n2 = b.length;

  if (n1 < 2 || n2 < 2) {
    return { d: NaN, interpretation: "negligible" };
  }

  const mean1 = a.reduce((s, v) => s + v, 0) / n1;
  const mean2 = b.reduce((s, v) => s + v, 0) / n2;

  const var1 = a.reduce((s, v) => s + (v - mean1) ** 2, 0) / (n1 - 1);
  const var2 = b.reduce((s, v) => s + (v - mean2) ** 2, 0) / (n2 - 1);

  // Pooled standard deviation
  const pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
  const pooledSd = Math.sqrt(pooledVar);

  if (pooledSd === 0) {
    return { d: 0, interpretation: "negligible" };
  }

  const d = (mean1 - mean2) / pooledSd;

  let interpretation: CohenDResult["interpretation"];
  const absD = Math.abs(d);
  if (absD < 0.2) {
    interpretation = "negligible";
  } else if (absD < 0.5) {
    interpretation = "small";
  } else if (absD < 0.8) {
    interpretation = "medium";
  } else {
    interpretation = "large";
  }

  return { d, interpretation };
}

// ── Confidence Interval for the Mean ────────────────────────────────────────

export function confidenceInterval(
  samples: number[],
  confidence: number = 0.95,
): ConfidenceIntervalResult {
  const n = samples.length;

  if (n < 2) {
    return {
      lower: NaN,
      upper: NaN,
      mean: n === 1 ? samples[0]! : NaN,
      margin: NaN,
      confidence,
    };
  }

  const mean = samples.reduce((s, v) => s + v, 0) / n;
  const variance = samples.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const stddev = Math.sqrt(variance);
  const se = stddev / Math.sqrt(n);

  // Critical t-value for the given confidence level
  const alpha = 1 - confidence;
  const df = n - 1;
  const tCritical = tInverseCDF(1 - alpha / 2, df);

  const margin = tCritical * se;

  return {
    lower: mean - margin,
    upper: mean + margin,
    mean,
    margin,
    confidence,
  };
}

// ── t-distribution Inverse CDF (for confidence intervals) ───────────────────

function tInverseCDF(p: number, df: number): number {
  if (p <= 0 || p >= 1 || df <= 0) return NaN;

  // Rational approximation for p near 0.5
  // For extreme p values, use normal approximation as starting point
  const z = normalInverseCDF(p);

  // Newton-Raphson refinement
  let t = z;
  const MAX_ITER = 50;
  const TOL = 1e-12;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const cdf = tDistributionCDF(t, df);
    const diff = cdf - p;

    // Derivative = t-distribution PDF
    const pdf = Math.exp(
      logGamma((df + 1) / 2) - logGamma(df / 2) - 0.5 * Math.log(df * Math.PI)
      - ((df + 1) / 2) * Math.log(1 + (t * t) / df),
    );

    if (Math.abs(diff) < TOL) break;
    if (Math.abs(pdf) < 1e-300) break;

    t -= diff / pdf;
  }

  return t;
}

// ── Normal Inverse CDF (RSA algorithm) ──────────────────────────────────────

function normalInverseCDF(p: number): number {
  if (p <= 0 || p >= 1) return NaN;

  // Rational approximation — typed as number[] to avoid tuple index issues
  // Use `as const` for tuple typing so indexed access returns the element type, not `| undefined`
  const a = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.383577518672690e2,
    -3.066479806614716e1,
    2.506628277459239,
  ] as const;
  const b = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1,
  ] as const;
  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ] as const;
  const d = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996,
    3.754408661907416,
  ] as const;

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let z: number;

  if (p < pLow) {
    // Lower tail
    const q = Math.sqrt(-2 * Math.log(p));
    z = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    // Central region
    const q = p - 0.5;
    const r = q * q;
    z = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
      / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    // Upper tail
    const q = Math.sqrt(-2 * Math.log(1 - p));
    z = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  return z;
}
