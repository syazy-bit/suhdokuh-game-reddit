export type InitResponse = {
  type: "init";
  postId: string;
  count: number;
  username: string;
};


export type GameMode = "4x4" | "9x9";

export type LeaderboardEntry = {
  username: string;
  mode: GameMode;
  time: number; // completion time in seconds
  timestamp: number;
};

export type SubmitScoreRequest = {
  // username is intentionally omitted — the server resolves it from
  // the authenticated Reddit session via reddit.getCurrentUsername().
  mode: GameMode;
  time: number; // completion time in seconds
};

export type SubmitScoreResponse = {
  type: "submit-score";
  status: "success" | "error";
  message: string;
};

export type LeaderboardResponse = {
  type: "leaderboard";
  entries: LeaderboardEntry[];
};


export type PuzzleRequest = {
  mode: GameMode;
};

export type PuzzleResponse = {
  type: "puzzle";
  status: "success" | "error";
  puzzle: number[][];
  solution: number[][];
  message?: string;
};
