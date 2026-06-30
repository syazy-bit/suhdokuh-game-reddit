# Suhdokuh — Project Manifest

## Project Overview

Suhdokuh is a Sudoku puzzle game built for the Reddit Devvit platform. It runs as a web application served through Reddit's custom post framework, supporting both 4×4 and 9×9 grids with multiple difficulty levels, leaderboards, statistics, theme customization, and a hint system.

**Platform**: Reddit Devvit (web game framework)  
**Stack**: TypeScript 5.8, Vite 6.2, Express 5.1, Redis (via Devvit)  
**Client**: Vanilla TypeScript, CSS3 (custom properties, Grid, animations)  
**Server**: Express API running in Devvit's serverless environment  
**Testing**: Vitest  
**Version**: 0.0.29  
**License**: BSD-3-Clause

---

## Current Features

### Game modes
- **4×4 Beginner** — 6 cells removed, solved with Naked/Hidden Singles only
- **4×4 Advanced** — 8 cells removed
- **9×9 Easy** — ~30 cells removed, solved with basic techniques
- **9×9 Medium** — ~45 cells removed, introduces pairs
- **9×9 Hard** — ~50 cells removed, introduces wings and fish
- **9×9 Expert** — ~55 cells removed, may require Swordfish

### Gameplay
- Cell selection with row/column/box/number highlighting
- Number input via buttons or keyboard (1-4 / 1-9)
- Pencil-mark (notes) mode for candidate tracking
- Intelligent note cleanup — auto-removes placed numbers from peer cells
- Undo/redo with full history replay
- Conflict detection (red highlighting) for invalid placements
- Win detection with victory animation (radial pulse from final cell)
- Completion dialog with stats (time, difficulty, hints used)
- Flawless badge (no hints used)

### Timer
- Elapsed time display, paused on page hide (Page Visibility API)

### Leaderboard
- Per-mode, per-difficulty leaderboards via Redis sorted sets (single source of truth)
- Top 10 displayed, top 50 stored
- Personal best card with global rank
- Medals for top 3
- Legacy migration from old JSON storage
- Skeleton loading states

### Statistics
- Total wins, total play time
- Personal best records per (mode, difficulty)
- Win counts per mode and difficulty
- Accordion UI in stats dialog

### Theme system
- 5 themes: Classic, Midnight, Forest, Ocean, Lavender
- Semantic CSS custom properties via `data-theme` attribute on `<html>`
- Persisted to `localStorage`
- Transition animations on theme switch

### Hint system
- 3 hints per game, decremented on use
- Hints reveal the correct value for the selected cell
- Cell is highlighted with a green flash animation

### Accessibility
- ARIA labels on all interactive elements
- Screen reader live region for announcements
- Keyboard navigation (arrows, number keys, shortcuts)
- Focus management for modals and dialogs
- Reduced motion support (`prefers-reduced-motion`)
- Touch targets ≥ 44px on mobile

### Offline resilience
- Client-side fallback puzzle libraries for every mode/difficulty
- Server-side fallback puzzles when generator fails

### Puzzle validation
- `isValidPlacement` — row, column, and box constraint check
- `isValidSolution` — full solution integrity verification
- `areCluesConsistent` — puzzle clues match the intended solution
- `hasUniqueSolution` — backtracking solver confirms exactly one solution
- Rate limiting: 10 puzzle requests per user per 60 seconds

---

## Human Solver

The HumanSolver implements 11 logical techniques in strict priority order. Each technique attempts to find moves without guessing — the solver never backtracks.

### Implemented techniques

| # | Technique | Type | Weight |
|---|-----------|------|--------|
| 1 | Naked Single | assignment | 1.0 |
| 2 | Hidden Single | assignment | 1.5 |
| 3 | Naked Pair | elimination | 3.0 |
| 4 | Hidden Pair | elimination | 4.0 |
| 5 | Pointing Pair | elimination | 5.0 |
| 6 | Claiming Pair | elimination | 5.5 |
| 7 | X-Wing | elimination | 7.0 |
| 8 | Skyscraper | elimination | 7.5 |
| 9 | Two-String Kite | elimination | 7.7 |
| 10 | XY-Wing | elimination | 8.0 |
| 11 | Swordfish | elimination | 9.0 |

