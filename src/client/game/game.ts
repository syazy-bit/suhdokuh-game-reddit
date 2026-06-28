import type { PlayerStats } from "../../shared/types/api";

const DEFAULT_HINTS = 3;

// Type definitions for type-safe implementation
interface Cell {
  r: number;
  c: number;
}

interface GameState {
  selected: Cell | null;
  grid: number[][];
  notes: Set<number>[][];
  notesMode: boolean;
  gameWon: boolean;
  mode: GameMode;
  difficulty: Difficulty;
  startTime: number | null;
  elapsedTime: number;
  username: string; // Store the Reddit username
  hintsRemaining: number;
}

type GameMode = "4x4" | "9x9";
type Difficulty = "easy" | "medium" | "hard" | "expert";

interface PuzzleData {
  puzzle: number[][];
  solution: number[][];
}

interface ClearedNote {
  r: number;
  c: number;
  val: number;
}

interface Move {
  row: number;
  col: number;
  oldValue: number;
  newValue: number;
  oldNotes: number[];
  newNotes: number[];
  selectionBeforeMove: { r: number; c: number } | null;
  selectionAfterMove: { r: number; c: number } | null;
  completedPuzzle: boolean;
  clearedNotes: ClearedNote[];
}

interface CellRenderEffect {
  cell: { r: number; c: number };
  type: "place" | "hint" | "conflict" | "success";
}



// Fallback puzzle libraries (for when API fails) — bucketed by difficulty
const puzzleLibrary4x4: Record<Difficulty, PuzzleData[]> = {
  expert: [],
  easy: [
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
        [0, 3, 0, 4],
        [4, 0, 3, 0],
        [0, 1, 0, 3],
        [3, 0, 1, 0],
      ],
      solution: [
        [1, 3, 2, 4],
        [4, 2, 3, 1],
        [2, 1, 4, 3],
        [3, 4, 1, 2],
      ],
    },
  ],
  medium: [
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
  ],
  hard: [
    {
      puzzle: [
        [0, 3, 0, 0],
        [0, 0, 0, 1],
        [2, 0, 0, 0],
        [0, 0, 1, 0],
      ],
      solution: [
        [1, 3, 2, 4],
        [4, 2, 3, 1],
        [2, 1, 4, 3],
        [3, 4, 1, 2],
      ],
    },
    {
      puzzle: [
        [0, 0, 3, 0],
        [4, 0, 0, 0],
        [0, 0, 0, 3],
        [0, 1, 0, 0],
      ],
      solution: [
        [1, 2, 3, 4],
        [4, 3, 2, 1],
        [2, 4, 1, 3],
        [3, 1, 4, 2],
      ],
    },
  ],
};

