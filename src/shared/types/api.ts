export type InitResponse = {
  type: "init";
  postId: string;
  count: number;
  username: string;
};


export type GameMode = "4x4" | "9x9";

export type Difficulty = "easy" | "medium" | "hard" | "expert";

export type LeaderboardEntry = {
  username: string;
  mode: GameMode;
  difficulty: Difficulty;
  time: number; // completion time in seconds
  timestamp: number;
};

export type SubmitScoreRequest = {
  // username is intentionally omitted — the server resolves it from
  // the authenticated Reddit session via reddit.getCurrentUsername().
  mode: GameMode;
  difficulty: Difficulty;
  time: number; // completion time in seconds
};

export type SubmitScoreResponse = {
  type: "submit-score";
  status: "success" | "error";
  message: string;
};

export type CurrentPlayerInfo = {
  username: string;
  globalRank: number | null;
  personalBest: number | null;
  inTop50: boolean;
};

export type LeaderboardResponse = {
  type: "leaderboard";
  entries: LeaderboardEntry[];
  currentPlayer?: CurrentPlayerInfo;
};


export type PuzzleRequest = {
  mode: GameMode;
  difficulty?: Difficulty;
};

export type PuzzleResponse = {
  type: "puzzle";
  status: "success" | "error";
  puzzle: number[][];
  solution: number[][];
  message?: string;
};

export type PlayerStats = {
  username: string;
  totalWins: number;
  totalPlayTime: number;
  records: {
    "4x4": { easy: number | null; medium: number | null; hard: number | null; expert: number | null };
    "9x9": { easy: number | null; medium: number | null; hard: number | null; expert: number | null };
  };
  progress: {
    "4x4": number;
    "9x9": number;
    easy: number;
    medium: number;
    hard: number;
    expert: number;
  };
};

export type StatsResponse = {
  type: "stats";
  stats: PlayerStats;
};
