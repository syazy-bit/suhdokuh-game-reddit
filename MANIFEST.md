# Suhdokuh — Project Manifest

## 1. Project Overview

Suhdokuh is a Sudoku puzzle game for the Reddit Devvit platform. It supports 4×4 and 9×9 grids with multiple difficulty levels, human-logical solving, deterministic puzzle generation, leaderboards, statistics, theme customization, hints, and accessibility.

**Platform**: Reddit Devvit (web game framework)  
**Stack**: TypeScript 5.8, Vite 6.2, Express 5.1, Redis (via Devvit)  
**Client**: Vanilla TypeScript, CSS3 (custom properties, Grid, animations)  
**Server**: Express API running in Devvit's serverless environment  
**Testing**: Vitest  
**Version**: 0.0.29  
**License**: BSD-3-Clause

### Core subsystems

| Component | Role |
|---|---|
| **HumanSolver** | 11 logical techniques in priority order; solves puzzles without guessing |
| **DifficultyAnalyzer** | Converts HumanSolver results into scores and difficulty classifications |
| **SudokuGenerator** | Generates solved boards, removes clues, validates uniqueness, matches difficulty |
| **Candidate Predictor** | Pre-filters and scores removal candidates before HumanSolver evaluation |
| **Guided Removal** | HumanSolver-guided clue removal targeting specific difficulty bands |
| **Local Search** | Iterative puzzle refinement swapping clue patterns to improve difficulty fit |
| **HintEngine** | Wraps `solveStep()` with technique descriptions for display |
| **SudokuSolver** | Constraint propagation + MRV backtracking for uniqueness verification |
| **SudokuValidator** | Grid validation helpers (`isValidPlacement`, `isValidSolution`, etc.) |
| **Leaderboard** | Redis sorted sets per mode/difficulty, top 50 stored |

---

## 2. Current Solver Capabilities

All 11 techniques are **implemented**. Techniques are applied in strict priority order. Each finder is stateless and read-only — it never mutates the board or candidate map.

| # | Technique | Type | Weight | Status |
|---|-----------|------|--------|--------|
| 1 | Naked Single | assignment | 1.0 | ✓ Implemented |
| 2 | Hidden Single | assignment | 1.5 | ✓ Implemented |
| 3 | Naked Pair | elimination | 3.0 | ✓ Implemented |
| 4 | Hidden Pair | elimination | 4.0 | ✓ Implemented |
| 5 | Pointing Pair | elimination | 5.0 | ✓ Implemented |
| 6 | Claiming Pair | elimination | 5.5 | ✓ Implemented |
| 7 | X-Wing | elimination | 7.0 | ✓ Implemented |
| 8 | Skyscraper | elimination | 7.5 | ✓ Implemented |
| 9 | Two-String Kite | elimination | 7.7 | ✓ Implemented |
| 10 | XY-Wing | elimination | 8.0 | ✓ Implemented |
| 11 | Swordfish | elimination | 9.0 | ✓ Implemented |

### Pipeline (`HumanSolverPipeline.ts`)

- `solve(board)` — applies techniques in priority order until solved or stuck. Returns `SolveResult` with all moves, techniques used, and hardest technique.
- `solveStep(board)` — finds the next single move without mutating the board. Used by HintEngine.
- `canSolve(board)` — boolean wrapper around `solve()`.

### DifficultyAnalyzer

Converts `SolveResult` → `AnalysisResult`:

- **Score**: weighted sum of technique applications per `TECHNIQUE_WEIGHTS`
- **Difficulty thresholds**:
  - Easy: score ≤ 30
  - Medium: score ≤ 52
  - Hard: score ≤ 75
  - Expert: score > 75

---

## 3. Puzzle Generator

### Architecture

```
Generate solved board (backtracking with shuffled diagonal boxes)
  ↓
Clue removal (rotationally symmetric pairs, scored)
  ↓
Candidate Predictor (optional, feature-flagged)
  ↓
Guided Removal (optional, feature-flagged)
  ↓
Local Search (optional, feature-flagged)
  ↓
Uniqueness verification (hasUniqueSolution)
  ↓
HumanSolver solve + DifficultyAnalyzer scoring
  ↓
Accept if difficulty matches, retry up to maxAttempts
```

### Solved board generation

1. Create empty grid
2. Fill three diagonal boxes with shuffled numbers (independent)
3. Backtracking fill of remaining cells with random number ordering
4. Loop until valid solution found

### Clue removal

