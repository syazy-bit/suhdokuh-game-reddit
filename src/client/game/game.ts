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
  {
    puzzle: [
      [3, 2, 0, 4],
      [0, 4, 3, 0],
      [4, 0, 2, 3],
      [0, 3, 4, 0],
    ],
    solution: [
      [3, 2, 1, 4],
      [1, 4, 3, 2],
      [4, 1, 2, 3],
      [2, 3, 4, 1],
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
    // Fallback should be handled by the backend, but just in case:
    console.warn(
      "[CLIENT] This should not happen - backend should handle fallback",
    );
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
        leaderboard.innerHTML =
          '<p class="error">Failed to load leaderboard</p>';
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
      leaderboard.innerHTML = '<p class="error">Error loading leaderboard</p>';
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

          // Add click handler for selection
          cell.addEventListener("click", () => {
            state.selected = { r, c };
            highlightSelected();
            startTimer();
          });

          // Check for validation errors (conflict with other cells)
          if (value && value !== 0) {
            const isValid = isValidMove(r, c, value);
            if (!isValid) {
              cell.classList.add("conflict");
            }
          }
        }

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
  }

  /**
   * Highlight the currently selected cell
   */
  function highlightSelected(): void {
    const cells = document.querySelectorAll<HTMLDivElement>(".cell");
    cells.forEach((c) => c.classList.remove("selected"));

    if (!state.selected) return;

    const size = getGridSize();
    const index = state.selected.r * size + state.selected.c;
    const cell = cells[index];
    if (cell) {
      cell.classList.add("selected");
    }
  }

  /**
   * Place a number in the selected cell
   */
  function placeNumber(num: number): void {
    if (state.gameWon || !state.selected) return;

    const { r, c } = state.selected;

    // Check if cell is empty (can be edited)
    const puzzleCell = puzzle[r]?.[c];
    if (puzzleCell !== 0) return;

    // Only place if valid
    if (isValidMove(r, c, num)) {
      const gridRow = state.grid[r];
      if (gridRow) {
        gridRow[c] = num;
      }
      state.selected = null;
      renderGrid();

      // Check for win condition
      if (checkWin()) {
        state.gameWon = true;
        stopTimer();
        message.classList.add("success");
        message.textContent = "🎉 You solved the puzzle! Submitting score...";

        // Submit score and load next puzzle
        submitScore().then(() => {
          setTimeout(() => {
            resetPuzzle();
          }, 2000);
        });
      } else {
        startTimer();
        updateMessage("");
      }
    } else {
      // Show validation error
      message.classList.add("error");
      message.textContent = "❌ This number conflicts with another cell!";
      setTimeout(() => {
        message.classList.remove("error");
        updateMessage("");
      }, 2000);
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
        gridRow[c] = 0;
      }
      renderGrid();
      updateMessage("");
    }
  }

  /**
   * Reset the puzzle and load a new one
   */
  async function resetPuzzle(): Promise<void> {
    try {
      // Show loading state
      message.textContent = "Loading puzzle...";
      message.classList.add("info");

      // Get a new puzzle from API (or fallback)
      const currentPuzzle = await fetchPuzzleFromAPI(state.mode);
      puzzle = currentPuzzle.puzzle.map((r) => [...r]);
      solution = currentPuzzle.solution.map((r) => [...r]);

      // Reset game state
      state.grid = puzzle.map((r) => [...r]);
      state.selected = null;
      state.gameWon = false;
      state.startTime = null;
      state.elapsedTime = 0;
      stopTimer();
      message.classList.remove("success", "error", "info");
      updateMessage("");
      if (timer) {
        timer.textContent = "0:00";
      }
      renderGrid();
      renderNumbers();
    } catch (error) {
      console.error("Error loading puzzle:", error);
      message.classList.add("error");
      message.textContent = "Failed to load puzzle. Please try again.";
    }
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
        startTimer();
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

  // Handle keyboard input
  document.addEventListener("keydown", (e) => {
    if (state.gameWon) return;

    const key = e.key;
    const maxNumbers = state.mode === "4x4" ? 4 : 9;

    if (key >= "1" && key <= "9") {
      const num = parseInt(key, 10);
      if (num <= maxNumbers) {
        placeNumber(num);
        startTimer();
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
