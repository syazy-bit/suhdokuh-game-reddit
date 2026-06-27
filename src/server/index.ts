import express from "express";
import {
  InitResponse,
  SubmitScoreRequest,
  SubmitScoreResponse,
  LeaderboardEntry,
  GameMode,
  Difficulty,
  PuzzleRequest,
  PuzzleResponse,
  PlayerStats,
  StatsResponse,
} from "../shared/types/api";
import {
  createServer,
  context,
  getServerPort,
  reddit,
  redis,
} from "@devvit/web/server";
import { createPost } from "./core/post";
import { SudokuGenerator, GridSize } from "./core/SudokuGenerator";

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

router.get<
  any,
  InitResponse | { status: string; message: string }
>("/api/init", async (_req, res): Promise<void> => {

  try {
    const [count, username] = await Promise.all([
      redis.get("count"),
      reddit.getCurrentUsername(),
    ]);

    res.json({
      type: "init",
      postId: "global",
      count: count ? parseInt(count) : 0,
      username: username ?? "anonymous",
    });
  } catch (error) {
    console.error(`API Init Error:`, error);
    let errorMessage = "Unknown error during initialization";
    if (error instanceof Error) {
      errorMessage = `Initialization failed: ${error.message}`;
    }
    res.status(400).json({ status: "error", message: errorMessage });
  }
});


// Minimum realistic human completion times (seconds) per mode.
// These are generous lower bounds: a 4×4 expert needs ≥ 5 s,
// a 9×9 expert needs ≥ 30 s (world record ~17 s with extensive practice).
const MIN_TIME: Record<string, number> = { "4x4": 5, "9x9": 30 };
// Upper bound: 24 h (86 400 s).  Anything beyond is likely a left-open tab.
const MAX_TIME = 86_400;

// Valid mode literals – used to prevent Redis key injection.
const VALID_MODES = new Set<string>(["4x4", "9x9"]);
// Valid difficulty literals
const VALID_DIFFICULTIES = new Set<string>(["easy", "medium", "hard"]);

/**
 * Sanitise a raw leaderboard array read from Redis.
 * Filters out any entries that are structurally invalid so a single
 * corrupt record can never break the entire leaderboard.
 */
function sanitiseLeaderboard(raw: unknown): LeaderboardEntry[] {
  if (!Array.isArray(raw)) return [];
  const validEntries = raw.filter(
    (e): e is LeaderboardEntry =>
      e !== null &&
      typeof e === "object" &&
      typeof (e as LeaderboardEntry).username === "string" &&
      (e as LeaderboardEntry).username.trim().length > 0 &&
      typeof (e as LeaderboardEntry).mode === "string" &&
      VALID_MODES.has((e as LeaderboardEntry).mode) &&
      typeof (e as LeaderboardEntry).time === "number" &&
      Number.isFinite((e as LeaderboardEntry).time) &&
      (e as LeaderboardEntry).time > 0 &&
      typeof (e as LeaderboardEntry).timestamp === "number",
  );

  // Deduplicate: keep only the fastest time for each username
  const deduplicated = new Map<string, LeaderboardEntry>();
  for (const entry of validEntries) {
    const existing = deduplicated.get(entry.username);
    if (!existing || entry.time < existing.time) {
      deduplicated.set(entry.username, entry);
    }
  }

  // Sort ascending (fastest first) and cap at 50 entries
  return Array.from(deduplicated.values())
    .sort((a, b) => a.time - b.time)
    .slice(0, 50);
}

/**
 * Read (and for medium difficulty, lazily migrate) a leaderboard.
 *
 * For non-medium difficulties the new-key is always authoritative.
 *
 * For medium difficulty:
 *   1. If leaderboard:${mode}:medium exists, return it.
 *   2. Otherwise check the legacy leaderboard:${mode} key.
 *   3. If legacy data exists, patch `difficulty` → "medium", persist to the
 *      new key, and return the migrated entries.
 *   4. If nothing exists, return an empty array.
 *
 * Both the read and write endpoints MUST call this helper before touching
 * the data so that legacy scores are never orphaned by a premature write.
 */