- Removes cells in rotationally symmetric pairs `(r, c)` and `(size-1-r, size-1-c)`
- Target removal counts: easy=30, medium=45, hard=50, expert=55 (9×9)
- **Balance score**: favors removing from rows/cols/boxes with fewer removals
- **Sparsity penalty**: penalizes large empty clusters (multiplier 0.15)
- Per-row/col/box removal caps: 65% most difficulties, 70% hard
- Stops after 10 consecutive uniqueness failures

### Difficulty matching

- Solved with HumanSolver and scored by DifficultyAnalyzer
- If `AnalysisResult.difficulty` matches target, puzzle is returned
- Otherwise, new solution generated and process repeats
- Up to `maxAttempts` (default 50)

---

## 4. Predictor Architecture

The predictor subsystem lives in `src/server/core/predictor/`. It pre-filters and scores removal candidates before the expensive HumanSolver evaluation, improving the quality of clue removal decisions.

### Directory structure

```
predictor/
  index.ts                    — Public API exports
  PredictorPipeline.ts        — Orchestrates Stage1 + Stage2 + blend
  PredictorWeights.ts         — Centralized weights + difficulty blend ratios
  FeatureRegistry.ts          — Registry + registerDefaultFeatures()
  types.ts                    — Interfaces and type definitions
  features/
    Stage1IsolationFilter.ts
    Stage1BoxDepletionFilter.ts
    Stage2BivalueCreated.ts
    Stage2NakedSingleCreated.ts
    Stage2StrongLinkCreated.ts
    Stage2LocalCandidateSurge.ts
    Stage2SectorConflict.ts
  __tests__/
    CandidatePredictor.test.ts
```

### Pipeline flow

```
For each removal candidate:
  Stage1 filters (boolean pass/fail, fast)
    → IsolationFilter: skip cells with ≥2 empty neighbors
    → BoxDepletionFilter: skip if box would have ≤2 givens
  ↓ (if passed)
  Backup board, mutate (set cells to 0)
  Stage2 features (scored, local-region inspection)
  ↓
  Restore board (guaranteed via try/finally)
  ↓
  Blend balanceScore + predictorScore → finalScore
  ↓
  Sort candidates by finalScore descending
```

### Stage1 filters

| Filter | Behavior | Configurable per difficulty |
|---|---|---|
| IsolationFilter | Skips cells with ≥2 empty neighbors | Yes |
| BoxDepletionFilter | Skips if box would drop to ≤2 givens | Yes |

### Stage2 features

| Feature | Weight | Description |
|---|---|---|
| BivalueCreated | +2 | Rewards new bivalue cells in affected region |
| NakedSingleCreated | −3 | Penalizes creating new Naked Singles (structure loss) |
| StrongLinkCreated | +5 | Rewards new strong links (X-Wing/Skyscraper/Kite potential) |
| LocalCandidateSurge | +1 | Rewards candidate count increase in local region |
| SectorConflict | +3 | Rewards intra-box value spread (intersector ambiguity) |

### Blend

`finalScore = α · balanceScore + β · predictorScore`

Blend ratios vary by difficulty:
- Easy: 70% balance / 30% predictor
- Medium: 50% / 50%
- Hard: 35% / 65%
- Expert: 20% / 80%

### Feature registry pattern

Adding a new technique precursor requires:
1. One new file in `features/` implementing the interface
2. One line in `registerDefaultFeatures()`

No changes to core predictor logic.

### Board safety

Board mutation during Stage2 evaluation is wrapped in `try/finally` to guarantee restoration even if a feature throws.

---

## 5. Difficulty System

### 4×4 (geometric difficulty)

| Level | Cells removed | Techniques required |
|---|---|---|
| Beginner | 6 | Naked/Hidden Singles |
| Advanced | 8 | May require pairs |

4×4 grids have 16 cells — limited granularity. Finer grading is not meaningful.

### 9×9 (HumanSolver difficulty)

| Level | Cells removed | Score range |
|---|---|---|
| Easy | ~30 | ≤ 30 |
| Medium | ~45 | ≤ 52 |
| Hard | ~50 | ≤ 75 |
| Expert | ~55 | > 75 |

---

## 6. Current Generation Strategy

Three-stage generation pipeline with independent feature flags.

### Stage 1: Fast clue removal (always active)

- Rotational symmetry
- Balance score + sparsity penalty
- Uniqueness verification

### Stage 2: Guided removal (`useGuidedRemoval`, default false)

- Uses HumanSolver during clue removal to steer toward target difficulty
- Improves difficulty match rate vs. random removal

### Stage 3: Local search (`USE_LOCAL_SEARCH`, globally toggleable)

