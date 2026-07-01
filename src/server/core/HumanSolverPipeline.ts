import { buildCandidateMap } from "./CandidateEngine";
import {
  findNakedSingles,
  findHiddenSingles,
  findNakedPairs,
  findHiddenPairs,
  findPointingPairs,
  findClaimingPairs,
  findXWings,
  findXYWing,
  findSkyscraper,
  findTwoStringKite,
  findSwordfish,
  type HumanSolverContext,
  type LogicalMove,
} from "./HumanSolver";
import { getPeerCells } from "./PeerCache";
import type { GridSize } from "./SudokuValidator";
import { type Technique, TECHNIQUE_PRIORITY } from "./HumanSolverTypes";

export interface SolveResult {
  solved: boolean;
  finalBoard: number[][];
  moves: LogicalMove[];
  techniquesUsed: Technique[];
  hardestTechnique: Technique | null;
}

const FINDERS: Array<{ name: Technique; fn: (ctx: HumanSolverContext) => LogicalMove[] }> = [
  { name: "Naked Single", fn: findNakedSingles },
  { name: "Hidden Single", fn: findHiddenSingles },
  { name: "Naked Pair", fn: findNakedPairs },
  { name: "Hidden Pair", fn: findHiddenPairs },
  { name: "Pointing Pair", fn: findPointingPairs },
  { name: "Claiming Pair", fn: findClaimingPairs },
  { name: "X-Wing", fn: findXWings },
  { name: "Skyscraper", fn: findSkyscraper },
  { name: "Two-String Kite", fn: findTwoStringKite },
  { name: "XY-Wing", fn: findXYWing },
  { name: "Swordfish", fn: findSwordfish },
];

function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row]);
}

function getSize(board: number[][]): GridSize {
  return board.length as GridSize;
}

function getBoxSize(size: GridSize): number {
  return size === 9 ? 3 : 2;
}

function isBoardSolved(board: number[][]): boolean {
  return board.every((row) => row.every((cell) => cell !== 0));
}

function eliminationKey(row: number, col: number, value: number): string {
  return `${row},${col},${value}`;
}

function buildContext(
  board: number[][],
  size: GridSize,
  boxSize: number,
  pendingEliminations: Map<string, { row: number; col: number; value: number }>
): HumanSolverContext {
  const candidateMap = buildCandidateMap(board, size, boxSize);
  for (const [, e] of pendingEliminations) {
    const list = candidateMap[e.row]![e.col]!;
    const idx = list.indexOf(e.value);
    if (idx !== -1) list.splice(idx, 1);
  }
  return { board, size, boxSize, candidateMap };
}

function applyAssignment(ctx: HumanSolverContext, row: number, col: number, value: number): void {
  ctx.board[row]![col] = value;
  ctx.candidateMap[row]![col] = [];

  const { candidateMap } = ctx;
  for (const [r, c] of getPeerCells(ctx.size, row, col)) {
    if (ctx.board[r]![c] !== 0) continue;
    const list = candidateMap[r]![c]!;
    const idx = list.indexOf(value);
    if (idx !== -1) list.splice(idx, 1);
  }
}

function applyEliminations(
  ctx: HumanSolverContext,
  eliminations: Array<{ row: number; col: number; value: number }>
): void {
  for (const { row, col, value } of eliminations) {
    const list = ctx.candidateMap[row]![col]!;
    const idx = list.indexOf(value);
    if (idx !== -1) list.splice(idx, 1);
  }
}

function findNextMove(ctx: HumanSolverContext): LogicalMove | null {
  for (const { fn } of FINDERS) {
    const moves = fn(ctx);
    if (moves.length > 0) {
      return moves[0]!;
    }
  }
  return null;
}

export function solveStep(
  board: number[][],
  pendingEliminations?: Array<{ row: number; col: number; value: number }>
): LogicalMove | null {
  const size = getSize(board);
  const boxSize = getBoxSize(size);
  const elimMap = new Map<string, { row: number; col: number; value: number }>();
  if (pendingEliminations) {
    for (const e of pendingEliminations) {
      elimMap.set(eliminationKey(e.row, e.col, e.value), e);
    }
  }
  const ctx = buildContext(board, size, boxSize, elimMap);
  return findNextMove(ctx);
}

export function solve(board: number[][]): SolveResult {
  const size = getSize(board);
  const boxSize = getBoxSize(size);
  const working = cloneBoard(board);
  const moves: LogicalMove[] = [];
  const techniquesUsed = new Set<Technique>();
  let hardestIdx = 0;

  const ctx: HumanSolverContext = {
    board: working,
    size,
    boxSize,
    candidateMap: buildCandidateMap(working, size, boxSize),
  };

  while (true) {
    if (isBoardSolved(working)) {
      return {
        solved: true,
        finalBoard: working,
        moves,
        techniquesUsed: [...techniquesUsed],
        hardestTechnique: hardestIdx > 0 ? TECHNIQUE_PRIORITY[hardestIdx - 1]! : null,
      };
    }

    const move = findNextMove(ctx);
    if (!move) {
      return {
        solved: false,
        finalBoard: working,
        moves,
        techniquesUsed: [...techniquesUsed],
        hardestTechnique: hardestIdx > 0 ? TECHNIQUE_PRIORITY[hardestIdx - 1]! : null,
      };
    }

    moves.push(move);
    techniquesUsed.add(move.technique);
    const techIdx = TECHNIQUE_PRIORITY.indexOf(move.technique);
    if (techIdx >= 0 && techIdx + 1 > hardestIdx) {
      hardestIdx = techIdx + 1;
    }

    if (move.type === "assignment") {
      applyAssignment(ctx, move.row, move.col, move.value);
    } else {
      applyEliminations(ctx, move.eliminations);
    }
  }
}

export function canSolve(board: number[][]): boolean {
  return solve(board).solved;
}