async function getOrCreateLeaderboardData(
  mode: GameMode,
  difficulty: Difficulty,
): Promise<LeaderboardEntry[]> {
  const leaderboardKey = `leaderboard:${mode}:${difficulty}`;

  // ── Non-medium difficulties: always authoritative ────────────────────
  if (difficulty !== "medium") {
    const raw = await redis.get(leaderboardKey);
    if (!raw) return [];
    try {
      return sanitiseLeaderboard(JSON.parse(raw));
    } catch (parseError) {
      console.warn(`[SERVER] Leaderboard data for ${leaderboardKey} is corrupt. Resetting to empty array.`, parseError);
      return [];
    }
  }

  // ── Medium: try new key first ────────────────────────────────────────
  const raw = await redis.get(leaderboardKey);
  if (raw) {
    try {
      return sanitiseLeaderboard(JSON.parse(raw));
    } catch (parseError) {
      console.warn(`[SERVER] Leaderboard data for ${leaderboardKey} is corrupt. Resetting to empty array.`, parseError);
      return [];
    }
  }

  // ── New key does not exist — attempt lazy migration from legacy key ──
  const oldKey = `leaderboard:${mode}`;
  const oldRaw = await redis.get(oldKey);
  if (!oldRaw) return [];

  try {
    const oldEntries = sanitiseLeaderboard(JSON.parse(oldRaw));
    if (oldEntries.length === 0) return [];

    const migratedEntries: LeaderboardEntry[] = oldEntries.map((e) => ({
      ...e,
      difficulty: "medium",
    }));
    await redis.set(leaderboardKey, JSON.stringify(migratedEntries));
    console.log(
      `[MIGRATION] Migrated ${migratedEntries.length} entries from ${oldKey} to ${leaderboardKey}`,
    );
    return migratedEntries;
  } catch (parseError) {
    console.warn(`[MIGRATION] Failed to migrate ${oldKey}:`, parseError);
    return [];
  }
}

router.post<{ postId: string }, SubmitScoreResponse, SubmitScoreRequest>(
  "/api/submit-score",
  async (req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        type: "submit-score",
        status: "error",
        message: "postId is required",
      });
      return;
    }

    try {
      // ── 1. Resolve authenticated username ────────────────────────────
      // Never trust req.body.username – always derive from Reddit session.
      const username = await reddit.getCurrentUsername();
      if (!username) {
        res.status(401).json({
          type: "submit-score",
          status: "error",
          message: "You must be logged in to submit a score",
        });
        return;
      }

      // ── 2. Validate mode ─────────────────────────────────────────────
      const { mode, difficulty, time } = req.body;
      if (!mode || !VALID_MODES.has(mode)) {
        res.status(400).json({
          type: "submit-score",
          status: "error",
          message: "Invalid game mode",
        });
        return;
      }

      // ── 3. Validate difficulty ────────────────────────────────────────
      if (!difficulty || !VALID_DIFFICULTIES.has(difficulty)) {
        res.status(400).json({
          type: "submit-score",
          status: "error",
          message: "Invalid difficulty",
        });
        return;
      }

      // ── 4. Validate time ─────────────────────────────────────────────
      if (
        typeof time !== "number" ||
        !Number.isFinite(time) ||
        time < (MIN_TIME[mode] ?? 5) ||
        time > MAX_TIME
      ) {
        res.status(400).json({
          type: "submit-score",
          status: "error",
          message: `Invalid completion time for ${mode} (must be ${MIN_TIME[mode] ?? 5}–${MAX_TIME} seconds)`,
        });
        return;
      }

      // ── 5. Update player statistics ─────────────────────────────────
      // Always update stats on completion, regardless of personal best.
      try {
        const statsKey = `stats:${username}`;
        const rawStats = await redis.get(statsKey);
        const stats: PlayerStats = rawStats
          ? JSON.parse(rawStats)
          : {
              username,
              totalWins: 0,
              totalPlayTime: 0,
              records: {
                "4x4": { easy: null, medium: null, hard: null },
                "9x9": { easy: null, medium: null, hard: null },
              },
              progress: {
                "4x4": 0,
                "9x9": 0,
                easy: 0,
                medium: 0,
                hard: 0,
              },
            };

        stats.totalWins++;
        stats.totalPlayTime += time;
        stats.progress[mode as keyof typeof stats.progress]++;
        stats.progress[difficulty as keyof typeof stats.progress]++;

        const currentRecord = stats.records[mode as keyof typeof stats.records]?.[difficulty as keyof typeof stats.records["4x4"]];
        if (currentRecord === null || time < currentRecord) {
          (stats.records[mode as keyof typeof stats.records] as Record<string, number | null>)[difficulty] = time;
        }

        await redis.set(statsKey, JSON.stringify(stats));
      } catch (statsError) {
        console.warn("[STATS] Failed to update player stats (non-fatal):", statsError);
      }

      // ── 6. Load (and migrate if needed) existing leaderboard ─────────
      let entries: LeaderboardEntry[] = await getOrCreateLeaderboardData(mode, difficulty);

      // ── 7. Deduplicate: keep only the user's personal best ───────────
      const existingEntry = entries.find((e) => e.username === username);

      // If they already have a faster (or equal) time, keep it and ignore this slower submission.
      if (existingEntry && existingEntry.time <= time) {
        console.log(`[SCORE] ${username} submitted ${time}s for ${mode}, but their personal best (${existingEntry.time}s) is faster.`);
        res.json({
          type: "submit-score",
          status: "success",
          message: "Score submitted, but your personal best is still faster.",
        });
        return;
      }

      // Otherwise, they beat their old score (or it's their first time).
      // Remove the old entry and insert the new one.
      entries = entries.filter((e) => e.username !== username);
      entries.push({
        username,
        mode,
        difficulty,
        time,
        timestamp: Date.now(),
      });

      // ── 8. Sort ascending (fastest first) and cap at 50 entries ──────
      entries.sort((a, b) => a.time - b.time);
      entries = entries.slice(0, 50);

      await redis.set(`leaderboard:${mode}:${difficulty}`, JSON.stringify(entries));

      console.log(
        `[SCORE] ${username} submitted ${time}s for ${mode}`,
      );

      res.json({
        type: "submit-score",
        status: "success",
        message: "Score submitted successfully",
      });
    } catch (error) {
      console.error(`Error submitting score: ${error}`);
      res.status(500).json({
        type: "submit-score",
        status: "error",
        message: "Failed to submit score",
      });
    }
  },
);

