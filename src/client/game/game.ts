// Type definitions for type-safe implementation
interface Cell {
  r: number;
  c: number;
}

interface GameState {
  selected: Cell | null;
  grid: number[][];
  gameWon: boolean;
  mode: GameMode;
  startTime: number | null;
  elapsedTime: number;
  username: string; // Store the Reddit username
}

type GameMode = "4x4" | "9x9";

interface PuzzleData {
  puzzle: number[][];
  solution: number[][];
}

interface Move {
  row: number;
  col: number;
  oldValue: number;
  newValue: number;
  selectionBeforeMove: { r: number; c: number } | null;
}

// Fallback puzzle libraries (for when API fails)
const puzzleLibrary4x4: PuzzleData[] = [
  {
    puzzle: [
      [1, 0, 0, 4],
      [0, 4, 1, 0],
      [0, 1, 3, 0],
      [3, 0, 0, 1],
    ],
    solution: [
      [1, 3, 2, 4],
      [2, 4, 1, 3],
      [4, 1, 3, 2],
      [3, 2, 4, 1],
    ],
  },
  {
    puzzle: [
      [2, 0, 0, 1],
      [0, 1, 2, 0],
      [0, 4, 3, 0],
      [3, 0, 0, 4],
    ],
    solution: [
      [2, 3, 4, 1],
      [4, 1, 2, 3],
      [1, 4, 3, 2],
      [3, 2, 1, 4],
    ],
  },
  {
    puzzle: [
      [1, 2, 3, 0],
      [3, 0, 0, 2],
      [2, 0, 0, 3],
      [0, 3, 2, 1],
    ],
    solution: [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1],
    ],
  },
];

// Fallback 9x9 Sudoku puzzles (for when API fails)
const puzzleLibrary9x9: PuzzleData[] = [
  {
    puzzle: [
      [5, 3, 0, 0, 7, 0, 0, 0, 0],
      [6, 0, 0, 1, 9, 5, 0, 0, 0],
      [0, 9, 8, 0, 0, 0, 0, 6, 0],
      [8, 0, 0, 0, 6, 0, 0, 0, 3],
      [4, 0, 0, 8, 0, 3, 0, 0, 1],
      [7, 0, 0, 0, 2, 0, 0, 0, 6],
      [0, 6, 0, 0, 0, 0, 2, 8, 0],
      [0, 0, 0, 4, 1, 9, 0, 0, 5],
      [0, 0, 0, 0, 8, 0, 0, 7, 9],
    ],
    solution: [
      [5, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 9],
    ],
  },
  {
    puzzle: [
      [0, 0, 0, 6, 0, 0, 4, 0, 0],
      [7, 0, 0, 0, 0, 3, 6, 0, 0],
      [0, 0, 0, 0, 9, 1, 0, 8, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 5, 0, 1, 8, 0, 0, 0, 3],
      [0, 0, 0, 3, 0, 6, 0, 4, 5],
      [0, 4, 0, 2, 0, 0, 0, 6, 0],
      [9, 0, 3, 0, 0, 0, 0, 0, 0],
      [0, 2, 0, 0, 0, 0, 1, 0, 0],
    ],
    solution: [
      [5, 8, 1, 6, 7, 2, 4, 3, 9],
      [7, 9, 2, 8, 4, 3, 6, 5, 1],
      [3, 6, 4, 5, 9, 1, 7, 8, 2],
      [4, 3, 8, 9, 5, 7, 2, 1, 6],
      [2, 5, 6, 1, 8, 4, 9, 7, 3],
      [1, 7, 9, 3, 2, 6, 8, 4, 5],
      [8, 4, 5, 2, 1, 9, 3, 6, 7],
      [9, 1, 3, 7, 6, 8, 5, 2, 4],
      [6, 2, 7, 4, 3, 5, 1, 9, 8],
    ],
  },
  {
    puzzle: [
      [0, 0, 3, 0, 2, 0, 6, 0, 0],
      [9, 0, 0, 3, 0, 5, 0, 0, 1],
      [0, 0, 1, 8, 0, 6, 4, 0, 0],
      [0, 0, 8, 1, 0, 2, 9, 0, 0],
      [7, 0, 0, 0, 0, 0, 0, 0, 8],
      [0, 0, 6, 7, 0, 8, 2, 0, 0],
      [0, 0, 2, 6, 0, 9, 5, 0, 0],
      [8, 0, 0, 2, 0, 3, 0, 0, 9],
      [0, 0, 5, 0, 1, 0, 3, 0, 0],
    ],
    solution: [
      [4, 8, 3, 9, 2, 1, 6, 5, 7],
      [9, 6, 7, 3, 4, 5, 8, 2, 1],
      [2, 5, 1, 8, 7, 6, 4, 9, 3],
      [5, 4, 8, 1, 3, 2, 9, 7, 6],
      [7, 2, 9, 5, 6, 4, 1, 3, 8],
      [1, 3, 6, 7, 9, 8, 2, 4, 5],
      [3, 7, 2, 6, 8, 9, 5, 1, 4],
      [8, 1, 4, 2, 5, 3, 7, 6, 9],
      [6, 9, 5, 4, 1, 7, 3, 8, 2],
    ],
  },
  {
    puzzle: [
      [0, 2, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 6, 0, 0, 0, 0, 3],
      [0, 7, 4, 0, 8, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 3, 0, 0, 2],
      [0, 8, 0, 0, 4, 0, 0, 1, 0],
      [6, 0, 0, 5, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 0, 7, 8, 0],
      [5, 0, 0, 0, 0, 9, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 4, 0],
    ],
    solution: [
      [1, 2, 6, 4, 3, 7, 9, 5, 8],
      [8, 9, 5, 6, 2, 1, 4, 7, 3],
      [3, 7, 4, 9, 8, 5, 1, 2, 6],
      [4, 5, 7, 1, 9, 3, 8, 6, 2],
      [9, 8, 3, 2, 4, 6, 5, 1, 7],
      [6, 1, 2, 5, 7, 8, 3, 9, 4],
      [2, 6, 9, 3, 1, 4, 7, 8, 5],
      [5, 4, 8, 7, 6, 9, 2, 3, 1],
      [7, 3, 1, 8, 5, 2, 6, 4, 9],
    ],
  },
];