### Pipeline (`HumanSolverPipeline.ts`)

- `solve(board)` — repeatedly applies techniques in priority order until solved or stuck. Returns `SolveResult` with all moves, techniques used, and hardest technique encountered.
- `solveStep(board)` — finds the next single move without mutating the board. Used by the HintEngine.
- `canSolve(board)` — boolean wrapper around `solve()`.

### DifficultyAnalyzer

Converts a `SolveResult` into an `AnalysisResult`:

- **Score**: weighted sum of all technique applications per `TECHNIQUE_WEIGHTS`
- **Difficulty classification**:
  - Easy: score ≤ 30
  - Medium: score ≤ 52
  - Hard: score ≤ 75
  - Expert: score > 75

Expert puzzles currently achieve scores of 76-88 through accumulated lower techniques rather than Swordfish.

### Technique finder interface

All 11 finders share a consistent signature:
```typescript
(ctx: HumanSolverContext) => LogicalMove[]
```
Finders are stateless and read-only — they never mutate the board or candidate map.

---

## Puzzle Generator

### Current architecture

```
Solved board generation (backtracking with shuffled diagonal boxes)
  ↓
Rotational symmetry clue removal (scored candidate selection)
  ↓
Uniqueness verification (hasUniqueSolution)
  ↓
HumanSolver solve + DifficultyAnalyzer scoring
  ↓
Accept if difficulty matches, retry with new solution (up to 50 attempts)
```

### Solved board generation
1. Create empty grid
2. Fill three diagonal 3×3 boxes with shuffled numbers (independent)
3. Backtracking fill of remaining cells with random number ordering
4. Loop until a valid solution is found

### Clue removal
- Removes cells in rotationally symmetric pairs `(r, c)` and `(size-1-r, size-1-c)`
- Target removal counts: easy=30, medium=45, hard=50, expert=55 (for 9×9)
- Each candidate cell is scored by:
  - **Balance score**: favors removing from rows/cols/boxes with fewer removals
  - **Sparsity penalty**: penalizes creating large empty clusters (multiplier 0.15)
- Per-row/col/box removal caps: 65% for most difficulties, 70% for hard
- Stops after 10 consecutive failures (uniqueness check failed)

### Difficulty matching
- The initial puzzle is solved with HumanSolver and scored
- If the `AnalysisResult.difficulty` matches the target, the puzzle is returned
- Otherwise, a new solution is generated and the process repeats
- Up to 50 attempts before throwing an error
- **Expert generation is retry-based** — a future intelligent generator will address this

---

## Difficulty System

### 4×4 (2 difficulties)
- **Beginner**: 6 cells removed
- **Advanced**: 8 cells removed

4×4 grids have only 16 cells, providing limited granularity for difficulty differentiation. Beginner puzzles can be solved with Naked/Hidden Singles only. Advanced puzzles may require pairs.

### 9×9 (4 difficulties)
- **Easy**: ~30 cells removed, score ≤ 30
- **Medium**: ~45 cells removed, score ≤ 52
- **Hard**: ~50 cells removed, score ≤ 75
- **Expert**: ~55 cells removed, score > 75

---

## Theme System

The theme system uses CSS custom properties scoped via `data-theme` attribute:

```css
html[data-theme="classic"] { /* ... tokens */ }
html[data-theme="midnight"] { /* ... tokens */ }
html[data-theme="forest"]   { /* ... tokens */ }
html[data-theme="ocean"]    { /* ... tokens */ }
html[data-theme="lavender"] { /* ... tokens */ }
```

### Token categories
- Brand colors (`--color-primary`, `--color-primary-contrast`, etc.)
- Backgrounds (`--bg-app`, `--bg-surface`, `--bg-hover`)
- Surfaces (`--surface-card`, `--surface-dialog`)
- Typography (`--text-primary`, `--text-secondary`, `--text-muted`)
- Borders (`--border-subtle`, `--border-strong`)
- Sudoku board (`--cell-bg`, `--cell-text`, `--cell-bg-selected`, `--box-border-color`)
- Player ink (`--player-ink`) for user-entered numbers
- Badges, medals, skeleton loading
- Dialogs (`--backdrop`, `--backdrop-blur`)
- Completion dialog stat icons
- Leaderboard current-user highlighting
- Component tokens (`--card-shadow`, `--grid-shadow`)