const puzzleLibrary9x9: Record<Difficulty, PuzzleData[]> = {
  expert: [],
  easy: [
    {
      puzzle: [
        [5, 3, 4, 0, 7, 0, 0, 0, 0],
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
  ],
  medium: [
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
  ],
  hard: [
    {
      puzzle: [
        [0, 3, 0, 0, 7, 0, 9, 0, 2],
        [0, 0, 0, 1, 9, 0, 0, 0, 0],
        [0, 0, 8, 0, 4, 0, 0, 6, 7],
        [0, 5, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 8, 0, 0, 0, 0, 1],
        [7, 0, 0, 9, 2, 0, 0, 0, 6],
        [0, 0, 0, 5, 0, 0, 0, 8, 0],
        [2, 0, 0, 0, 0, 0, 0, 3, 0],
        [3, 0, 0, 0, 0, 6, 0, 0, 0],
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
        [0, 0, 0, 6, 0, 0, 0, 0, 0],
        [7, 9, 2, 0, 0, 0, 0, 5, 0],
        [0, 0, 4, 5, 0, 0, 0, 8, 0],
        [0, 0, 0, 0, 0, 0, 2, 0, 6],
        [0, 5, 0, 0, 0, 0, 9, 7, 0],
        [1, 0, 0, 3, 0, 0, 8, 0, 0],
        [0, 4, 0, 0, 0, 9, 3, 0, 0],
        [0, 0, 3, 0, 0, 0, 0, 0, 0],
        [6, 0, 0, 4, 0, 5, 0, 0, 0],
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
  ],
};

/**
 * Fetch puzzle from backend API
 * Backend handles calling API Ninjas with proper error handling
 */
async function fetchPuzzleFromAPI(mode: GameMode, difficulty: Difficulty): Promise<PuzzleData> {
  try {
    console.log(`[CLIENT] Requesting ${mode} ${difficulty} puzzle from backend...`);

    const response = await fetch("/api/puzzle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode, difficulty }),
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
function getRandomFallbackPuzzle(mode: GameMode, difficulty: Difficulty): PuzzleData {
  const library = mode === "4x4" ? puzzleLibrary4x4 : puzzleLibrary9x9;
  const bucket = library[difficulty];
  const randomIndex = Math.floor(Math.random() * bucket.length);
  const selected = bucket[randomIndex];
  if (!selected) {
    const fallback = bucket[0];
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
  const difficultySelect = document.getElementById(
    "difficulty-select",
  ) as HTMLSelectElement | null;
  const instructionsEl = document.getElementById(
    "instructions",
  ) as HTMLParagraphElement | null;
  const difficultyLabelEl = document.getElementById(
    "difficulty-label",
  ) as HTMLSpanElement | null;
  const timerEl = document.getElementById("timer") as HTMLSpanElement | null;
    const leaderboardEl = document.getElementById(
      "leaderboard",
    ) as HTMLDivElement | null;
    const leaderboardTitleEl = document.getElementById(
      "leaderboard-title",
    ) as HTMLHeadingElement | null;
  const undoBtn = document.getElementById(
    "undo-btn",
  ) as HTMLButtonElement | null;
  const redoBtn = document.getElementById(
    "redo-btn",
  ) as HTMLButtonElement | null;
  const hintBtn = document.getElementById(
    "hint-btn",
  ) as HTMLButtonElement | null;
  const helpBtn = document.getElementById(
    "help-btn",
  ) as HTMLButtonElement | null;
  const helpModal = document.getElementById(
    "help-modal",
  ) as HTMLDivElement | null;
  const closeModalBtn = document.getElementById(
    "close-modal-btn",
  ) as HTMLButtonElement | null;
  const statsBtn = document.getElementById(
    "stats-btn",
  ) as HTMLButtonElement | null;
  const statsModal = document.getElementById(
    "stats-modal",
  ) as HTMLDivElement | null;
  const closeStatsBtn = document.getElementById(
    "close-stats-btn",
  ) as HTMLButtonElement | null;
  const completionDialog = document.getElementById(
    "completion-dialog",
  ) as HTMLDialogElement | null;
  const completionTime = document.getElementById(
    "completion-time",
  ) as HTMLSpanElement | null;
  const completionDifficulty = document.getElementById(
    "completion-difficulty",
  ) as HTMLSpanElement | null;
  const completionHints = document.getElementById(
    "completion-hints",
  ) as HTMLSpanElement | null;
  const completionSubtitle = document.getElementById(
    "completion-subtitle",
  ) as HTMLParagraphElement | null;
  const completionGridSize = document.getElementById(
    "completion-grid-size",
  ) as HTMLSpanElement | null;
  const completionNewBtn = document.getElementById(
    "completion-new-btn",
  ) as HTMLButtonElement | null;
  const completionLbBtn = document.getElementById(
    "completion-lb-btn",
  ) as HTMLButtonElement | null;
  const completionCloseBtn = document.getElementById(
    "completion-close-btn",
  ) as HTMLButtonElement | null;
  const completionDismissBtn = document.getElementById(
    "completion-dismiss-btn",
  ) as HTMLButtonElement | null;
  const completionBadgeContainer = document.getElementById(
    "completion-badge-container",
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
  const leaderboardTitle = leaderboardTitleEl as HTMLHeadingElement;

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
    notes: [],
    notesMode: false,
    gameWon: false,
    mode: "4x4",
    difficulty: "medium",
    startTime: null,
    elapsedTime: 0,
    username: "Anonymous Player",
    hintsRemaining: DEFAULT_HINTS,
  };

  let puzzle: number[][] = [];
  let solution: number[][] = [];
  let timerInterval: number | null = null;
  let winResetTimeout: number | null = null;
  const moveHistory: Move[] = [];
  const redoHistory: Move[] = [];
  let renderEffect: CellRenderEffect | null = null;
  let isHelpOpen = false;
  let isStatsOpen = false;
  let notesBtn: HTMLButtonElement | null = null;
  let previousFocusedElement: HTMLElement | null = null;

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
   * Format cumulative play time into readable text
   */
  function formatPlayTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
    }
    return `${minutes}m ${secs.toString().padStart(2, "0")}s`;
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
   * Show the completion dialog with final puzzle stats.
   * Presentation-only — no game logic, no network requests.
   */
  function showCompletionDialog(): void {
    if (!completionDialog) return;

    const modeDisplay = state.mode === "4x4" ? "4×4" : "9×9";
    const difficultyDisplay =
      state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1);

    if (completionSubtitle) {
      completionSubtitle.textContent = `${modeDisplay} • ${difficultyDisplay}`;
    }
    if (completionTime) {
      completionTime.textContent = formatPlayTime(state.elapsedTime);
    }
    if (completionDifficulty) {
      completionDifficulty.textContent = difficultyDisplay;
    }
    if (completionGridSize) {
      completionGridSize.textContent = modeDisplay;
    }
    const usedHints = DEFAULT_HINTS - state.hintsRemaining;
    if (completionHints) {
      completionHints.textContent = `${usedHints} / ${DEFAULT_HINTS}`;
    }
    if (completionBadgeContainer) {
      completionBadgeContainer.classList.toggle("visible", usedHints === 0);
    }

    completionDialog.showModal();
    completionNewBtn?.focus();
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
          difficulty: state.difficulty,
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
   * Update the leaderboard section title based on current game state
   */
  function updateLeaderboardTitle(): void {
    if (leaderboardTitle) {
      const modeDisplay = state.mode === "4x4" ? "4×4" : "9×9";
      const difficultyDisplay =
        state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1);
      leaderboardTitle.textContent =
        `🏆 ${modeDisplay} ${difficultyDisplay} Leaderboard`;
    }
  }

  function updateDifficultyDisplay(): void {
    if (difficultyLabelEl) {
      const display = state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1);
      difficultyLabelEl.textContent = `Difficulty: ${display}`;
    }
  }

  /**
   * Build a skeleton table that reserves the leaderboard layout during loading.
   * Three rows of muted, breathing blocks match the real table structure.
   */
  function getLeaderboardSkeleton(): string {
    const rows = Array.from({ length: 3 }, () => `
          <tr>
            <td><div class="skeleton-block skeleton-breathe" style="height:1em;width:24px;margin:0 auto;"></div></td>
            <td><div class="skeleton-block skeleton-breathe" style="height:1em;width:60%;"></div></td>
            <td><div class="skeleton-block skeleton-breathe" style="height:1em;width:50px;margin-left:auto;"></div></td>
          </tr>`).join("");
    return `
      <table class="leaderboard-table" aria-hidden="true">
        <thead>
          <tr><th>#</th><th>Player</th><th>Time</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  /**
   * Load and display leaderboard
   */
  async function loadLeaderboard(): Promise<void> {
    leaderboard.innerHTML = getLeaderboardSkeleton();
    leaderboard.setAttribute("aria-busy", "true");

    try {
      const response = await fetch(
        `/api/leaderboard?mode=${state.mode}&difficulty=${state.difficulty}&limit=10`,
      );
      if (!response.ok) {
        leaderboard.innerHTML =
          '<p class="unavailable-state">Leaderboard currently unavailable.</p>';
        return;
      }

      const data = await response.json();
      const entries = data.entries || [];

      updateLeaderboardTitle();

      if (entries.length === 0) {
        leaderboard.innerHTML =
          '<p class="empty-state">This puzzle awaits its first solution.</p>';
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
      leaderboard.innerHTML = '<p class="unavailable-state">Leaderboard currently unavailable.</p>';
    } finally {
      leaderboard.removeAttribute("aria-busy");
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

  function arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /**
   * Render the grid with cells
   */
  function getCellDescription(r: number, c: number): string {
    const row = r + 1;
    const col = c + 1;
    const puzzleCell = puzzle[r]?.[c];
    const isLocked = puzzleCell !== 0;
    let desc = `Row ${row}, Column ${col}. `;

    if (isLocked) {
      desc += "Locked. ";
      desc += `Value ${puzzleCell}.`;
    } else {
      desc += "Editable. ";
      const value = state.grid[r]?.[c];
      if (value && value !== 0) {
        desc += `Value ${value}.`;
        const isValid = isValidMove(r, c, value);
        if (!isValid) {
          desc += " Conflict.";
        }
      } else {
        const cellNotes = state.notes[r]?.[c];
        if (cellNotes && cellNotes.size > 0) {
          const sortedNotes = Array.from(cellNotes).sort((a, b) => a - b);
          desc += "Empty. Notes: " + sortedNotes.join(", ") + ".";
        } else {
          desc += "Empty.";
        }
      }
    }
    return desc;
  }

  function renderGrid(): void {
    const size = getGridSize();
    const boxSize = state.mode === "4x4" ? 2 : 3;

    grid.innerHTML = "";
    grid.className = "grid";
    grid.classList.add(`grid-${state.mode}`);
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${size}, 1fr)`;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.row = r.toString();
        cell.dataset.col = c.toString();
        cell.id = `cell-${r}-${c}`;
        cell.role = "gridcell";
        cell.setAttribute("aria-label", getCellDescription(r, c));

        // Check if cell is locked (from original puzzle)
        const puzzleCell = puzzle[r]?.[c];
        const isLocked = puzzleCell !== 0;

        if (isLocked) {
          const valueSpan = document.createElement("span");
          valueSpan.className = "value";
          valueSpan.textContent = puzzleCell?.toString() ?? "";
          cell.appendChild(valueSpan);
          cell.classList.add("locked");
        } else {
          cell.replaceChildren();
          const value = state.grid[r]?.[c];
          if (value && value !== 0) {
            const valueSpan = document.createElement("span");
            valueSpan.className = "value";
            valueSpan.textContent = value.toString();
            const effect = renderEffect;
            if (effect && effect.cell.r === r && effect.cell.c === c) {
              if (effect.type === "hint") {
                valueSpan.classList.add("value-pop");
                cell.classList.add("hint-flash");
              } else if (effect.type === "place") {
                valueSpan.classList.add("value-pop");
              } else if (effect.type === "conflict") {
                valueSpan.classList.add("value-shake");
              } else if (effect.type === "success") {
                valueSpan.classList.add("value-success");
              }
            }
            cell.appendChild(valueSpan);
          } else {
            const cellNotes = state.notes[r]?.[c];
            if (cellNotes && cellNotes.size > 0) {
              const notesGrid = document.createElement("div");
              notesGrid.className = "notes-grid";
              const gridSize = getGridSize();
              const cols = gridSize === 9 ? 3 : 2;
              notesGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
              notesGrid.style.gridTemplateRows = `repeat(${cols}, 1fr)`;

              for (let n = 1; n <= gridSize; n++) {
                const noteEl = document.createElement("span");
                noteEl.className = "note";
                if (cellNotes.has(n)) {
                  noteEl.textContent = n.toString();
                }
                notesGrid.appendChild(noteEl);
              }
              cell.appendChild(notesGrid);
            }
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
          if (state.gameWon) return;
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
          cell.setAttribute("aria-selected", "true");
        } else {
          cell.setAttribute("aria-selected", "false");
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
    renderEffect = null;
  }

  /**
   * Highlight the currently selected cell
   */
  function updateActiveDescendant(): void {
    if (state.selected) {
      grid.setAttribute("aria-activedescendant", `cell-${state.selected.r}-${state.selected.c}`);
    } else {
      grid.removeAttribute("aria-activedescendant");
    }
  }

  function highlightSelected(): void {
    const cells = document.querySelectorAll<HTMLDivElement>(".cell");

    if (!state.selected) {
      cells.forEach((cell) => {
        cell.classList.remove("selected", "same-row", "same-column", "same-box", "same-number");
        cell.setAttribute("aria-selected", "false");
      });
      updateActiveDescendant();
      return;
    }

    const size = getGridSize();
    const boxSize = state.mode === "4x4" ? 2 : 3;
    const selectedRow = state.selected.r;
    const selectedCol = state.selected.c;
    const selectedBoxRow = Math.floor(selectedRow / boxSize);
    const selectedBoxCol = Math.floor(selectedCol / boxSize);
    const selectedValue = state.grid[selectedRow]?.[selectedCol] ?? 0;

    cells.forEach((cell, index) => {
      cell.classList.remove("selected", "same-row", "same-column", "same-box", "same-number");
      cell.setAttribute("aria-selected", "false");

      const row = Math.floor(index / size);
      const col = index % size;
      const isSelected = row === selectedRow && col === selectedCol;
      const isSameRow = row === selectedRow;
      const isSameColumn = col === selectedCol;
      const isSameBox =
        Math.floor(row / boxSize) === selectedBoxRow &&
        Math.floor(col / boxSize) === selectedBoxCol;
      const cellValue = state.grid[row]?.[col] ?? 0;
      const isSameNumber = selectedValue !== 0 && cellValue === selectedValue && !isSelected;

      if (isSelected) {
        cell.classList.add("selected");
        cell.setAttribute("aria-selected", "true");
      } else {
        if (isSameRow) cell.classList.add("same-row");
        if (isSameColumn) cell.classList.add("same-column");
        if (isSameBox) cell.classList.add("same-box");
        if (isSameNumber) cell.classList.add("same-number");
      }
    });

    updateActiveDescendant();
  }

  function useHint(): void {
    if (state.gameWon) return;

    if (!state.selected) {
      message.className = "message error";
      message.textContent = "Select an empty cell first.";
      return;
    }

    const { r, c } = state.selected;

    const puzzleCell = puzzle[r]?.[c];
    if (puzzleCell !== 0) {
      message.className = "message error";
      message.textContent = "Hints can only be used on editable cells.";
      return;
    }

    const currentValue = state.grid[r]?.[c];
    if (currentValue && currentValue !== 0) {
      message.className = "message error";
      message.textContent = "This cell is already filled.";
      return;
    }

    if (state.hintsRemaining <= 0) {
      message.className = "message error";
      message.textContent = "No hints remaining.";
      return;
    }

    const correctValue = solution[r]?.[c];
    if (!correctValue) return;

    renderEffect = { cell: { r, c }, type: "hint" };
    placeNumber(correctValue);

    state.hintsRemaining--;
    updateHintButton();

    message.className = "message success";
    message.textContent = `💡 Hint used. ${state.hintsRemaining} hint${state.hintsRemaining === 1 ? "" : "s"} remaining.`;
  }

  /**
   * Orchestrates a localized, subtle victory splash originating from the final placed cell.
   * Must be called AFTER the native render pipeline has produced the final inactive board.
   */
  function triggerVictoryAnimation(finalCell: { r: number; c: number }): void {
    const MAX_RADIUS = 3;
    const cells = document.querySelectorAll<HTMLDivElement>(".cell");

    cells.forEach(cell => {
      const row = parseInt(cell.dataset.row!);
      const col = parseInt(cell.dataset.col!);
      const distance = Math.abs(row - finalCell.r) + Math.abs(col - finalCell.c);

      if (distance <= MAX_RADIUS) {
        cell.style.setProperty("--victory-delay", `${distance * 35}ms`);
        cell.classList.add("victory-pulse");

        cell.addEventListener("animationend", () => {
          cell.classList.remove("victory-pulse");
          cell.style.removeProperty("--victory-delay");
        }, { once: true });
      }
    });
  }

  /**
   * Find the next empty editable cell after the given position, treating
   * the board as a linear array that wraps to the top.  Returns null when
   * every cell is filled (puzzle complete).
   */
  function findNextEditableCell(
    startRow: number,
    startCol: number,
  ): { r: number; c: number } | null {
    const size = getGridSize();
    const totalCells = size * size;
    const startIndex = startRow * size + startCol;

    for (let i = 1; i <= totalCells; i++) {
      const linearIndex = (startIndex + i) % totalCells;
      const cr = Math.floor(linearIndex / size);
      const cc = linearIndex % size;
      const puzzleCell = puzzle[cr]?.[cc];
      const gridCell = state.grid[cr]?.[cc];
      if (puzzleCell === 0 && (!gridCell || gridCell === 0)) {
        return { r: cr, c: cc };
      }
    }

    return null;
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

    const gridRow = state.grid[r];
    if (!gridRow) return;

    if (state.notesMode) {
      const cellNotes = state.notes[r]?.[c];
      if (!cellNotes) return;

      const oldValue = gridRow[c] ?? 0;
      if (oldValue !== 0) return; // Can't note a filled cell

      const hadNote = cellNotes.has(num);
      const oldNotesArr = Array.from(cellNotes);

      if (hadNote) {
        cellNotes.delete(num);
      } else {
        cellNotes.add(num);
      }

      const newNotesArr = Array.from(cellNotes);
      if (arraysEqual(oldNotesArr, newNotesArr)) return;

      redoHistory.length = 0;
      moveHistory.push({
        row: r,
        col: c,
        oldValue: 0,
        newValue: 0,
        oldNotes: oldNotesArr,
        newNotes: newNotesArr,
        selectionBeforeMove: state.selected ? { ...state.selected } : null,
        selectionAfterMove: state.selected ? { ...state.selected } : null,
        completedPuzzle: false,
        clearedNotes: [],
      });

      startTimer();
      renderGrid();
      updateUndoButton();
      updateRedoButton();
      return;
    }

    // Normal mode: place number
    let isWon = false;
    if (gridRow) {
      const oldValue = gridRow[c] ?? 0;
      if (oldValue === num) return;
      const oldNotesArr = Array.from(state.notes[r]?.[c] ?? []);

      gridRow[c] = num;
      state.notes[r]![c]!.clear();

      // Intelligent note cleanup — only for objectively valid placements.
      // Removes the placed number from pencil marks in the same row,
      // column, and box. Invalid/conflicting placements are treated as
      // deliberate mistakes and must not destroy the player's notes.
      const clearedNotes: ClearedNote[] = [];
      if (isValidMove(r, c, num)) {
        const size = getGridSize();
        const boxSize = state.mode === "4x4" ? 2 : 3;
        const seen = new Set<string>();

        const cleanCell = (cr: number, cc: number): void => {
          if (cr === r && cc === c) return;
          const key = `${cr},${cc}`;
          if (seen.has(key)) return;
          seen.add(key);
          const cellNotes = state.notes[cr]?.[cc];
          if (cellNotes?.has(num)) {
            cellNotes.delete(num);
            clearedNotes.push({ r: cr, c: cc, val: num });
          }
        };

        for (let i = 0; i < size; i++) cleanCell(r, i);
        for (let i = 0; i < size; i++) cleanCell(i, c);
        const boxRow = Math.floor(r / boxSize) * boxSize;
        const boxCol = Math.floor(c / boxSize) * boxSize;
        for (let br = boxRow; br < boxRow + boxSize; br++) {
          for (let bc = boxCol; bc < boxCol + boxSize; bc++) {
            cleanCell(br, bc);
          }
        }
      }

      redoHistory.length = 0;
      isWon = checkWin();
      const nextSelection = isWon
        ? null
        : findNextEditableCell(r, c) ?? state.selected;

      moveHistory.push({
        row: r,
        col: c,
        oldValue,
        newValue: num,
        oldNotes: oldNotesArr,
        newNotes: [],
        selectionBeforeMove: state.selected ? { ...state.selected } : null,
        selectionAfterMove: nextSelection,
        completedPuzzle: isWon,
        clearedNotes,
      });

      // Apply auto-advance to live state before render.
      // On the winning move, stay put — the victory handler sets
      // state.selected = null independently.
      if (!isWon) {
        state.selected = nextSelection;
      }
    }

    // Start the timer on the first placement (valid or conflicting).
    // startTimer() is a no-op if the timer is already running.
    startTimer();

    renderEffect = {
      cell: { r, c },
      type: isValidMove(r, c, num) ? "success" : "conflict",
    };
    renderGrid();
    updateUndoButton();
    updateRedoButton();

    if (isWon) {
      state.gameWon = true;
      stopTimer();

      // 1. Deactivate the board state
      state.selected = null;

      // 2. Re-run the native pipeline to produce the pristine inactive board
      // (This inherently destroys all cursors, hints, and crosshairs)
      renderGrid();

      // 3. Schedule the visual overlay on the next frame so the DOM is settled
      requestAnimationFrame(() => {
        triggerVictoryAnimation({ r, c });
      });

      message.classList.add("success");
      message.textContent = "🎉 Puzzle complete.";

      // Submit score and refresh leaderboard in the background.
      // Decoupled from the dialog — success/failure does not block UI.
      submitScore();

      // Show the completion dialog after the victory animation plays.
      // The solved board remains visible until the player acts.
      winResetTimeout = window.setTimeout(() => {
        showCompletionDialog();
      }, 1500);
    } else {
      updateMessage("");
    }
  }

  /**
   * Clear the selected cell
   */
  function clearCell(): void {
    if (!state.selected) return;
    if (state.gameWon) return;

    const { r, c } = state.selected;
    const puzzleCell = puzzle[r]?.[c];
    if (puzzleCell !== 0) return;

    const gridRow = state.grid[r];
    if (!gridRow) return;

    const oldValue = gridRow[c] ?? 0;
    const cellNotes = state.notes[r]?.[c];

    if (oldValue !== 0) {
      // Cell has a value — clear it
      redoHistory.length = 0;
      moveHistory.push({
        row: r,
        col: c,
        oldValue,
        newValue: 0,
        oldNotes: Array.from(cellNotes ?? []),
        newNotes: Array.from(cellNotes ?? []),
        selectionBeforeMove: state.selected ? { ...state.selected } : null,
        selectionAfterMove: state.selected ? { ...state.selected } : null,
        completedPuzzle: false,
        clearedNotes: [],
      });
      gridRow[c] = 0;
      renderGrid();
      updateUndoButton();
      updateRedoButton();
      updateMessage("");
    } else if (cellNotes && cellNotes.size > 0) {
      // Cell has notes but no value — clear notes
      const oldNotesArr = Array.from(cellNotes);
      redoHistory.length = 0;
      moveHistory.push({
        row: r,
        col: c,
        oldValue: 0,
        newValue: 0,
        oldNotes: oldNotesArr,
        newNotes: [],
        selectionBeforeMove: state.selected ? { ...state.selected } : null,
        selectionAfterMove: state.selected ? { ...state.selected } : null,
        completedPuzzle: false,
        clearedNotes: [],
      });
      cellNotes.clear();
      renderGrid();
      updateUndoButton();
      updateRedoButton();
      updateMessage("");
    }
  }

  function updateUndoButton(): void {
    if (undoBtn) {
      undoBtn.disabled = moveHistory.length === 0;
    }
  }

  function updateRedoButton(): void {
    if (redoBtn) {
      redoBtn.disabled = redoHistory.length === 0;
    }
  }

  /**
   * Redo the last undone move by replaying the recorded transaction.
   * History is replayed, never recomputed — no game logic executes.
   */
  function redoMove(): void {
    if (redoHistory.length === 0) return;

    const move = redoHistory.pop()!;

    // Restore grid value
    const gridRow = state.grid[move.row];
    if (gridRow) {
      gridRow[move.col] = move.newValue;
    }

    // Restore notes for this cell
    const notesRow = state.notes[move.row];
    if (notesRow) {
      notesRow[move.col] = new Set(move.newNotes);
    }

    // Re-apply auto-cleaned notes (undo restored them, redo removes them again)
    if (move.clearedNotes.length > 0) {
      for (const cn of move.clearedNotes) {
        const cellNotes = state.notes[cn.r]?.[cn.c];
        if (cellNotes) {
          cellNotes.delete(cn.val);
        }
      }
    }

    state.selected = move.selectionAfterMove;

    moveHistory.push(move);

    // Restore victory state if the move completed the puzzle
    if (move.completedPuzzle) {
      state.gameWon = true;
      stopTimer();
      state.selected = null;
      renderGrid();
      requestAnimationFrame(() => {
        triggerVictoryAnimation({ r: move.row, c: move.col });
      });
      message.classList.add("success");
      message.textContent = "🎉 Puzzle complete.";
      // Score was already submitted during the original placement.
      // No duplicate network request.
      winResetTimeout = window.setTimeout(() => {
        showCompletionDialog();
      }, 1500);
    } else {
      renderEffect = { cell: { r: move.row, c: move.col }, type: "place" };
      renderGrid();
      highlightSelected();
    }

    updateUndoButton();
    updateRedoButton();
  }

  function updateHintButton(): void {
    if (!hintBtn) return;
    if (state.hintsRemaining === 0) {
      hintBtn.disabled = true;
      hintBtn.textContent = "💡 ×0";
      hintBtn.setAttribute("aria-label", "No hints remaining");
    } else {
      hintBtn.disabled = false;
      hintBtn.textContent = `💡 ×${state.hintsRemaining}`;
      hintBtn.setAttribute(
        "aria-label",
        `${state.hintsRemaining} hint${state.hintsRemaining === 1 ? "" : "s"} remaining`,
      );
    }
  }

  function undoMove(): void {
    if (moveHistory.length === 0) return;

    const move = moveHistory.pop()!;
    redoHistory.push(move);
    const gridRow = state.grid[move.row];
    if (gridRow) {
      gridRow[move.col] = move.oldValue;
    }

    const notesRow = state.notes[move.row];
    if (notesRow) {
      notesRow[move.col] = new Set(move.oldNotes);
    }

    // Restore any notes that were auto-cleaned by intelligent notes
    if (move.clearedNotes.length > 0) {
      for (const cn of move.clearedNotes) {
        const cellNotes = state.notes[cn.r]?.[cn.c];
        if (cellNotes) {
          cellNotes.add(cn.val);
        }
      }
    }

    state.selected = move.selectionBeforeMove;

    if (state.gameWon) {
      state.gameWon = false;
      completionDialog?.close();
      message.classList.remove("success");
      message.textContent = "";
      if (winResetTimeout !== null) {
        clearTimeout(winResetTimeout);
        winResetTimeout = null;
      }
      // Resume the timer from the stored elapsed time.
      // startTimer() recalculates the virtual startTime from
      // state.elapsedTime, so it correctly continues counting.
      startTimer();
    }

    renderEffect = { cell: { r: move.row, c: move.col }, type: "place" };
    renderGrid();
    highlightSelected();
    updateUndoButton();
    updateRedoButton();
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
    // Close any open completion dialog
    completionDialog?.close();

    // Show loading state
    message.classList.remove("success", "error");
    message.classList.add("info");
    message.textContent = "Loading puzzle...";

    let currentPuzzle: PuzzleData;
    let usingFallback = false;

    try {
      currentPuzzle = await fetchPuzzleFromAPI(state.mode, state.difficulty);
    } catch (apiError) {
      // API is unreachable or returned an error — use local fallback.
      console.warn(
        `[CLIENT] API unavailable for ${state.mode}, using local fallback:`,
        apiError instanceof Error ? apiError.message : apiError,
      );
      try {
        currentPuzzle = getRandomFallbackPuzzle(state.mode, state.difficulty);
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
    state.notes = Array.from({ length: puzzle.length }, () =>
      Array.from({ length: puzzle.length }, () => new Set<number>())
    );
    state.notesMode = false;
    state.selected = null;
    state.gameWon = false;
    state.hintsRemaining = DEFAULT_HINTS;
    state.startTime = null;
    state.elapsedTime = 0;
    stopTimer();
    moveHistory.length = 0;
    redoHistory.length = 0;
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

    updateDifficultyDisplay();

    if (timer) {
      timer.textContent = "0:00";
    }
    renderGrid();
    renderNumbers();
    updateUndoButton();
    updateRedoButton();
    updateHintButton();
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

    // Notes toggle button
    const nBtn = document.createElement("button");
    nBtn.className = state.notesMode ? "notes-btn active" : "notes-btn";
    nBtn.textContent = "✏️ Notes";
    nBtn.setAttribute("aria-pressed", state.notesMode ? "true" : "false");
    nBtn.addEventListener("click", toggleNotesMode);
    numbers.appendChild(nBtn);
    notesBtn = nBtn;
  }

  function toggleNotesMode(): void {
    state.notesMode = !state.notesMode;
    if (notesBtn) {
      notesBtn.className = state.notesMode ? "notes-btn active" : "notes-btn";
      notesBtn.setAttribute("aria-pressed", state.notesMode ? "true" : "false");
    }
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

  async function changeDifficulty(newDifficulty: Difficulty): Promise<void> {
    state.difficulty = newDifficulty;
    updateDifficultyDisplay();
    stopTimer();
    await resetPuzzle();
    await loadLeaderboard();
  }

  // Event listeners
  modeSelectElem.addEventListener("change", (e) => {
    const target = e.target as HTMLSelectElement;
    changeGameMode(target.value as GameMode);
  });

  if (difficultySelect) {
    difficultySelect.addEventListener("change", (e) => {
      const target = e.target as HTMLSelectElement;
      changeDifficulty(target.value as Difficulty);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      resetPuzzle();
    });
  }

  if (undoBtn) {
    undoBtn.addEventListener("click", undoMove);
  }

  if (redoBtn) {
    redoBtn.addEventListener("click", redoMove);
  }

  if (hintBtn) {
    hintBtn.addEventListener("click", useHint);
  }

  function closeHelp(): void {
    isHelpOpen = false;
    if (helpModal) {
      helpModal.classList.add("hidden");
    }
    if (previousFocusedElement) {
      previousFocusedElement.focus();
      previousFocusedElement = null;
    }
  }

  if (helpBtn && helpModal) {
    helpBtn.addEventListener("click", () => {
      previousFocusedElement = document.activeElement as HTMLElement | null;
      isHelpOpen = true;
      helpModal.classList.remove("hidden");
      if (closeModalBtn) {
        closeModalBtn.focus();
      }
    });
  }

  if (closeModalBtn && helpModal) {
    closeModalBtn.addEventListener("click", closeHelp);
  }

  if (helpModal) {
    helpModal.addEventListener("click", (e) => {
      if (e.target === helpModal) {
        closeHelp();
      }
    });
  }

  // ── Statistics Modal ────────────────────────────────────────────────

  function closeStats(): void {
    isStatsOpen = false;
    if (statsModal) {
      statsModal.classList.add("hidden");
    }
    if (previousFocusedElement) {
      previousFocusedElement.focus();
      previousFocusedElement = null;
    }
  }

  async function fetchStats(): Promise<PlayerStats | null> {
    try {
      const response = await fetch("/api/stats");
      if (!response.ok) return null;
      const data = await response.json();
      return data.stats || null;
    } catch (error) {
      console.error("Error fetching stats:", error);
      return null;
    }
  }

  function toggleAccordion(headerEl: HTMLElement): void {
    const section = headerEl.closest(".accordion-section");
    if (!section) return;

    const accordion = section.closest(".accordion");
    if (!accordion) return;

    const isActive = section.classList.contains("active");

    accordion.querySelectorAll(".accordion-section").forEach((s) => {
      s.classList.remove("active");
    });

    if (!isActive) {
      section.classList.add("active");
    }
  }

  function renderStatsModal(stats: PlayerStats): void {
    const accordion = document.getElementById("stats-accordion");
    if (!accordion) return;

    if (stats.totalWins === 0) {
      accordion.innerHTML =
        '<p class="empty-state">Your statistics will appear here after you complete your first puzzle.</p>';
      return;
    }

    function recordRow(label: string, value: number | null): string {
      const display = value !== null
        ? formatTime(value)
        : '<span class="stats-record-null">—</span>';
      return `<tr><td>${label}</td><td>${display}</td></tr>`;
    }

    accordion.innerHTML = `
      <div class="accordion-section active">
        <button class="accordion-header" type="button">
          <span class="accordion-icon">▶</span>
          Overall
        </button>
        <div class="accordion-content">
          <table class="stats-table">
            <tr><td>Total Wins</td><td>${stats.totalWins}</td></tr>
            <tr><td>Total Play Time</td><td>${formatPlayTime(stats.totalPlayTime)}</td></tr>
          </table>
        </div>
      </div>
      <div class="accordion-section">
        <button class="accordion-header" type="button">
          <span class="accordion-icon">▶</span>
          Records
        </button>
        <div class="accordion-content">
          <table class="stats-table">
            ${recordRow("4×4 Easy", stats.records["4x4"].easy)}
            ${recordRow("4×4 Medium", stats.records["4x4"].medium)}
            ${recordRow("4×4 Hard", stats.records["4x4"].hard)}
            ${recordRow("9×9 Easy", stats.records["9x9"].easy)}
            ${recordRow("9×9 Medium", stats.records["9x9"].medium)}
            ${recordRow("9×9 Hard", stats.records["9x9"].hard)}
          </table>
        </div>
      </div>
      <div class="accordion-section">
        <button class="accordion-header" type="button">
          <span class="accordion-icon">▶</span>
          Progress
        </button>
        <div class="accordion-content">
          <table class="stats-table">
            <tr><td>4×4 Wins</td><td>${stats.progress["4x4"]}</td></tr>
            <tr><td>9×9 Wins</td><td>${stats.progress["9x9"]}</td></tr>
            <tr><td>Easy Wins</td><td>${stats.progress.easy}</td></tr>
            <tr><td>Medium Wins</td><td>${stats.progress.medium}</td></tr>
            <tr><td>Hard Wins</td><td>${stats.progress.hard}</td></tr>
          </table>
        </div>
      </div>
    `;

    accordion.querySelectorAll(".accordion-header").forEach((header) => {
      header.addEventListener("click", () => {
        toggleAccordion(header as HTMLElement);
      });
    });
  }

  if (statsBtn && statsModal) {
    statsBtn.addEventListener("click", async () => {
      previousFocusedElement = document.activeElement as HTMLElement | null;
      isStatsOpen = true;
      statsModal.classList.remove("hidden");

      // Show a calm placeholder while the (fast) query resolves.
      const accordion = document.getElementById("stats-accordion");
      if (accordion) {
        accordion.innerHTML = '<p class="empty-state">Loading...</p>';
      }

      const stats = await fetchStats();
      if (stats) {
        renderStatsModal(stats);
      } else {
        if (accordion) {
          accordion.innerHTML = '<p class="unavailable-state">Statistics are currently unavailable.</p>';
        }
      }

      if (closeStatsBtn) {
        closeStatsBtn.focus();
      }
    });
  }

  if (closeStatsBtn && statsModal) {
    closeStatsBtn.addEventListener("click", closeStats);
  }

  // ── Completion Dialog Buttons ──────────────────────────────────────

  if (completionNewBtn) {
    completionNewBtn.addEventListener("click", () => {
      completionDialog?.close();
      resetPuzzle();
    });
  }

  if (completionLbBtn) {
    completionLbBtn.addEventListener("click", () => {
      completionDialog?.close();
      const container = document.querySelector(".leaderboard-container");
      if (container) {
        container.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  if (completionCloseBtn) {
    completionCloseBtn.addEventListener("click", () => {
      completionDialog?.close();
    });
  }

  if (completionDismissBtn) {
    completionDismissBtn.addEventListener("click", () => {
      completionDialog?.close();
    });
  }

  if (statsModal) {
    statsModal.addEventListener("click", (e) => {
      if (e.target === statsModal) {
        closeStats();
      }
    });
  }

  // ── Accordion focus management ───────────────────────────────────────
  // Clicking an accordion header should not focus the button after
  // rendering — the close button retains focus.

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

    // Help or Stats modal is open — only Escape is allowed
    if (isHelpOpen) {
      if (key === "Escape") {
        closeHelp();
      }
      return;
    }
    if (isStatsOpen) {
      if (key === "Escape") {
        closeStats();
      }
      return;
    }

    const maxNumbers = state.mode === "4x4" ? 4 : 9;

    // Ctrl+Z / Cmd+Z — allowed even when game is won
    if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      undoMove();
      return;
    }

    // Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y / Cmd+Y — allowed even when game is won
    if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === "y") {
      e.preventDefault();
      redoMove();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === "z" && e.shiftKey) {
      e.preventDefault();
      redoMove();
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
    } else if ((key === "n" || key === "N") && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      toggleNotesMode();
    } else if ((key === "h" || key === "H") && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      useHint();
    } else if (key === "Escape") {
      state.selected = null;
    highlightSelected();
    renderEffect = null;
  }
  });

  // Initial setup
  (async () => {
    // Fetch Reddit username first
    state.username = await getRedditUsername();

    // Then initialize the game
    await changeGameMode("4x4");
    updateDifficultyDisplay();
    updateLeaderboardTitle();
    await loadLeaderboard();
  })();
});
