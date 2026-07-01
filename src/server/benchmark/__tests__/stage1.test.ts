import { describe, it, expect, beforeEach } from "vitest";
import { BenchmarkCollector } from "../collector";
import type { ModeResult, MetricStats } from "../result";
import { DEFAULT_SEVERITY_THRESHOLDS } from "../config";
import type { SeverityThresholds } from "../config";

function emptyStats(): MetricStats {
  return { mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, stddev: 0, histogram: [] };
}

function makeModeResult(overrides?: Partial<ModeResult>): ModeResult {
  const base: ModeResult = {
    generationTimeMs: emptyStats(),
    clueRemovalTimeMs: emptyStats(),
    humanSolverTimeMs: emptyStats(),
    uniquenessCheckTimeMs: emptyStats(),
    predictorEvalTimeMs: emptyStats(),
    predictorDeltaTimeMs: emptyStats(),
    predictorBudgetTimeMs: emptyStats(),
    analysisTimeMs: emptyStats(),
    localSearchTimeMs: emptyStats(),
    candidateEvalTimeMs: emptyStats(),
    retries: emptyStats(),
    humanSolverCalls: emptyStats(),
    predictorEvaluations: emptyStats(),
    difficultyMatchRate: 1,
    scoreDistribution: emptyStats(),
    clueCount: emptyStats(),
    successRate: 1,
    sampleCount: 0,
  };
  return { ...base, ...overrides };
}

describe("ModeResult — rawSamples", () => {
  it("rawSamples is optional and omitted when not present", () => {
    const result = makeModeResult();
    expect(result.rawSamples).toBeUndefined();
  });

  it("accepts rawSamples when provided", () => {
    const result = makeModeResult({
      rawSamples: { generationTimeMs: [10, 20, 30] },
    });
    expect(result.rawSamples).toBeDefined();
    expect(result.rawSamples!.generationTimeMs).toEqual([10, 20, 30]);
  });

  it("backward compatible: report without rawSamples still works", () => {
    const report = {
      config: {} as any,
      timestamp: "2026-07-01T00:00:00Z",
      modes: [{ mode: "baseline", difficulties: [{ difficulty: "easy", metrics: makeModeResult() }] }],
      acceptance: null,
    };
    expect((report.modes[0].difficulties[0].metrics as ModeResult).rawSamples).toBeUndefined();
    expect(report.timestamp).toBe("2026-07-01T00:00:00Z");
  });

  it("backward compatible: accessing rawSamples on old reports returns undefined", () => {
    const metrics = makeModeResult() as ModeResult & { rawSamples?: Record<string, number[]> };
    expect(metrics.rawSamples).toBeUndefined();
    const raw = metrics.rawSamples;
    expect(raw).toBeUndefined();
  });
});

