import type { ModeResult, MetricStats } from "./result";
import { mean, median, min, max, p90, p95, stddev } from "./statistics";
import { computeHistogram } from "./histogram";

interface PuzzleRecord {
  score: number;
  clueCount: number;
  difficultyMatch: boolean;
  success: boolean;
}

interface MetricCollection {
  timeSamples: Map<string, number[]>;
  counterSamples: Map<string, number[]>;
  puzzles: PuzzleRecord[];
}

export class BenchmarkCollector {
  private currentTimers = new Map<string, number[]>();
  private currentCounters = new Map<string, number>();
  private collection: MetricCollection = {
    timeSamples: new Map(),
    counterSamples: new Map(),
    puzzles: [],
  };

  clear(): void {
    this.currentTimers.clear();
    this.currentCounters.clear();
    this.collection = {
      timeSamples: new Map(),
      counterSamples: new Map(),
      puzzles: [],
    };
  }

  startPuzzle(): void {
    this.currentTimers.clear();
    this.currentCounters.clear();
  }

  recordTime(label: string, durationMs: number): void {
    let arr = this.currentTimers.get(label);
    if (!arr) {
      arr = [];
      this.currentTimers.set(label, arr);
    }
    arr.push(durationMs);
  }

  incrementCounter(label: string): void {
    this.currentCounters.set(label, (this.currentCounters.get(label) ?? 0) + 1);
  }

  getCurrentCounter(label: string): number {
    return this.currentCounters.get(label) ?? 0;
  }

  finishPuzzle(score: number, clueCount: number, difficultyMatch: boolean): void {
    for (const [label, samples] of this.currentTimers) {
      let batch = this.collection.timeSamples.get(label);
      if (!batch) {
        batch = [];
        this.collection.timeSamples.set(label, batch);
      }
      batch.push(...samples);
    }
    for (const [label, count] of this.currentCounters) {
      let arr = this.collection.counterSamples.get(label);
      if (!arr) {
        arr = [];
        this.collection.counterSamples.set(label, arr);
      }
      arr.push(count);
    }
    this.collection.puzzles.push({
      score,
      clueCount,
      difficultyMatch,
      success: score >= 0,
    });
  }

  finishPuzzleFailure(): void {
    for (const [, samples] of this.currentTimers) {
      samples.length = 0;
    }
    this.collection.puzzles.push({
      score: -1,
      clueCount: 0,
      difficultyMatch: false,
      success: false,
    });
  }

  private computeMetricStats(samples: number[]): MetricStats {
    const sorted = [...samples].sort((a, b) => a - b);
    const avg = mean(samples);
    return {
      mean: avg,
      median: median(sorted),
      min: min(samples),
      max: max(samples),
      p90: p90(sorted),
      p95: p95(sorted),
      stddev: stddev(samples, avg),
      histogram: computeHistogram(samples),
    };
  }

  computeResult(): ModeResult {
    const buildMetric = (label: string): MetricStats => {
      const samples = this.collection.timeSamples.get(label);
      if (!samples || samples.length === 0) {
        return {
          mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0,
          histogram: [],
        };
      }
      return this.computeMetricStats(samples);
    };

    const buildCounterMetric = (label: string): MetricStats => {
      const samples = this.collection.counterSamples.get(label);
      if (!samples || samples.length === 0) {
        return {
          mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0,
          histogram: [],
        };
      }
      return this.computeMetricStats(samples);
    };

    const puzzles = this.collection.puzzles;
    const scored = puzzles.filter((p) => p.success);
    const matchCount = scored.filter((p) => p.difficultyMatch).length;
    const total = puzzles.length;

    const scoreArray = scored.map((p) => p.score);
    const clueArray = scored.map((p) => p.clueCount);

    // Retries = generateSolvedBoard calls - 1 (the first call is initial solution)
    const genBoardRaw = this.collection.counterSamples.get("genBoardCalls");
    const retriesSamples = genBoardRaw
      ? genBoardRaw.map((c) => Math.max(0, c - 1))
      : [];

    return {
      generationTimeMs: buildMetric("generate"),
      clueRemovalTimeMs: buildMetric("removeClues"),
      humanSolverTimeMs: buildMetric("solve"),
      uniquenessCheckTimeMs: buildMetric("hasUniqueSolution"),
      predictorEvalTimeMs: buildMetric("evaluateCandidates"),
      predictorDeltaTimeMs: buildMetric("estimateDelta"),
      predictorBudgetTimeMs: buildMetric("computeEligibleSet"),
      analysisTimeMs: buildMetric("analyzeSolveResult"),
      localSearchTimeMs: buildMetric("localSearch"),
      candidateEvalTimeMs: buildMetric("candidateEval"),
      retries: this.computeMetricStats(retriesSamples),
      humanSolverCalls: buildCounterMetric("solveCalls"),
      predictorEvaluations: buildCounterMetric("predictorEvals"),
      difficultyMatchRate: scored.length > 0 ? matchCount / scored.length : 0,
      scoreDistribution: this.computeMetricStats(scoreArray),
      clueCount: this.computeMetricStats(clueArray),
      successRate: total > 0 ? scored.length / total : 0,
      sampleCount: total,
    };
  }
}
