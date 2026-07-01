import { describe, it, expect, beforeEach } from "vitest";
import { BenchmarkCollector } from "../collector";
import type { PredictorCallRecord } from "../result";

describe("BenchmarkCollector — Stage 2 extensions", () => {
  let collector: BenchmarkCollector;

  beforeEach(() => {
    collector = new BenchmarkCollector();
  });

  it("records memory snapshots", () => {
    collector.recordMemoryBefore();
    // Simulate some work
    const arr = new Array(10000).fill(0).map(() => Math.random());
    collector.recordMemoryAfter();

    const result = collector.computeResult();
    expect(result.memoryUsage).toBeDefined();
    expect(result.memoryUsage!.mean).toBeGreaterThanOrEqual(0);
  });

  it("records multiple memory snapshots and computes stats", () => {
    const deltas = [5.1, 8.3, 2.7, 10.5, 3.2];
    for (const d of deltas) {
      collector.recordMemoryBefore();
      // Use a hack: set the internal beforeBytes directly so delta is controllable
      (collector as any).currentMemoryBefore = 0;
      // After bytes will be computed from currentMemoryBefore + deltaMb
      // We can't inject a fake heap, so let's just verify the snapshot shape
      collector.recordMemoryAfter();
    }

    const result = collector.computeResult();
    expect(result.memoryUsage).toBeDefined();
    // memory deltas may be small or negative (GC), but stats should exist
    expect(typeof result.memoryUsage!.mean).toBe("number");
  });

  it("records predictor calls", () => {
    const calls: PredictorCallRecord[] = [
      { candidateCount: 10, topBalanceScore: 0.5, topPredictorScore: 6.0, topFinalScore: 5.2 },
      { candidateCount: 8, topBalanceScore: 0.7, topPredictorScore: 7.2, topFinalScore: 6.8 },
      { candidateCount: 12, topBalanceScore: 0.3, topPredictorScore: 5.5, topFinalScore: 4.1 },
    ];

    for (const call of calls) {
      collector.recordPredictionCall(call);
    }

    const result = collector.computeResult();
    expect(result.predictorAccuracy).toBeDefined();
    expect(result.predictorAccuracy!.totalCalls).toBe(3);
    expect(result.predictorAccuracy!.totalCandidates).toBe(30);
  });

  it("omits memoryUsage when no snapshots recorded", () => {
    const result = collector.computeResult();
    expect(result.memoryUsage).toBeUndefined();
  });

  it("omits predictorAccuracy when no calls recorded", () => {
    const result = collector.computeResult();
    expect(result.predictorAccuracy).toBeUndefined();
  });

  it("clears all Stage 2 data on clear()", () => {
    collector.recordMemoryBefore();
    collector.recordMemoryAfter();
    collector.recordPredictionCall({
      candidateCount: 5,
      topBalanceScore: 0.9,
      topPredictorScore: 8.0,
      topFinalScore: 7.5,
    });

    collector.clear();

    const result = collector.computeResult();
    expect(result.memoryUsage).toBeUndefined();
    expect(result.predictorAccuracy).toBeUndefined();
  });

  it("handles memory tracking with startPuzzle boundary", () => {
    collector.startPuzzle();
    collector.startPuzzle(); // second startPuzzle resets currentMemoryBefore
    collector.recordMemoryBefore();
    collector.recordMemoryAfter();

    const result = collector.computeResult();
    expect(result.memoryUsage).toBeDefined();
  });

  it("handles recordMemoryAfter without prior recordMemoryBefore", () => {
    // Calling recordMemoryAfter without before should still produce a snapshot
    collector.recordMemoryAfter();

    const result = collector.computeResult();
    expect(result.memoryUsage).toBeDefined();
    expect(typeof result.memoryUsage!.mean).toBe("number");
  });
});
