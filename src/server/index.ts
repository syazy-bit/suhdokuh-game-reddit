import express from "express";
import {
  InitResponse,
  IncrementResponse,
  DecrementResponse,
  SubmitScoreRequest,
  SubmitScoreResponse,
  LeaderboardResponse,
  LeaderboardEntry,
  GameMode,
  PuzzleRequest,
  PuzzleResponse,
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
  { postId: string },
  InitResponse | { status: string; message: string }
>("/api/init", async (_req, res): Promise<void> => {
  const { postId } = context;

  if (!postId) {
    console.error("API Init Error: postId not found in devvit context");
    res.status(400).json({
      status: "error",
      message: "postId is required but missing from context",
    });
    return;
  }

  try {
    const [count, username] = await Promise.all([
      redis.get("count"),
      reddit.getCurrentUsername(),
    ]);

    res.json({
      type: "init",
      postId: postId,
      count: count ? parseInt(count) : 0,
      username: username ?? "anonymous",
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    let errorMessage = "Unknown error during initialization";
    if (error instanceof Error) {
      errorMessage = `Initialization failed: ${error.message}`;
    }
    res.status(400).json({ status: "error", message: errorMessage });
  }
});

router.post<
  { postId: string },
  IncrementResponse | { status: string; message: string },
  unknown
>("/api/increment", async (_req, res): Promise<void> => {
  const { postId } = context;
  if (!postId) {
    res.status(400).json({
      status: "error",
      message: "postId is required",
    });
    return;
  }

  res.json({
    count: await redis.incrBy("count", 1),
    postId,
    type: "increment",
  });
});

router.post<
  { postId: string },
  DecrementResponse | { status: string; message: string },
  unknown
>("/api/decrement", async (_req, res): Promise<void> => {
  const { postId } = context;
  if (!postId) {
    res.status(400).json({
      status: "error",
      message: "postId is required",
    });
    return;
  }

  res.json({
    count: await redis.incrBy("count", -1),
    postId,
    type: "decrement",
  });
});

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
      const { username, mode, time } = req.body;

      if (!username || !mode || typeof time !== "number") {
        res.status(400).json({
          type: "submit-score",
          status: "error",
          message: "Invalid request body",
        });
        return;
      }

      // Create a unique key for each mode's leaderboard
      const leaderboardKey = `leaderboard:${mode}`;

      // Get current leaderboard
      const leaderboardData = await redis.get(leaderboardKey);
      let entries: LeaderboardEntry[] = leaderboardData
        ? JSON.parse(leaderboardData)
        : [];

      // Add new entry
      const newEntry: LeaderboardEntry = {
        username,
        mode,
        time,
        timestamp: Date.now(),
      };

      entries.push(newEntry);

      // Sort by time (ascending - faster is better) and keep top 50
      entries.sort((a, b) => a.time - b.time);
      entries = entries.slice(0, 50);

      // Store updated leaderboard
      await redis.set(leaderboardKey, JSON.stringify(entries));

      res.json({
        type: "submit-score",
        status: "success",
        message: "Score submitted successfully",
      });
    } catch (error) {
      console.error(`Error submitting score: ${error}`);
      res.status(400).json({
        type: "submit-score",
        status: "error",
        message: "Failed to submit score",
      });
    }
  },
);

router.get<
  { postId: string },
  LeaderboardResponse | { status: string; message: string }
>("/api/leaderboard", async (req, res): Promise<void> => {
  const { postId } = context;
  if (!postId) {
    res.status(400).json({
      status: "error",
      message: "postId is required",
    });
    return;
  }

  try {
    const mode = (req.query.mode as GameMode) || "4x4";
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const leaderboardKey = `leaderboard:${mode}`;
    const leaderboardData = await redis.get(leaderboardKey);
    let entries: LeaderboardEntry[] = leaderboardData
      ? JSON.parse(leaderboardData)
      : [];

    // Return top entries
    res.json({
      type: "leaderboard",
      entries: entries.slice(0, limit),
    });
  } catch (error) {
    console.error(`Error fetching leaderboard: ${error}`);
    res.status(400).json({
      status: "error",
      message: "Failed to fetch leaderboard",
    });
  }
});

// Fallback puzzle libraries for when API fails
const fallbackPuzzles4x4 = [
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

const fallbackPuzzles9x9 = [
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

    try {
      const { mode } = req.body;
      console.log(`[SERVER] Requested mode: ${mode}`);

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
        console.log(`[SERVER] Generating ${mode} puzzle with unified generator...`);
        const startTime = Date.now();
        
        const generator = new SudokuGenerator({ size, boxSize });
        const generated = generator.generate();
        
        const elapsed = Date.now() - startTime;
        console.log(
          `[SERVER] Generated ${mode} puzzle in ${elapsed}ms (${generated.cellsRemoved} cells removed)`
        );

        res.json({
          type: "puzzle",
          status: "success",
          puzzle: generated.puzzle,
          solution: generated.solution,
          message: `Generated ${mode} puzzle`,
        });
      } catch (generatorError) {
        // Fallback to static puzzles if generation fails
        console.error(
          `[SERVER] Generator failed for ${mode}, using fallback:`,
          generatorError
        );

        const fallback =
          mode === "4x4"
            ? fallbackPuzzles4x4[
                Math.floor(Math.random() * fallbackPuzzles4x4.length)
              ]
            : fallbackPuzzles9x9[
                Math.floor(Math.random() * fallbackPuzzles9x9.length)
              ];

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