Theme selection is persisted to `localStorage` under key `suhdokuh.theme` and applied on page load.

---

## Current Architecture

### Client
- **game.ts** (2336 lines) — all game logic, UI rendering, event handling, keyboard shortcuts, timer, leaderboard, stats, theme picker
- **game.css** (2116 lines) — all game styling, theme variables, animations, responsive design, dialog styling
- **game.html** — minimal HTML shell
- **splash/** — animated splash/landing screen

### Server (`src/server/index.ts`)
- Express API with Devvit middleware
- Endpoints: `/api/init`, `/api/puzzle`, `/api/submit-score`, `/api/leaderboard`, `/api/stats`, `/internal/*`
- Rate limiting via Redis
- Fallback puzzle libraries for every difficulty

### HumanSolver (`src/server/core/HumanSolver.ts`)
- 1519 lines, 11 technique finders
- Each finder is pure (reads context, returns moves)
- Immutable with respect to board and candidate map

### HumanSolverPipeline (`src/server/core/HumanSolverPipeline.ts`)
- Orchestrates technique application in priority order
- Manages pending eliminations between iterations
- Tracks move history and hardest technique

### PuzzleGenerator (`src/server/core/SudokuGenerator.ts`)
- Generates solved boards via diagonal box fill + backtracking
- Removes clues with scoring and symmetry
- Validates uniqueness via `SudokuSolver.hasUniqueSolution`
- Matches difficulty via HumanSolverPipeline + DifficultyAnalyzer

### DifficultyAnalyzer (`src/server/core/DifficultyAnalyzer.ts`)
- Converts SolveResult → AnalysisResult
- Score computation, difficulty classification, technique tracking
- Calibration system (`DifficultyCalibration.ts`) for threshold validation

### CandidateEngine (`src/server/core/CandidateEngine.ts`)
- Builds and queries candidate maps
- Used by HumanSolver for technique detection

### HintEngine (`src/server/core/HintEngine.ts`)
- Wraps `solveStep()` with technique descriptions for display

### SudokuSolver (`src/server/core/SudokuSolver.ts`)
- Constraint propagation + MRV backtracking for uniqueness verification
- Stops at 2 solutions (not unique)
- Step-limited (200k for 9×9)

### SudokuValidator (`src/server/core/SudokuValidator.ts`)
- `isValidPlacement`, `isValidSolution`, `areCluesConsistent`, `cloneGrid`, `countEmpty`
- `difficultyTargets` — cells-to-remove per mode/difficulty

### Leaderboard
- Redis sorted set per `leaderboard:{mode}:{difficulty}:scores`
- Top 50 stored, sorted ascending by time
- Legacy migration from old JSON format
- Current-player rank and personal best computed from same source

### Redis
- Leaderboard sorted sets
- Rate limiting counters (TTL-based)
- Player statistics JSON blobs
- Legacy leaderboard JSON migration

---

## Coding Principles

- **Strict TypeScript**: `strict: true` in tsconfig, `noUncheckedIndexedAccess` with postfix `!` assertions throughout solver code
- **No duplicated solver logic**: A single canonical implementation for each technique, shared across puzzle generation, difficulty analysis, and hinting
- **Mathematical correctness over heuristics**: All Sudoku rules are derived from logical constraints, not statistical patterns
- **Human-solvable puzzles**: Only techniques a human could apply — no guessing, no backtracking in the solver
- **Production-quality implementations**: Every technique finder is tested in isolation and integration
- **Comprehensive testing**: Individual technique finders, pipeline integration, difficulty analysis, calibration, hint engine — all with vitest
- **Accessibility-first UI**: ARIA, keyboard navigation, reduced motion, screen reader support, focus management
- **Immutable technique finders**: All 11 technique finders are stateless and read-only — they never mutate the board or candidate map
- **Server-authoritative leaderboard**: Username derived from Reddit session, not client input — prevents score spoofing
- **Graceful degradation**: Client-side fallback puzzles when API is unreachable, server-side fallback when generator fails

---

## Roadmap

### Completed phases
- **Phase 1-4**: Core 4×4 game, validation, state management, keyboard input
- **Phase 5**: 9×9 mode, difficulty system, HumanSolver (initial techniques)
- **Phase 6**: Naked Pair, Hidden Pair
- **Phase 7**: Pointing Pair, Claiming Pair
- **Phase 8**: X-Wing, Skyscraper
- **Phase 9**: XY-Wing, Two-String Kite
- **Phase 10**: Swordfish, Expert difficulty, theme system

### Current phase
- **Phase 11**: Intelligent Puzzle Generator — replace retry-based expert generation with deliberate clue selection guided by the HumanSolver during the digging process

### Upcoming phases
- **Phase 12**: W-Wing, Empty Rectangle
- **Phase 13**: XYZ-Wing, Coloring
- **Phase 14**: AIC (Alternating Inference Chains)
- **Phase 15**: Daily Challenges, puzzle seeding

---

## Known Limitations

- **Expert generation is retry-based**: The generator attempts up to 50 random solutions before finding one that scores as Expert. This works but is inefficient — Phase 11 will address this with an intelligent generator.
- **4×4 difficulty granularity**: Only beginner and advanced are supported; finer grading is not meaningful on 16 cells.
- **Expert classification ceiling**: Current Expert scores (76-88) come from accumulated lower techniques rather than advanced fish. True Expert pattern (Swordfish, Jellyfish) will require the intelligent generator to deliberately induce these patterns.
- **No daily puzzles**: Currently all puzzles are randomly generated; seeded daily puzzles are planned.
- **Client-side fallbacks are static**: The client-side puzzle library has a small number of puzzles per difficulty; expert has none.

---

## Development Notes

### Adding a new technique
To add a new solving technique, you must:

1. Add the technique name to `TECHNIQUES` in `HumanSolverTypes.ts`
2. Implement the finder function in `HumanSolver.ts` with signature `(ctx: HumanSolverContext) => LogicalMove[]`
3. Add its weight to `TECHNIQUE_WEIGHTS` in `DifficultyAnalyzer.ts`
4. Register it in the `FINDERS` array in `HumanSolverPipeline.ts`
5. Add a description to `TechniqueDescriptions.ts`
6. Write tests in `HumanSolver.test.ts` covering: zero cases, one case, multiple cases, edge cases, duplicate prevention, board immutability, candidate map immutability

### Generator dependency on solver
The generator uses `hasUniqueSolution` (backtracking) for uniqueness and `solve()` (human solver) for difficulty analysis. These are independent concerns — do not conflate them.

### Test patterns
- Individual technique finders are tested with known puzzle states (empty, partially filled, edge cases)
- Pipeline tests verify priority ordering and move accumulation
- Generator tests verify solution validity, puzzle consistency, uniqueness, and difficulty matching
- All tests verify immutability of inputs

### File sizes (approximate)
| File | Lines |
|------|-------|
| `src/client/game/game.ts` | 2336 |
| `src/client/game/game.css` | 2116 |
| `src/server/core/HumanSolver.ts` | 1519 |
| `src/server/index.ts` | 961 |
| `src/server/core/SudokuGenerator.ts` | 390 |
| `src/server/core/DifficultyCalibration.ts` | 370 |
| `src/server/core/HumanSolver.test.ts` | 2325 |
| `src/server/core/SudokuGenerator.test.ts` | 519 |
| `src/server/core/DifficultyAnalyzer.test.ts` | 437 |
| `src/server/core/HumanSolverPipeline.test.ts` | 427 |
| `src/server/core/DifficultyCalibration.test.ts` | 446 |
| `src/server/core/HintEngine.test.ts` | 286 |

### Commands
```bash
npm run dev           # Concurrent dev (client + server + playtest)
npm run build         # Build client + server
npm run test          # Run vitest suite
npm run type-check    # Full TypeScript check
npm run deploy        # Build + upload to Devvit
```
