import type { LogicalMove } from "./HumanSolver";
import { solveStep } from "./HumanSolverPipeline";
import { getTechniqueDescription } from "./TechniqueDescriptions";

export interface Hint {
  move: LogicalMove;
  title: string;
  summary: string;
  explanation: string;
}

export function getHint(
  board: number[][],
  pendingEliminations?: Array<{ row: number; col: number; value: number }>
): Hint | null {
  const move = solveStep(board, pendingEliminations);

  if (!move) {
    return null;
  }

  const desc = getTechniqueDescription(move.technique);

  return {
    move,
    title: desc.title,
    summary: desc.summary,
    explanation: desc.explanation,
  };
}
