import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { SudokuGenerator } from "../../core/SudokuGenerator";
import { MODES } from "../modes";
import type { ModeDef } from "../modes";
import { BenchmarkCollector } from "../collector";
import { installProbes, removeProbes } from "../probes";
import type { ModeResult, ModeReport, BenchmarkReport } from "../result";
import { toConsole, writeReportFiles } from "../reporter";
import { checkAcceptance } from "../gates";
import { generatePlots, writePlots } from "../visualizer";

// ── Configuration ───────────────────────────────────────────────────────────

const SAMPLES = 20;
const WARMUP = 3;
const TIMEOUT = 300_000;
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const GRID_SIZE = 9;
const BOX_SIZE = 3;
const ACTIVE_MODES = ["baseline", "guided", "predictor"];

const ACCEPTANCE_GATES = {
  generationTimeMs: { max: { easy: 3000, medium: 5000, hard: 8000 } },
  difficultyMatchRate: { min: { easy: 0.5, medium: 0.5, hard: 0.5 } },
  humanSolverCalls: { max: { easy: 40, medium: 50, hard: 60 } },
  predictorOverheadMs: { max: 200 },
  successRate: { min: 0.9 },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function setupSeed(seed: number): () => void {
  const origRandom = Math.random;
  let s = seed | 0;
  Math.random = function () {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
  return () => {
    Math.random = origRandom;
  };
}

// ── Benchmark Suite ─────────────────────────────────────────────────────────

describe("Performance benchmark", () => {
  const allResults = new Map<string, Map<string, ModeResult>>();

  beforeAll(() => {
    // Warmup — JIT compilation settle
    for (let i = 0; i < WARMUP; i++) {
      new SudokuGenerator({
        size: GRID_SIZE, boxSize: BOX_SIZE,
        difficulty: "easy", matchDifficulty: false,
      }).generate();
    }
    global.gc?.();
  });

  afterAll(() => {
    const cfg = {
      samples: SAMPLES,
      warmup: WARMUP,
      runs: 1,
      seed: null,
      modes: ACTIVE_MODES,
      difficulties: [...DIFFICULTIES],
      outputDir: "./bench-results",
      generatePlots: false,
      acceptanceGates: ACCEPTANCE_GATES,
    };

    const modeReports: ModeReport[] = [];
    for (const [modeName, diffMap] of allResults) {
      const difficulties = [...diffMap.entries()]
        .filter(([, r]) => r.sampleCount > 0)
        .map(([diffName, result]) => ({
          difficulty: diffName,
          metrics: result,
        }));
      if (difficulties.length > 0) {
        modeReports.push({ mode: modeName, difficulties });
      }
    }

    const partial = { config: cfg, timestamp: "", modes: modeReports, acceptance: null };
    const acceptance = checkAcceptance(partial as BenchmarkReport, ACCEPTANCE_GATES);

    const report: BenchmarkReport = {
      config: cfg,
      timestamp: new Date().toISOString(),
      modes: modeReports,
      acceptance,
    };

    console.log(toConsole(report));
    writeReportFiles(report, "./bench-results");

    const plots = generatePlots(report);
    if (Object.keys(plots).length > 0) {
      writePlots(plots, "./bench-results");
    }

    if (!acceptance.passed) {
      const failed = acceptance.checks.filter((c) => c.status === "fail");
      console.error(`\n${failed.length} acceptance gate(s) FAILED:`);
      for (const f of failed) {
        console.error(`  ✗ ${f.name} (${f.mode}/${f.difficulty}): ${f.actual.toFixed(2)} vs threshold ${f.threshold}`);
      }
    }
  });

  beforeEach(() => {
    global.gc?.();
  });

  describe.each(
    MODES.filter((m: ModeDef) => ACTIVE_MODES.includes(m.name)),
  )("Mode: $name", ({ name, config: modeConfig, enableLocalSearch }: ModeDef) => {
    let origLocalSearch: boolean;

    beforeAll(() => {
      origLocalSearch = SudokuGenerator.USE_LOCAL_SEARCH;
      SudokuGenerator.USE_LOCAL_SEARCH = enableLocalSearch;
    });

    afterAll(() => {
      SudokuGenerator.USE_LOCAL_SEARCH = origLocalSearch;
    });

    describe.each(DIFFICULTIES)("%s", (difficulty: string) => {
      it(`generates ${SAMPLES} ${difficulty} puzzles`, () => {
        const collector = new BenchmarkCollector();
        const probes: SpyHandle[] = installProbes(collector);
        try {
          for (let i = 0; i < SAMPLES; i++) {
            collector.startPuzzle();
            try {
              const gen = new SudokuGenerator({
                size: GRID_SIZE,
                boxSize: BOX_SIZE,
                difficulty: difficulty as any,
                matchDifficulty: true,
                useGuidedRemoval: modeConfig.useGuidedRemoval,
                usePredictor: modeConfig.usePredictor,
                usePredictorAwareBudget: modeConfig.usePredictorAwareBudget,
              });
              const result = gen.generate();
              collector.finishPuzzle(
                result.analysis.score,
                result.cellsRemoved,
                result.analysis.difficulty === difficulty,
              );
            } catch {
              collector.finishPuzzleFailure();
            }
          }
        } finally {
          removeProbes(probes);
        }

        const modeResult = collector.computeResult();

        if (!allResults.has(name)) {
          allResults.set(name, new Map());
        }
        allResults.get(name)!.set(difficulty, modeResult);

        // Basic sanity — non-zero data was collected
        expect(modeResult.sampleCount).toBeGreaterThan(0);
        expect(modeResult.generationTimeMs.mean).toBeGreaterThanOrEqual(0);
      }, TIMEOUT);
    });
  });
});