/**
 * Fetch puzzle from backend API
 * Backend handles calling API Ninjas with proper error handling
 */
async function fetchPuzzleFromAPI(mode: GameMode): Promise<PuzzleData> {
  try {
    console.log(`[CLIENT] Requesting ${mode} puzzle from backend...`);

    const response = await fetch("/api/puzzle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode }),
    });

    if (!response.ok) {
      console.error(`[CLIENT] Backend returned status ${response.status}`);
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = (await response.json()) as {
      type: string;
      status: string;
      puzzle: number[][];
      solution: number[][];
      message?: string;
    };

    if (data.status !== "success") {
      console.error(`[CLIENT] Backend error: ${data.message}`);
      throw new Error(data.message || "Unknown backend error");
    }

    if (!data.puzzle || !data.solution) {
      console.error("[CLIENT] Backend returned invalid puzzle/solution");
      throw new Error("Invalid response from backend");
    }

    console.log(
      `[CLIENT] Successfully received ${mode} puzzle from backend`,
      data.message ? `(${data.message})` : "",
    );

    return {
      puzzle: data.puzzle,
      solution: data.solution,
    };
  } catch (error) {
    console.error("[CLIENT] Failed to fetch puzzle from backend:", error);
    // Re-throw so resetPuzzle() can fall back to local puzzle library.
    throw error;
  }
}

/**
 * Get a random puzzle from fallback library
 */
function getRandomFallbackPuzzle(mode: GameMode): PuzzleData {
  const library = mode === "4x4" ? puzzleLibrary4x4 : puzzleLibrary9x9;
  const randomIndex = Math.floor(Math.random() * library.length);
  const selected = library[randomIndex];
  if (!selected) {
    const fallback = library[0];
    if (!fallback) {
      throw new Error("No puzzles available");
    }
    return fallback;
  }
  return selected;
}

