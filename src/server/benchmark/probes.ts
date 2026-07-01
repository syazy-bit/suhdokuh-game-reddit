import { vi } from "vitest";
import type { BenchmarkCollector } from "./collector";
import * as HumanSolverPipeline from "../core/HumanSolverPipeline";
import * as SudokuSolver from "../core/SudokuSolver";
import * as Predictor from "../core/predictor/index";
import * as DifficultyAnalyzer from "../core/DifficultyAnalyzer";
import * as CandidateEngine from "../core/CandidateEngine";
import { SudokuGenerator } from "../core/SudokuGenerator";

export interface SpyHandle {
  restore: () => void;
}

export function installProbes(collector: BenchmarkCollector): SpyHandle[] {
  const handles: SpyHandle[] = [];

  // ── Module-level spies (namespace imports for live binding) ──────────────

  const origSolve = HumanSolverPipeline.solve;
  const solveSpy = vi.spyOn(HumanSolverPipeline, "solve");
  solveSpy.mockImplementation(((board: number[][]) => {
    const t0 = performance.now();
    const result = origSolve(board);
    collector.recordTime("solve", performance.now() - t0);
    collector.incrementCounter("solveCalls");
    return result;
  }) as typeof origSolve);
  handles.push({ restore: () => { solveSpy.mockRestore(); } });

  const origHasUnique = SudokuSolver.hasUniqueSolution;
  const uniqueSpy = vi.spyOn(SudokuSolver, "hasUniqueSolution");
  uniqueSpy.mockImplementation(((grid: number[][], size: number, boxSize: number, maxSteps?: number) => {
    const t0 = performance.now();
    const result = origHasUnique(grid, size as any, boxSize, maxSteps);
    collector.recordTime("hasUniqueSolution", performance.now() - t0);
    return result;
  }) as typeof origHasUnique);
  handles.push({ restore: () => { uniqueSpy.mockRestore(); } });

  const origEvaluate = Predictor.evaluateCandidates;
  const evalSpy = vi.spyOn(Predictor, "evaluateCandidates");
  evalSpy.mockImplementation(((ctx, candidates, difficulty) => {
    const t0 = performance.now();
    const result = origEvaluate(ctx, candidates, difficulty as any);
    collector.recordTime("evaluateCandidates", performance.now() - t0);
    collector.incrementCounter("predictorEvals");
    // Record predictor accuracy data
    if (result.length > 0) {
      collector.recordPredictionCall({
        candidateCount: result.length,
        topBalanceScore: result[0]!.balanceScore,
        topPredictorScore: result[0]!.predictorScore,
        topFinalScore: result[0]!.finalScore,
      });
    }
    return result;
  }) as typeof origEvaluate);
  handles.push({ restore: () => { evalSpy.mockRestore(); } });

  const origEstimate = Predictor.estimateDelta;
  const deltaSpy = vi.spyOn(Predictor, "estimateDelta");
  deltaSpy.mockImplementation(((ctx, candidate, difficulty) => {
    const t0 = performance.now();
    const result = origEstimate(ctx, candidate, difficulty as any);
    collector.recordTime("estimateDelta", performance.now() - t0);
    return result;
  }) as typeof origEstimate);
  handles.push({ restore: () => { deltaSpy.mockRestore(); } });

  const origBudget = Predictor.computeEligibleSet;
  const budgetSpy = vi.spyOn(Predictor, "computeEligibleSet");
  budgetSpy.mockImplementation(((ctx, candidates, difficulty, currentScore, targetScore) => {
    const t0 = performance.now();
    const result = origBudget(ctx, candidates, difficulty as any, currentScore, targetScore);
    collector.recordTime("computeEligibleSet", performance.now() - t0);
    return result;
  }) as typeof origBudget);
  handles.push({ restore: () => { budgetSpy.mockRestore(); } });

  const origAnalyze = DifficultyAnalyzer.analyzeSolveResult;
  const analyzeSpy = vi.spyOn(DifficultyAnalyzer, "analyzeSolveResult");
  analyzeSpy.mockImplementation(((result) => {
    const t0 = performance.now();
    const analysis = origAnalyze(result);
    collector.recordTime("analyzeSolveResult", performance.now() - t0);
    return analysis;
  }) as typeof origAnalyze);
  handles.push({ restore: () => { analyzeSpy.mockRestore(); } });

  const origBuildMap = CandidateEngine.buildCandidateMap;
  const buildMapSpy = vi.spyOn(CandidateEngine, "buildCandidateMap");
  buildMapSpy.mockImplementation(((board, size, boxSize) => {
    const t0 = performance.now();
    const result = origBuildMap(board, size as any, boxSize);
    collector.recordTime("buildCandidateMap", performance.now() - t0);
    return result;
  }) as typeof origBuildMap);
  handles.push({ restore: () => { buildMapSpy.mockRestore(); } });

  // ── Prototype-level spies ───────────────────────────────────────────────

  const origGenerate = SudokuGenerator.prototype.generate;
  const genSpy = vi.spyOn(SudokuGenerator.prototype, "generate");
  genSpy.mockImplementation(function (this: SudokuGenerator) {
    collector.recordMemoryBefore();
    const t0 = performance.now();
    const result = origGenerate.call(this);
    collector.recordTime("generate", performance.now() - t0);
    collector.recordMemoryAfter();
    return result;
  });
  handles.push({ restore: () => { genSpy.mockRestore(); } });

  const origRemoveClues = (SudokuGenerator.prototype as any).removeClues;
  const removeSpy = vi.spyOn(SudokuGenerator.prototype as any, "removeClues");
  removeSpy.mockImplementation(function (this: SudokuGenerator, ...args: any[]) {
    const t0 = performance.now();
    const result = origRemoveClues.apply(this, args);
    collector.recordTime("removeClues", performance.now() - t0);
    return result;
  });
  handles.push({ restore: () => { removeSpy.mockRestore(); } });

  const origGuidedStep = (SudokuGenerator.prototype as any).guidedRemovalStep;
  const guidedSpy = vi.spyOn(SudokuGenerator.prototype as any, "guidedRemovalStep");
  guidedSpy.mockImplementation(function (this: SudokuGenerator, ...args: any[]) {
    const t0 = performance.now();
    const result = origGuidedStep.apply(this, args);
    collector.recordTime("guidedRemovalStep", performance.now() - t0);
    collector.incrementCounter("guidedStepCalls");
    return result;
  });
  handles.push({ restore: () => { guidedSpy.mockRestore(); } });

  const origLocalSearch = (SudokuGenerator.prototype as any).localSearch;
  const lsSpy = vi.spyOn(SudokuGenerator.prototype as any, "localSearch");
  lsSpy.mockImplementation(function (this: SudokuGenerator, ...args: any[]) {
    const t0 = performance.now();
    const result = origLocalSearch.apply(this, args);
    collector.recordTime("localSearch", performance.now() - t0);
    collector.incrementCounter("localSearchCalls");
    return result;
  });
  handles.push({ restore: () => { lsSpy.mockRestore(); } });

  const origGenBoard = (SudokuGenerator.prototype as any).generateSolvedBoard;
  const genBoardSpy = vi.spyOn(SudokuGenerator.prototype as any, "generateSolvedBoard");
  genBoardSpy.mockImplementation(function (this: SudokuGenerator, ...args: any[]) {
    collector.incrementCounter("genBoardCalls");
    return origGenBoard.apply(this, args);
  });
  handles.push({ restore: () => { genBoardSpy.mockRestore(); } });

  return handles;
}

export function removeProbes(handles: SpyHandle[]): void {
  for (const h of handles) {
    h.restore();
  }
}