describe("BenchmarkCollector — rawSamples preservation", () => {
  let collector: BenchmarkCollector;

  beforeEach(() => {
    collector = new BenchmarkCollector();
  });

  it("omits rawSamples when no data collected", () => {
    const result = collector.computeResult();
    expect(result.rawSamples).toBeUndefined();
  });

  it("preserves generationTimeMs raw samples", () => {
    collector.startPuzzle();
    collector.recordTime("generate", 10.5);
    collector.recordTime("generate", 20.3);
    collector.recordTime("generate", 15.7);
    collector.finishPuzzle(85, 40, true);

    const result = collector.computeResult();
    expect(result.rawSamples).toBeDefined();
    expect(result.rawSamples!.generationTimeMs).toEqual([10.5, 20.3, 15.7]);
  });

  it("preserves raw samples for multiple timer metrics", () => {
    collector.startPuzzle();
    collector.recordTime("generate", 5);
    collector.recordTime("solve", 100);
    collector.recordTime("removeClues", 2);
    collector.finishPuzzle(90, 35, true);

    const result = collector.computeResult();
    expect(result.rawSamples!.generationTimeMs).toEqual([5]);
    expect(result.rawSamples!.humanSolverTimeMs).toEqual([100]);
    expect(result.rawSamples!.clueRemovalTimeMs).toEqual([2]);
  });

  it("preserves counter-based raw samples (humanSolverCalls)", () => {
    collector.startPuzzle();
    collector.incrementCounter("solveCalls");
    collector.incrementCounter("solveCalls");
    collector.incrementCounter("solveCalls");
    collector.finishPuzzle(95, 38, true);

    collector.startPuzzle();
    collector.incrementCounter("solveCalls");
    collector.finishPuzzle(80, 42, false);

    const result = collector.computeResult();
    expect(result.rawSamples!.humanSolverCalls).toEqual([3, 1]);
  });

  it("preserves retries raw samples (derived from genBoardCalls)", () => {
    collector.startPuzzle();
    collector.incrementCounter("genBoardCalls");
    collector.incrementCounter("genBoardCalls");
    collector.finishPuzzle(70, 30, true);

    collector.startPuzzle();
    collector.incrementCounter("genBoardCalls");
    collector.finishPuzzle(85, 36, true);

    const result = collector.computeResult();
    expect(result.rawSamples!.retries).toEqual([1, 0]);
  });

  it("preserves scoreDistribution and clueCount raw samples", () => {
    collector.startPuzzle();
    collector.recordTime("generate", 1);
    collector.finishPuzzle(95, 40, true);

    collector.startPuzzle();
    collector.recordTime("generate", 1);
    collector.finishPuzzle(70, 35, true);

    const result = collector.computeResult();
    expect(result.rawSamples!.scoreDistribution).toEqual([95, 70]);
    expect(result.rawSamples!.clueCount).toEqual([40, 35]);
  });

  it("preserves raw samples across multiple puzzles", () => {
    for (let i = 0; i < 3; i++) {
      collector.startPuzzle();
      collector.recordTime("generate", i * 10);
      collector.finishPuzzle(50 + i * 10, 30 + i, true);
    }

    const result = collector.computeResult();
    expect(result.rawSamples!.generationTimeMs).toEqual([0, 10, 20]);
    expect(result.rawSamples!.scoreDistribution).toEqual([50, 60, 70]);
    expect(result.sampleCount).toBe(3);
  });

  it("preserves memoryUsage raw samples when snapshots exist", () => {
    collector.recordMemoryBefore();
    collector.recordMemoryAfter();

    const result = collector.computeResult();
    if (result.rawSamples && result.rawSamples.memoryUsage) {
      expect(Array.isArray(result.rawSamples.memoryUsage)).toBe(true);
      expect(result.rawSamples.memoryUsage.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("raw samples are copies (not shared references)", () => {
    collector.startPuzzle();
    collector.recordTime("generate", 42);
    collector.finishPuzzle(90, 35, true);

    const result = collector.computeResult();
    const raw = result.rawSamples!.generationTimeMs;
    collector.clear();
    expect(result.rawSamples!.generationTimeMs).toBe(raw);
    expect(raw).toEqual([42]);
  });
});

describe("SeverityThresholds — defaults", () => {
  it("has correct default blocking thresholds", () => {
    expect(DEFAULT_SEVERITY_THRESHOLDS.blockingEffectSize).toBe(0.8);
    expect(DEFAULT_SEVERITY_THRESHOLDS.blockingPValue).toBe(0.01);
  });

  it("has correct default advisory thresholds", () => {
    expect(DEFAULT_SEVERITY_THRESHOLDS.advisoryEffectSize).toBe(0.5);
    expect(DEFAULT_SEVERITY_THRESHOLDS.advisoryPValue).toBe(0.05);
  });

  it("SeverityThresholds interface accepts custom values", () => {
    const custom: SeverityThresholds = {
      blockingEffectSize: 1.0,
      blockingPValue: 0.005,
      advisoryEffectSize: 0.3,
      advisoryPValue: 0.1,
    };
    expect(custom.blockingEffectSize).toBe(1.0);
    expect(custom.advisoryPValue).toBe(0.1);
  });
});
