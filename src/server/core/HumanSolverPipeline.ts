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

function findNextMove(
  board: number[][],
  size: GridSize,
  boxSize: number,
  pendingEliminations: Map<string, { row: number; col: number; value: number }>
): LogicalMove | null {
  const ctx = buildContext(board, size, boxSize, pendingEliminations);
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
  return findNextMove(board, size, boxSize, elimMap);
}

export function solve(board: number[][]): SolveResult {
  const size = getSize(board);
  const boxSize = getBoxSize(size);
  const working = cloneBoard(board);
  const pendingEliminations = new Map<string, { row: number; col: number; value: number }>();
  const moves: LogicalMove[] = [];
  const techniquesUsed = new Set<Technique>();
  let hardestIdx = 0;

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

    const move = findNextMove(working, size, boxSize, pendingEliminations);
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
      working[move.row]![move.col] = move.value;
    } else {
      for (const e of move.eliminations) {
        const ek = eliminationKey(e.row, e.col, e.value);
        if (!pendingEliminations.has(ek)) {
          pendingEliminations.set(ek, e);
        }
      }
    }
  }
}

export function canSolve(board: number[][]): boolean {
  return solve(board).solved;
}
