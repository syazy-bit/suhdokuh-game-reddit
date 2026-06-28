import type { Technique } from "./HumanSolverTypes";

export interface TechniqueDescription {
  title: string;
  summary: string;
  explanation: string;
}

export function getTechniqueDescription(technique: Technique): TechniqueDescription {
  return TECHNIQUE_DESCRIPTIONS[technique];
}

export const TECHNIQUE_DESCRIPTIONS: Record<Technique, TechniqueDescription> = {
  // TODO: In a future phase, explanations may become parameterized with cell
  // coordinates and values (e.g. "Only cell R4C7 can contain 9"). For now,
  // all descriptions are static templates.
  "Naked Single": {
    title: "Naked Single",
    summary: "A cell has only one possible candidate.",
    explanation:
      "A cell has been reduced to a single candidate value. All other values are impossible because they already appear in the same row, column, or box. That value must be placed in this cell.",
  },
  "Hidden Single": {
    title: "Hidden Single",
    summary: "A number can only go in one cell of a row, column, or box.",
    explanation:
      "Within a row, column, or box, a candidate value appears in exactly one cell. Even though that cell may have other candidates, this value has no other possible position and must be assigned here.",
  },
  "Naked Pair": {
    title: "Naked Pair",
    summary: "Two cells share the same two candidates.",
    explanation:
      "Two cells in the same row, column, or box both contain the same pair of candidates. Those two values are reserved for those two cells, so they can be removed from every other cell in that unit.",
  },
  "Hidden Pair": {
    title: "Hidden Pair",
    summary: "Two cells are the only possible positions for two numbers.",
    explanation:
      "Within a row, column, or box, two candidate values each appear in exactly the same two cells. Those two cells are reserved for those two values, so all other candidates can be removed from those cells.",
  },
  "Pointing Pair": {
    title: "Pointing Pair",
    summary: "A candidate is confined to one row or column within a box.",
    explanation:
      "In a box, a candidate appears only in cells that share a single row or column. Since the value must be in that row (or column) within the box, it can be eliminated from the rest of that row (or column) outside the box.",
  },
  "Claiming Pair": {
    title: "Claiming Pair",
    summary: "A candidate is confined to one box within a row or column.",
    explanation:
      "In a row or column, a candidate appears only in cells that lie within a single box. The value must be in that box along that row (or column), so it can be eliminated from the rest of that box.",
  },
  "X-Wing": {
    title: "X-Wing",
    summary: "A candidate forms a rectangular pattern across two rows and two columns.",
    explanation:
      "A candidate appears in exactly two rows in the same two columns. Those four cells form a rectangle. The candidate must be placed in both rows within those two columns, so it can be eliminated from all other cells in those columns (and vice versa from the rows).",
  },
  "Swordfish": {
    title: "Swordfish",
    summary: "A candidate forms a pattern across three rows and three columns.",
    explanation:
      "A candidate appears in exactly three rows with candidate positions confined to the same three columns. The value must occupy each of those rows within those columns, so it can be eliminated from all other cells in those columns.",
  },
};