- Iteratively swaps clue patterns to refine difficulty fit
- Activated after initial generation completes
- Statistical significance validated via Welch t-test

### Feature flags

| Flag | Type | Default | Scope |
|---|---|---|---|
| `useGuidedRemoval` | constructor config | `false` | Per-generator instance |
| `usePredictor` | constructor config | `false` | Per-generator instance |
| `USE_LOCAL_SEARCH` | static property | `false` | Global |

---

## 7. Current Benchmarks

| Metric | Status |
|---|---|
| Type safety | ✓ `strict: true`, `noUncheckedIndexedAccess`, zero errors |
| Build | ✓ Client + server clean |
| Tests | ✓ 327 passed (8 files) |
| Predictor integration | ✓ Evaluated, blended, feature-flagged |
| Guided removal | ✓ Integrated, benchmarked vs baseline |
| Local search | ✓ Integrated, statistically validated |
| Difficulty matching | ✓ All 6 mode/difficulty combinations |
| Candidate Predictor | ✓ 5 Stage2 features, 2 Stage1 filters, try/finally safety |

---

## 8. Roadmap

### Completed phases

| Phase | Feature | Status |
|---|---|---|
| 1–4 | Core 4×4 game, validation, state management, keyboard | ✓ |
| 5 | 9×9 mode, difficulty system, HumanSolver (initial techniques) | ✓ |
| 6 | Naked Pair, Hidden Pair | ✓ |
| 7 | Pointing Pair, Claiming Pair | ✓ |
| 8 | X-Wing, Skyscraper | ✓ |
| 9 | XY-Wing, Two-String Kite | ✓ |
| 10 | Swordfish, Expert difficulty, theme system | ✓ |
| 10.1 | XY-Wing | ✓ |
| 10.2 | Skyscraper | ✓ |
| 10.3 | Two-String Kite | ✓ |
| 11.1 | Predictor Foundation (FeatureRegistry, types, weights) | ✓ |
| 11.2 | Guided Removal (HumanSolver-steered clue removal) | ✓ |
| 11.3 | Local Search (iterative puzzle refinement) | ✓ |
| 12.1 | Candidate Predictor (Stage1 filters, Stage2 features, blend) | ✓ |

### Upcoming phases

| Phase | Planned work |
|---|---|
| 12.2 | ## Phase 12.2 ✅ Complete

### Predictor Pipeline
- Added calibrated predictor pipeline
- Added Stage 1 normalization
- Added estimateDelta()
- Added predictor-guided candidate pre-filter
- Added offline calibration tooling
- Added developer calibration script

### Safety
- try/finally board restoration
- predictor cannot corrupt board state

### Tests
- +16 unit tests
- Total tests: 343
- Type-check: PASS
- Build: PASS

Status:
✅ Complete |
| 12.3 | ## Phase 12.3 — Predictor Calibration
Status: ✅ Complete

Completed:
- Offline calibration dataset generation
- Ridge regression weight training
- Cross-validation
- Validation gates
- Calibrated coefficient artifact
- Predictor integration
- Updated tests
- 382/382 tests passing
- Type-check passing
- Build passing

Artifacts:
- calibrated-weights.json
- trainPredictorWeights.ts
- generateCalibrationDataset.ts |
| 13 | TBD |

### Future techniques (not yet scheduled)

- Jellyfish
- W-Wing
- Empty Rectangle
- Coloring
- AIC (Alternating Inference Chains)

---

## 9. Design Principles

- **Human-logical solving only**: All solver techniques mirror human reasoning — no guessing, no backtracking in the solver path.
- **Unique-solution guarantee**: Every published puzzle has exactly one solution, verified by constraint propagation + MRV backtracking (stops at 2 solutions).
- **Deterministic analysis**: Same board always produces the same solve result and difficulty classification.
- **Extensible technique registry**: New techniques require one finder file and one registration call — no pipeline changes.
- **Modular architecture**: Generator, solver, analyzer, predictor, and hint engine are independent modules with narrow interfaces.
- **Feature-flag-driven rollout**: All generation enhancements (guided removal, predictor, local search) are gated behind flags, defaulting to off.
- **Type safety first**: `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`.
- **Benchmark before optimisation**: All generation changes are validated against baseline with statistical significance testing (Welch t-test).
- **Immutable technique finders**: All 11 finders are stateless and read-only — they never mutate the board or candidate map.
- **Server-authoritative leaderboard**: Username derived from Reddit session, preventing spoofing.
- **Graceful degradation**: Client-side fallback puzzles when API is unreachable; server-side fallback when generator fails.
- **Accessibility-first UI**: ARIA labels, keyboard navigation, reduced motion, screen reader support, 44px minimum touch targets.