router.get<
  any,
  any | { status: string; message: string }
>("/api/leaderboard", async (req, res): Promise<void> => {

  try {
    const mode = (req.query.mode as GameMode) || "4x4";
    const difficulty = (req.query.difficulty as Difficulty) || "medium";
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    if (!VALID_MODES.has(mode)) {
      res.status(400).json({ status: "error", message: "Invalid game mode" });
      return;
    }

    if (!VALID_DIFFICULTIES.has(difficulty)) {
      res.status(400).json({ status: "error", message: "Invalid difficulty" });
      return;
    }

    const entries: LeaderboardEntry[] = await getOrCreateLeaderboardData(mode, difficulty);

    // Return top entries
    res.json({
      type: "leaderboard",
      entries: entries.slice(0, limit),
    });
  } catch (error) {
    console.error(`Error fetching leaderboard: ${error}`);
    res.status(400).json({
      status: "error",
      message: `Failed to fetch leaderboard: ${error instanceof Error ? error.stack : String(error)}`,
    });
  }
});

router.get<
  any,
  StatsResponse | { status: string; message: string }
>("/api/stats", async (_req, res): Promise<void> => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) {
      res.status(401).json({ status: "error", message: "Not authenticated" });
      return;
    }

    const raw = await redis.get(`stats:${username}`);
    if (raw) {
      const stats = JSON.parse(raw) as PlayerStats;
      res.json({ type: "stats", stats });
      return;
    }

    const emptyStats: PlayerStats = {
      username,
      totalWins: 0,
      totalPlayTime: 0,
      records: {
        "4x4": { easy: null, medium: null, hard: null },
        "9x9": { easy: null, medium: null, hard: null },
      },
      progress: {
        "4x4": 0,
        "9x9": 0,
        easy: 0,
        medium: 0,
        hard: 0,
      },
    };

    res.json({ type: "stats", stats: emptyStats });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ status: "error", message: "Failed to fetch stats" });
  }
});