document.addEventListener("DOMContentLoaded", () => {
  // Get DOM elements with null checks
  const gridEl = document.getElementById("grid") as HTMLDivElement | null;
  const numbersEl = document.getElementById("numbers") as HTMLDivElement | null;
  const messageEl = document.getElementById("message") as HTMLDivElement | null;
  const resetBtn = document.getElementById(
    "reset-btn",
  ) as HTMLButtonElement | null;
  const modeSelect = document.getElementById(
    "mode-select",
  ) as HTMLSelectElement | null;
  const instructionsEl = document.getElementById(
    "instructions",
  ) as HTMLParagraphElement | null;
  const timerEl = document.getElementById("timer") as HTMLSpanElement | null;
  const leaderboardEl = document.getElementById(
    "leaderboard",
  ) as HTMLDivElement | null;
  const undoBtn = document.getElementById(
    "undo-btn",
  ) as HTMLButtonElement | null;

  // Validate all required elements exist
  if (!gridEl || !numbersEl || !messageEl || !modeSelect || !leaderboardEl) {
    console.error("Required DOM elements not found");
    return;
  }

  // Now we know these are not null
  const grid = gridEl as HTMLDivElement;
  const numbers = numbersEl as HTMLDivElement;
  const message = messageEl as HTMLDivElement;
  const modeSelectElem = modeSelect as HTMLSelectElement;
  const instructions = instructionsEl as HTMLParagraphElement;
  const timer = timerEl as HTMLSpanElement;
  const leaderboard = leaderboardEl as HTMLDivElement;

  // Fetch Reddit username from server
  async function getRedditUsername(): Promise<string> {
    try {
      const response = await fetch("/api/init");
      if (!response.ok) {
        console.warn("Could not fetch Reddit username");
        return "Anonymous Player";
      }
      const data = (await response.json()) as { username?: string };
      return data.username || "Anonymous Player";
    } catch (error) {
      console.warn("Error fetching Reddit username:", error);
      return "Anonymous Player";
    }
  }

  // Game state
  let state: GameState = {
    selected: null,
    grid: [],
    gameWon: false,
    mode: "4x4",
    startTime: null,
    elapsedTime: 0,
    username: "Anonymous Player",
  };

  let puzzle: number[][] = [];
  let solution: number[][] = [];
  let timerInterval: number | null = null;
  let winResetTimeout: number | null = null;
  const moveHistory: Move[] = [];

  /**
   * Get grid size based on mode
   */
  function getGridSize(): number {
    return state.mode === "4x4" ? 4 : 9;
  }

  /**
   * Check if a number is valid at a given position
   */
  function isValidMove(row: number, col: number, num: number): boolean {
    const size = getGridSize();
    const boxSize = state.mode === "4x4" ? 2 : 3;

    // Check row
    for (let c = 0; c < size; c++) {
      const cell = state.grid[row]?.[c];
      if (c !== col && cell === num) {
        return false;
      }
    }

    // Check column
    for (let r = 0; r < size; r++) {
      const cell = state.grid[r]?.[col];
      if (r !== row && cell === num) {
        return false;
      }
    }

    // Check box
    const boxRow = Math.floor(row / boxSize) * boxSize;
    const boxCol = Math.floor(col / boxSize) * boxSize;
    for (let r = boxRow; r < boxRow + boxSize; r++) {
      for (let c = boxCol; c < boxCol + boxSize; c++) {
        const cell = state.grid[r]?.[c];
        if ((r !== row || c !== col) && cell === num) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if the entire puzzle is solved correctly
   */
  function checkWin(): boolean {
    const size = getGridSize();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const gridCell = state.grid[r]?.[c];
        const solCell = solution[r]?.[c];
        if (gridCell !== solCell) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Format elapsed time as MM:SS
   */
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  /**
   * Start the game timer
   */
  function startTimer(): void {
    if (timerInterval !== null) return;

    state.startTime = Date.now() - state.elapsedTime * 1000;

    timerInterval = window.setInterval(() => {
      if (state.startTime !== null) {
        state.elapsedTime = Math.floor((Date.now() - state.startTime) / 1000);
        if (timer) {
          timer.textContent = formatTime(state.elapsedTime);
        }
      }
    }, 1000);
  }

  /**
   * Stop the game timer
   */
  function stopTimer(): void {
    if (timerInterval !== null) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  /**
   * Submit score to leaderboard
   */
  async function submitScore(): Promise<void> {
    try {
      const response = await fetch("/api/submit-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // username is NOT sent — the server resolves it from the
          // authenticated Reddit session to prevent spoofing.
          mode: state.mode,
          time: state.elapsedTime,
        }),
      });

      if (response.ok) {
        await loadLeaderboard();
      } else {
        const data = await response.json().catch(() => null);
        console.warn("Score submission rejected:", data?.message ?? response.status);
      }
    } catch (error) {
      console.error("Error submitting score:", error);
    }
  }

  /**
   * Load and display leaderboard
   */
  async function loadLeaderboard(): Promise<void> {
    try {
      const response = await fetch(
        `/api/leaderboard?mode=${state.mode}&limit=10`,
      );
      if (!response.ok) {
        const text = await response.text().catch(() => "No response text");
        leaderboard.innerHTML =
          `<p class="error">Failed to load leaderboard: ${response.status} ${text}</p>`;
        return;
      }

      const data = await response.json();
      const entries = data.entries || [];

      if (entries.length === 0) {
        leaderboard.innerHTML =
          '<p class="empty">No scores yet. Be the first!</p>';
        return;
      }

      let html =
        '<table class="leaderboard-table"><thead><tr><th>#</th><th>Player</th><th>Time</th></tr></thead><tbody>';
      entries.forEach((entry: any, index: number) => {
        html += `<tr><td>${index + 1}</td><td>${escapeHtml(
          entry.username,
        )}</td><td>${formatTime(entry.time)}</td></tr>`;
      });
      html += "</tbody></table>";

      leaderboard.innerHTML = html;
    } catch (error) {
      console.error("Error loading leaderboard:", error);
      leaderboard.innerHTML = `<p class="error">Error loading leaderboard: ${error instanceof Error ? error.message : String(error)}</p>`;
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Render the grid with cells
   */
  function renderGrid(): void {
    const size = getGridSize();
    const boxSize = state.mode === "4x4" ? 2 : 3;

    grid.innerHTML = "";
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${size}, 1fr)`;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.row = r.toString();
        cell.dataset.col = c.toString();

        // Check if cell is locked (from original puzzle)
        const puzzleCell = puzzle[r]?.[c];
        const isLocked = puzzleCell !== 0;

        if (isLocked) {
          cell.textContent = puzzleCell?.toString() ?? "";
          cell.classList.add("locked");
        } else {
          // Editable cell
          const value = state.grid[r]?.[c];
          if (value && value !== 0) {
            cell.textContent = value.toString();
          }

          // Check for validation errors (conflict with other cells)
          if (value && value !== 0) {
            const isValid = isValidMove(r, c, value);
            if (!isValid) {
              cell.classList.add("conflict");
            }
          }
        }

        // All cells can be selected for highlighting. Locked clues remain
        // protected from edits by placeNumber() and clearCell().
        cell.addEventListener("click", () => {
          state.selected = { r, c };
          highlightSelected();
        });

        // Highlight if selected
        if (
          state.selected &&
          state.selected.r === r &&
          state.selected.c === c
        ) {
          cell.classList.add("selected");
        }

        // Add box border styling
        const isBoxRight = (c + 1) % boxSize === 0 && c !== size - 1;
        const isBoxBottom = (r + 1) % boxSize === 0 && r !== size - 1;
        if (isBoxRight || isBoxBottom) {
          cell.classList.add("box-border");
          if (isBoxRight) cell.classList.add("box-right");
          if (isBoxBottom) cell.classList.add("box-bottom");
        }

        grid.appendChild(cell);
      }
    }

    highlightSelected();
  }

  /**
   * Highlight the currently selected cell
   */
  function highlightSelected(): void {
    const cells = document.querySelectorAll<HTMLDivElement>(".cell");
    cells.forEach((cell) => cell.classList.remove("selected", "related"));

    if (!state.selected) return;

    const size = getGridSize();
    const boxSize = state.mode === "4x4" ? 2 : 3;
    const selectedRow = state.selected.r;
    const selectedCol = state.selected.c;
    const selectedBoxRow = Math.floor(selectedRow / boxSize);
    const selectedBoxCol = Math.floor(selectedCol / boxSize);

    cells.forEach((cell, index) => {
      const row = Math.floor(index / size);
      const col = index % size;
      const isSelected = row === selectedRow && col === selectedCol;
      const isSameRow = row === selectedRow;
      const isSameColumn = col === selectedCol;
      const isSameBox =
        Math.floor(row / boxSize) === selectedBoxRow &&
        Math.floor(col / boxSize) === selectedBoxCol;

      if (isSelected) {
        cell.classList.add("selected");
      } else if (isSameRow || isSameColumn || isSameBox) {
        cell.classList.add("related");
      }
    });
  }

  /**
   * Place a number in the selected cell.
   *
   * Conflicting placements are allowed — they are written to the grid and
   * visually marked with the `conflict` CSS class by renderGrid(). The player
   * must clear/correct conflicting cells before checkWin() can return true.
   */
  function placeNumber(num: number): void {
    if (state.gameWon || !state.selected) return;

    const { r, c } = state.selected;

    // Locked cells (given clues) may never be overwritten.
    const puzzleCell = puzzle[r]?.[c];
    if (puzzleCell !== 0) return;

    // Record move before changing the grid
    const gridRow = state.grid[r];
    if (gridRow) {
      const oldValue = gridRow[c] ?? 0;
      if (oldValue === num) return;
      moveHistory.push({
        row: r,
        col: c,
        oldValue,
        newValue: num,
        selectionBeforeMove: state.selected ? { ...state.selected } : null,
      });
      gridRow[c] = num;
    }

    // Start the timer on the first placement (valid or conflicting).
    // startTimer() is a no-op if the timer is already running.
    startTimer();

    renderGrid();
    updateUndoButton();

    // Check for win condition.
    // checkWin() compares state.grid against the solution array, so a board
    // containing any conflicting or incorrect value will never return true.
    if (checkWin()) {
      state.gameWon = true;
      stopTimer();
      message.classList.add("success");
      message.textContent = "🎉 You solved the puzzle! Submitting score...";

      // Submit score and load next puzzle
      submitScore().then(() => {
        if (state.gameWon) {
          winResetTimeout = window.setTimeout(() => {
            resetPuzzle();
          }, 2000);
        }
      });
    } else {
      updateMessage("");
    }
  }

  /**
   * Clear the selected cell
   */
  function clearCell(): void {
    if (!state.selected) return;

    const { r, c } = state.selected;
    const puzzleCell = puzzle[r]?.[c];
    if (puzzleCell === 0) {
      const gridRow = state.grid[r];
      if (gridRow) {
        const oldValue = gridRow[c] ?? 0;
        if (oldValue === 0) return;
        moveHistory.push({
          row: r,
          col: c,
          oldValue,
          newValue: 0,
          selectionBeforeMove: state.selected ? { ...state.selected } : null,
        });
        gridRow[c] = 0;
      }
      renderGrid();
      updateUndoButton();
      updateMessage("");
    }
  }

  function updateUndoButton(): void {
    if (undoBtn) {
      undoBtn.disabled = moveHistory.length === 0;
    }
  }

  function undoMove(): void {
    if (moveHistory.length === 0) return;

    const move = moveHistory.pop()!;
    const gridRow = state.grid[move.row];
    if (gridRow) {
      gridRow[move.col] = move.oldValue;
    }

    state.selected = move.selectionBeforeMove;

    if (state.gameWon) {
      state.gameWon = false;
      message.classList.remove("success");
      message.textContent = "";
      if (winResetTimeout !== null) {
        clearTimeout(winResetTimeout);
        winResetTimeout = null;
      }
    }

    renderGrid();
    highlightSelected();
    updateUndoButton();
  }

  /**
   * Reset the puzzle and load a new one.
   *
   * Two-layer fallback strategy:
   *   1. Try the server-side /api/puzzle endpoint (which itself falls back
   *      to server-side static puzzles if the generator fails).
   *   2. If the entire API call fails (network error, server down, etc.),
   *      silently use a random puzzle from the client-side library so the
   *      user can always play without a page refresh.
   */
  async function resetPuzzle(): Promise<void> {
    // Show loading state
    message.classList.remove("success", "error");
    message.classList.add("info");
    message.textContent = "Loading puzzle...";

    let currentPuzzle: PuzzleData;
    let usingFallback = false;

    try {
      currentPuzzle = await fetchPuzzleFromAPI(state.mode);
    } catch (apiError) {
      // API is unreachable or returned an error — use local fallback.
      console.warn(
        `[CLIENT] API unavailable for ${state.mode}, using local fallback:`,
        apiError instanceof Error ? apiError.message : apiError,
      );
      try {
        currentPuzzle = getRandomFallbackPuzzle(state.mode);
        usingFallback = true;
      } catch (fallbackError) {
        // Both API and local library failed — this should never happen.
        console.error("[CLIENT] Local fallback also failed:", fallbackError);
        message.classList.remove("info");
        message.classList.add("error");
        message.textContent = "Failed to load puzzle. Please refresh the page.";
        return;
      }
    }

    // Apply the puzzle (from API or local fallback)
    puzzle = currentPuzzle.puzzle.map((r) => [...r]);
    solution = currentPuzzle.solution.map((r) => [...r]);

    // Reset game state
    state.grid = puzzle.map((r) => [...r]);
    state.selected = null;
    state.gameWon = false;
    state.startTime = null;
    state.elapsedTime = 0;
    stopTimer();
    moveHistory.length = 0;
    if (winResetTimeout !== null) {
      clearTimeout(winResetTimeout);
      winResetTimeout = null;
    }

    message.classList.remove("success", "error", "info");
    if (usingFallback) {
      // Let the user know they are in offline mode — non-intrusive.
      message.classList.add("info");
      message.textContent = "Playing in offline mode.";
      // Clear it after 3 s so it doesn't linger during gameplay.
      setTimeout(() => {
        message.classList.remove("info");
        updateMessage("");
      }, 3000);
    } else {
      updateMessage("");
    }

    if (timer) {
      timer.textContent = "0:00";
    }
    renderGrid();
    renderNumbers();
    updateUndoButton();
  }

  /**
   * Update message display
   */
  function updateMessage(text: string): void {
    if (!text) {
      message.textContent = "";
      message.classList.remove("error", "success");
    }
  }

  /**
   * Render number buttons
   */
  function renderNumbers(): void {
    const maxNumbers = state.mode === "4x4" ? 4 : 9;
    numbers.innerHTML = "";

    // Number buttons
    for (let n = 1; n <= maxNumbers; n++) {
      const btn = document.createElement("button");
      btn.className = "number-btn";
      btn.textContent = n.toString();
      btn.addEventListener("click", () => {
        placeNumber(n);
        // Timer is started inside placeNumber() on the first valid placement.
      });
      numbers.appendChild(btn);
    }

    // Clear button
    const clearBtn = document.createElement("button");
    clearBtn.className = "clear-btn";
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", clearCell);
    numbers.appendChild(clearBtn);
  }

  /**
   * Handle game mode change
   */
  async function changeGameMode(newMode: GameMode): Promise<void> {
    state.mode = newMode;
    stopTimer();
    if (instructions) {
      instructions.textContent =
        newMode === "4x4"
          ? "Click a cell, then use number buttons or keyboard (1-4) to fill"
          : "Click a cell, then use number buttons or keyboard (1-9) to fill";
    }
    await resetPuzzle();
    await loadLeaderboard();
  }

  // Event listeners
  modeSelectElem.addEventListener("change", (e) => {
    const target = e.target as HTMLSelectElement;
    changeGameMode(target.value as GameMode);
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      resetPuzzle();
    });
  }

  if (undoBtn) {
    undoBtn.addEventListener("click", undoMove);
  }

  function handleArrowKey(key: string): void {
    const size = getGridSize();

    if (!state.selected) {
      state.selected = { r: 0, c: 0 };
      highlightSelected();
      return;
    }

    let { r, c } = state.selected;
    switch (key) {
      case "ArrowUp":    r = Math.max(0, r - 1); break;
      case "ArrowDown":  r = Math.min(size - 1, r + 1); break;
      case "ArrowLeft":  c = Math.max(0, c - 1); break;
      case "ArrowRight": c = Math.min(size - 1, c + 1); break;
    }
    state.selected = { r, c };
    highlightSelected();
  }

  // Handle keyboard input
  document.addEventListener("keydown", (e) => {
    const key = e.key;
    const maxNumbers = state.mode === "4x4" ? 4 : 9;

    // Ctrl+Z / Cmd+Z — allowed even when game is won
    if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      undoMove();
      return;
    }

    if (state.gameWon) return;

    if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") {
      e.preventDefault();
      handleArrowKey(key);
    } else if (key >= "1" && key <= "9") {
      const num = parseInt(key, 10);
      if (num <= maxNumbers) {
        placeNumber(num);
        // Timer is started inside placeNumber() on the first valid placement.
      }
    } else if (key === "Backspace" || key === "Delete") {
      clearCell();
    } else if (key === "Escape") {
      state.selected = null;
      highlightSelected();
    }
  });

  // Initial setup
  (async () => {
    // Fetch Reddit username first
    state.username = await getRedditUsername();

    // Then initialize the game
    await changeGameMode("4x4");
    await loadLeaderboard();
  })();
});