---

## 10. File Map

### Core engine (`src/server/core/`)

| File | Lines | Role |
|---|---|---|
| `SudokuGenerator.ts` | 550 | Puzzle generation: solved board, clue removal, symmetry, difficulty matching, guided removal, local search, predictor integration |
| `HumanSolver.ts` | 1346 | 11 technique finders, stateless and read-only |
| `HumanSolverPipeline.ts` | 145 | Technique application orchestration, solve loop, pending elimination management |
| `DifficultyAnalyzer.ts` | 98 | SolveResult → AnalysisResult conversion, scoring, classification |
| `DifficultyCalibration.ts` | 328 | Threshold validation, benchmark aggregation, distribution overlap detection |
| `DifficultyPredictor.ts` | 65 | Correlates heuristic scores with actual HumanSolver difficulty deltas |
| `HintEngine.ts` | 25 | Wraps `solveStep()` with technique descriptions for hints |
| `HumanSolverTypes.ts` | 15 | Shared types (TECHNIQUES enum, LogicalMove, SolveResult, etc.) |
| `TechniqueDescriptions.ts` | 80 | Human-readable descriptions per technique for hint display |
| `CandidateEngine.ts` | 66 | Candidate map construction and querying |
| `SudokuSolver.ts` | 76 | Constraint propagation + MRV backtracking; stops at 2 solutions; step-limited |
| `SudokuValidator.ts` | 65 | `isValidPlacement`, `isValidSolution`, `areCluesConsistent`, `cloneGrid`, `countEmpty`, `difficultyTargets` |
| `test-utils.ts` | 92 | Shared test helpers |

### Predictor (`src/server/core/predictor/`)

| File | Lines | Role |
|---|---|---|
| `index.ts` | 4 | Public API re-exports |
| `FeatureRegistry.ts` | 36 | Registry + `registerDefaultFeatures()` |
| `PredictorPipeline.ts` | 58 | Stage1 + Stage2 orchestration, blending, try/finally safety |
| `PredictorWeights.ts` | 24 | Feature weights + difficulty blend ratios |
| `types.ts` | 29 | Interfaces and type definitions |
| `features/Stage1IsolationFilter.ts` | 30 | Skips cells with ≥2 empty neighbors |
| `features/Stage1BoxDepletionFilter.ts` | 30 | Skips if box would have ≤2 givens |
| `features/Stage2BivalueCreated.ts` | 52 | +2 per new bivalue cell |
| `features/Stage2NakedSingleCreated.ts` | 52 | −3 per new Naked Single |
| `features/Stage2StrongLinkCreated.ts` | 70 | +5 per new strong link |
| `features/Stage2LocalCandidateSurge.ts` | 54 | +1 × normalized candidate surge |
| `features/Stage2SectorConflict.ts` | 55 | +3 per intersector ambiguity |

### Tests (`src/server/core/`)

| File | Lines | Coverage |
|---|---|---|
| `HumanSolver.test.ts` | 2325 | Individual technique finders, edge cases, immutability |
| `SudokuGenerator.test.ts` | 860 | Solution validity, uniqueness, difficulty matching, guided removal, local search, predictor, benchmarks |
| `HumanSolverPipeline.test.ts` | 427 | Priority ordering, move accumulation |
| `DifficultyAnalyzer.test.ts` | 437 | Score computation, classification, technique tracking |
| `DifficultyCalibration.test.ts` | 405 | Threshold validation, benchmark aggregation |
| `DifficultyPredictor.test.ts` | 269 | Correlation between predictor score and difficulty delta |
| `HintEngine.test.ts` | 286 | Hint step wrapping, technique descriptions |
| `predictor/__tests__/CandidatePredictor.test.ts` | 316 | Stage1 filters, Stage2 features, integration, determinism |

### Client (`src/client/`)

| File | Lines | Role |
|---|---|---|
| `game/game.ts` | 2336 | All game logic, UI rendering, event handling, keyboard, timer, leaderboard, stats, theme |
| `game/game.css` | 2116 | All styling, theme variables, animations, responsive design |
| `game/game.html` | — | Minimal HTML shell |
| `splash/` | — | Animated splash/landing screen |

### Server (`src/server/`)

| File | Lines | Role |
|---|---|---|
| `index.ts` | 961 | Express API routes, Devvit middleware, rate limiting, fallback libraries |
| `post.ts` | 6 | Post type definition |