// Fallback puzzle libraries for when API fails — bucketed by difficulty
const fallbackPuzzles4x4: Record<Difficulty, { puzzle: number[][]; solution: number[][] }[]> = {
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

const fallbackPuzzles9x9: Record<Difficulty, { puzzle: number[][]; solution: number[][] }[]> = {
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
        [0, 3, 0, 0, 7, 0, 0, 0, 0],
        [6, 0, 0, 0, 9, 5, 0, 0, 0],
        [0, 0, 8, 0, 0, 0, 0, 6, 0],
        [8, 0, 0, 0, 0, 0, 0, 0, 3],
        [0, 0, 0, 8, 0, 0, 0, 0, 0],
        [7, 0, 0, 0, 2, 0, 0, 0, 6],
        [0, 6, 0, 0, 0, 0, 0, 8, 0],
        [0, 0, 0, 4, 1, 9, 0, 0, 5],
        [0, 0, 0, 0, 8, 0, 0, 7, 0],
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
        [7, 0, 0, 0, 0, 0, 6, 0, 0],
        [0, 0, 0, 0, 0, 1, 0, 8, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 5, 0, 0, 8, 0, 0, 0, 3],
        [0, 0, 0, 3, 0, 0, 0, 0, 5],
        [0, 4, 0, 2, 0, 0, 0, 6, 0],
        [9, 0, 3, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 4, 0],
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


router.post<{ postId: string }, PuzzleResponse, PuzzleRequest>(
  "/api/puzzle",
  async (req, res): Promise<void> => {
    console.log("[SERVER] /api/puzzle endpoint called");
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        type: "puzzle",
        status: "error",
        puzzle: [],
        solution: [],
        message: "postId is required",
      });
      return;
    }

    // ── Rate limiting (10 requests per user per 60 seconds) ───────────────
    // Key is scoped to the authenticated user so users never share a bucket.
    const RATE_LIMIT = 10;
    const RATE_WINDOW = 60; // seconds

    try {
      const rlUsername = await reddit.getCurrentUsername();
      if (rlUsername) {
        const rlKey = `rl:puzzle:${rlUsername}`;
        const count = await redis.incrBy(rlKey, 1);

        // On the very first request in this window, set the TTL.
        // Subsequent increments within the window do NOT reset the expiry.
        if (count === 1) {
          await redis.expire(rlKey, RATE_WINDOW);
        }

        if (count > RATE_LIMIT) {
          console.log(
            `[SERVER] Rate limit exceeded for ${rlUsername}: ${count} requests in window`
          );
          res.status(429).json({
            type: "puzzle",
            status: "error",
            puzzle: [],
            solution: [],
            message: `Too many puzzle requests. Please wait a moment before requesting another puzzle.`,
          });
          return;
        }
      }
    } catch (rlError) {
      // Rate limiter failure is non-fatal — allow the request through rather
      // than blocking gameplay due to a transient Redis error.
      console.warn("[SERVER] Rate limit check failed (non-fatal):", rlError);
    }
    // ─────────────────────────────────────────────────────────────────────

    try {
      const { mode, difficulty } = req.body;
      const diff: Difficulty = difficulty === "easy" || difficulty === "hard" ? difficulty : "medium";
      console.log(`[SERVER] Requested mode: ${mode}, difficulty: ${diff}`);

      if (!mode || (mode !== "4x4" && mode !== "9x9")) {
        res.status(400).json({
          type: "puzzle",
          status: "error",
          puzzle: [],
          solution: [],
          message: "Invalid game mode",
        });
        return;
      }

      // Convert mode to grid size
      const size: GridSize = mode === "4x4" ? 4 : 9;
      const boxSize = Math.sqrt(size);

      try {
        // Use unified generator for both sizes
        console.log(`[SERVER] Generating ${mode} ${diff} puzzle with unified generator...`);
        const startTime = Date.now();

        const generator = new SudokuGenerator({ size, boxSize, difficulty: diff });
        const generated = generator.generate();

        const elapsed = Date.now() - startTime;
        console.log(
          `[SERVER] Generated ${mode} ${diff} puzzle in ${elapsed}ms (${generated.cellsRemoved} cells removed)`
        );

        res.json({
          type: "puzzle",
          status: "success",
          puzzle: generated.puzzle,
          solution: generated.solution,
          message: `Generated ${mode} ${diff} puzzle`,
        });
      } catch (generatorError) {
        // Fallback to static puzzles if generation fails
        console.error(
          `[SERVER] Generator failed for ${mode}, using fallback:`,
          generatorError
        );

        const library = mode === "4x4" ? fallbackPuzzles4x4 : fallbackPuzzles9x9;
        const bucket = library[diff];
        const fallback = bucket[Math.floor(Math.random() * bucket.length)];

        if (!fallback) {
          res.status(500).json({
            type: "puzzle",
            status: "error",
            puzzle: [],
            solution: [],
            message: "No puzzles available",
          });
          return;
        }

        res.json({
          type: "puzzle",
          status: "success",
          puzzle: fallback.puzzle,
          solution: fallback.solution,
          message: "Using fallback puzzle",
        });
      }
    } catch (error) {
      console.error(`[SERVER] Error in puzzle endpoint: ${error}`);
      res.status(500).json({
        type: "puzzle",
        status: "error",
        puzzle: [],
        solution: [],
        message: "Failed to generate puzzle",
      });
    }
  },
);
router.post("/internal/on-app-install", async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      status: "success",
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: "error",
      message: "Failed to create post",
    });
  }
});

router.post("/internal/menu/post-create", async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: "error",
      message: "Failed to create post",
    });
  }
});

app.use(router);

const server = createServer(app);
server.on("error", (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());
