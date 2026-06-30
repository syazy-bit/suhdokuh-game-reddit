import type { CandidateMap } from "./CandidateEngine";
import type { GridSize } from "./SudokuValidator";
import type { Technique } from "./HumanSolverTypes";

export interface HumanSolverContext {
  board: number[][];
  size: GridSize;
  boxSize: number;
  candidateMap: CandidateMap;
}

export type LogicalMove =
  | {
      type: "assignment";
      technique: Technique;
      row: number;
      col: number;
      value: number;
    }
  | {
      type: "elimination";
      technique: Technique;
      patternCells: Array<{ row: number; col: number }>;
      eliminations: Array<{
        row: number;
        col: number;
        value: number;
      }>;
    };

export function findNakedSingles(ctx: HumanSolverContext): LogicalMove[] {
  const moves: LogicalMove[] = [];
  const { board, size, candidateMap } = ctx;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row]![col] !== 0) continue;

      const candidates = candidateMap[row]![col]!;

      if (candidates.length === 1) {
        moves.push({
          type: "assignment",
          row,
          col,
          value: candidates[0]!,
          technique: "Naked Single",
        });
      }
    }
  }

  return moves;
}

export function findHiddenSingles(ctx: HumanSolverContext): LogicalMove[] {
  const moves: LogicalMove[] = [];
  const seen = new Set<string>();
  const { board, size, boxSize, candidateMap } = ctx;

  function tryAdd(row: number, col: number, value: number): void {
    const key = `${row}-${col}-${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    moves.push({ type: "assignment", row, col, value, technique: "Hidden Single" });
  }

  // Scan rows
  for (let row = 0; row < size; row++) {
    const counts = new Map<number, number>();
    const cellCandidates: { row: number; col: number; list: number[] }[] = [];

    for (let col = 0; col < size; col++) {
      if (board[row]![col] !== 0) continue;
      const list = candidateMap[row]![col]!;
      cellCandidates.push({ row, col, list });
      for (const v of list) {
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
    }

    for (const { row, col, list } of cellCandidates) {
      for (const v of list) {
        if (counts.get(v) === 1) tryAdd(row, col, v);
      }
    }
  }

  // Scan columns
  for (let col = 0; col < size; col++) {
    const counts = new Map<number, number>();
    const cellCandidates: { row: number; col: number; list: number[] }[] = [];

    for (let row = 0; row < size; row++) {
      if (board[row]![col] !== 0) continue;
      const list = candidateMap[row]![col]!;
      cellCandidates.push({ row, col, list });
      for (const v of list) {
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
    }

    for (const { row, col, list } of cellCandidates) {
      for (const v of list) {
        if (counts.get(v) === 1) tryAdd(row, col, v);
      }
    }
  }

  // Scan boxes
  for (let boxRow = 0; boxRow < size; boxRow += boxSize) {
    for (let boxCol = 0; boxCol < size; boxCol += boxSize) {
      const counts = new Map<number, number>();
      const cellCandidates: { row: number; col: number; list: number[] }[] = [];

      for (let r = boxRow; r < boxRow + boxSize; r++) {
        for (let c = boxCol; c < boxCol + boxSize; c++) {
          if (board[r]![c] !== 0) continue;
          const list = candidateMap[r]![c]!;
          cellCandidates.push({ row: r, col: c, list });
          for (const v of list) {
            counts.set(v, (counts.get(v) ?? 0) + 1);
          }
        }
      }

      for (const { row, col, list } of cellCandidates) {
        for (const v of list) {
          if (counts.get(v) === 1) tryAdd(row, col, v);
        }
      }
    }
  }

  return moves;
}

function candidateKey(list: number[]): string {
  return [...list].sort((a, b) => a - b).join(",");
}

function pairDedupKey(
  a: { row: number; col: number },
  b: { row: number; col: number },
  values: string
): string {
  const p1 = `${a.row},${a.col}`;
  const p2 = `${b.row},${b.col}`;
  return p1 < p2 ? `${p1}-${p2}-${values}` : `${p2}-${p1}-${values}`;
}

function eliminationCellKey(
  row: number,
  col: number,
  value: number
): string {
  return `${row},${col},${value}`;
}

function seeEachOther(
  r1: number, c1: number,
  r2: number, c2: number,
  boxSize: number
): boolean {
  if (r1 === r2 && c1 === c2) return false;
  if (r1 === r2) return true;
  if (c1 === c2) return true;
  const br1 = Math.floor(r1 / boxSize) * boxSize;
  const bc1 = Math.floor(c1 / boxSize) * boxSize;
  const br2 = Math.floor(r2 / boxSize) * boxSize;
  const bc2 = Math.floor(c2 / boxSize) * boxSize;
  return br1 === br2 && bc1 === bc2;
}

export function findNakedPairs(ctx: HumanSolverContext): LogicalMove[] {
  const { board, size, boxSize, candidateMap } = ctx;
  const pairMap = new Map<
    string,
    {
      patternCells: Array<{ row: number; col: number }>;
      eliminations: Map<string, { row: number; col: number; value: number }>;
    }
  >();

  function processUnit(cells: Array<{ row: number; col: number }>): void {
    const groups = new Map<string, Array<{ row: number; col: number }>>();

    for (const { row, col } of cells) {
      const list = candidateMap[row]![col]!;
      if (list.length !== 2) continue;
      const key = candidateKey(list);
      const group = groups.get(key) ?? [];
      group.push({ row, col });
      groups.set(key, group);
    }

    for (const [candKey, pairCells] of groups) {
      if (pairCells.length !== 2) continue;

      const [a, b] = pairCells;
      const dk = pairDedupKey(a!, b!, candKey);
      let entry = pairMap.get(dk);
      if (!entry) {
        entry = {
          patternCells: [
            { row: a!.row, col: a!.col },
            { row: b!.row, col: b!.col },
          ],
          eliminations: new Map(),
        };
        pairMap.set(dk, entry);
      }

      const values = candKey.split(",").map(Number);

      for (const { row, col } of cells) {
        if (
          (row === a!.row && col === a!.col) ||
          (row === b!.row && col === b!.col)
        )
          continue;

        const list = candidateMap[row]![col]!;
        for (const v of values) {
          if (list.includes(v)) {
            const ek = eliminationCellKey(row, col, v);
            if (!entry.eliminations.has(ek)) {
              entry.eliminations.set(ek, { row, col, value: v });
            }
          }
        }
      }
    }
  }

  // Scan rows
  for (let row = 0; row < size; row++) {
    const cells: Array<{ row: number; col: number }> = [];
    for (let col = 0; col < size; col++) {
      if (board[row]![col] === 0) cells.push({ row, col });
    }
    processUnit(cells);
  }

  // Scan columns
  for (let col = 0; col < size; col++) {
    const cells: Array<{ row: number; col: number }> = [];
    for (let row = 0; row < size; row++) {
      if (board[row]![col] === 0) cells.push({ row, col });
    }
    processUnit(cells);
  }

  // Scan boxes
  for (let boxRow = 0; boxRow < size; boxRow += boxSize) {
    for (let boxCol = 0; boxCol < size; boxCol += boxSize) {
      const cells: Array<{ row: number; col: number }> = [];
      for (let r = boxRow; r < boxRow + boxSize; r++) {
        for (let c = boxCol; c < boxCol + boxSize; c++) {
          if (board[r]![c] === 0) cells.push({ row: r, col: c });
        }
      }
      processUnit(cells);
    }
  }

  const moves: LogicalMove[] = [];
  for (const { patternCells, eliminations } of pairMap.values()) {
    if (eliminations.size === 0) continue;
    moves.push({
      type: "elimination",
      technique: "Naked Pair",
      patternCells,
      eliminations: [...eliminations.values()],
    });
  }
  return moves;
}

export function findHiddenPairs(ctx: HumanSolverContext): LogicalMove[] {
  const { board, size, boxSize, candidateMap } = ctx;
  const pairMap = new Map<
    string,
    {
      patternCells: Array<{ row: number; col: number }>;
      eliminations: Map<string, { row: number; col: number; value: number }>;
    }
  >();

  function processUnit(cells: Array<{ row: number; col: number }>): void {
    // Build value → cells map from candidate lists
    const valueCells = new Map<
      number,
      Array<{ row: number; col: number }>
    >();

    for (const { row, col } of cells) {
      const list = candidateMap[row]![col]!;
      if (list.length < 2) continue;
      for (const v of list) {
        const arr = valueCells.get(v) ?? [];
        arr.push({ row, col });
        valueCells.set(v, arr);
      }
    }

    // Values that appear in exactly two cells
    const twoCellValues: Array<{
      value: number;
      cells: Array<{ row: number; col: number }>;
    }> = [];
    for (const [v, vcells] of valueCells) {
      if (vcells.length === 2) {
        twoCellValues.push({ value: v, cells: vcells });
      }
    }

    // Find pairs of values that share the same two cells
    for (let i = 0; i < twoCellValues.length; i++) {
      for (let j = i + 1; j < twoCellValues.length; j++) {
        const { value: v1, cells: cells1 } = twoCellValues[i]!;
        const { value: v2, cells: cells2 } = twoCellValues[j]!;

        const same =
          (cells1[0]!.row === cells2[0]!.row &&
            cells1[0]!.col === cells2[0]!.col &&
            cells1[1]!.row === cells2[1]!.row &&
            cells1[1]!.col === cells2[1]!.col) ||
          (cells1[0]!.row === cells2[1]!.row &&
            cells1[0]!.col === cells2[1]!.col &&
            cells1[1]!.row === cells2[0]!.row &&
            cells1[1]!.col === cells2[0]!.col);

        if (!same) continue;

        const a = cells1[0]!;
        const b = cells1[1]!;
        const sortedVals = v1 < v2 ? `${v1},${v2}` : `${v2},${v1}`;
        const dk = pairDedupKey(a, b, sortedVals);

        let entry = pairMap.get(dk);
        if (!entry) {
          entry = {
            patternCells: [
              { row: a.row, col: a.col },
              { row: b.row, col: b.col },
            ],
            eliminations: new Map(),
          };
          pairMap.set(dk, entry);
        }

        const hiddenValues = new Set([v1, v2]);

        for (const cell of [a, b]) {
          const list = candidateMap[cell.row]![cell.col]!;
          for (const candidate of list) {
            if (!hiddenValues.has(candidate)) {
              const ek = eliminationCellKey(cell.row, cell.col, candidate);
              if (!entry.eliminations.has(ek)) {
                entry.eliminations.set(ek, {
                  row: cell.row,
                  col: cell.col,
                  value: candidate,
                });
              }
            }
          }
        }
      }
    }
  }

  // Scan rows
  for (let row = 0; row < size; row++) {
    const cells: Array<{ row: number; col: number }> = [];
    for (let col = 0; col < size; col++) {
      if (board[row]![col] === 0) cells.push({ row, col });
    }
    processUnit(cells);
  }

  // Scan columns
  for (let col = 0; col < size; col++) {
    const cells: Array<{ row: number; col: number }> = [];
    for (let row = 0; row < size; row++) {
      if (board[row]![col] === 0) cells.push({ row, col });
    }
    processUnit(cells);
  }

  // Scan boxes
  for (let boxRow = 0; boxRow < size; boxRow += boxSize) {
    for (let boxCol = 0; boxCol < size; boxCol += boxSize) {
      const cells: Array<{ row: number; col: number }> = [];
      for (let r = boxRow; r < boxRow + boxSize; r++) {
        for (let c = boxCol; c < boxCol + boxSize; c++) {
          if (board[r]![c] === 0) cells.push({ row: r, col: c });
        }
      }
      processUnit(cells);
    }
  }

  const moves: LogicalMove[] = [];
  for (const { patternCells, eliminations } of pairMap.values()) {
    if (eliminations.size === 0) continue;
    moves.push({
      type: "elimination",
      technique: "Hidden Pair",
      patternCells,
      eliminations: [...eliminations.values()],
    });
  }
  return moves;
}

export function findPointingPairs(ctx: HumanSolverContext): LogicalMove[] {
  const { board, size, boxSize, candidateMap } = ctx;
  const pairMap = new Map<
    string,
    {
      patternCells: Array<{ row: number; col: number }>;
      eliminations: Map<string, { row: number; col: number; value: number }>;
    }
  >();

  for (let boxRow = 0; boxRow < size; boxRow += boxSize) {
    for (let boxCol = 0; boxCol < size; boxCol += boxSize) {
      const valueCells = new Map<
        number,
        Array<{ row: number; col: number }>
      >();

      for (let r = boxRow; r < boxRow + boxSize; r++) {
        for (let c = boxCol; c < boxCol + boxSize; c++) {
          if (board[r]![c] !== 0) continue;
          const list = candidateMap[r]![c]!;
          for (const v of list) {
            const arr = valueCells.get(v) ?? [];
            arr.push({ row: r, col: c });
            valueCells.set(v, arr);
          }
        }
      }

      for (const [v, cells] of valueCells) {
        if (cells.length < 2) continue;

        const rows = new Set<number>();
        const cols = new Set<number>();
        for (const c of cells) {
          rows.add(c.row);
          cols.add(c.col);
        }

        if (rows.size === 1) {
          const row = rows.values().next().value;
          if (row === undefined) continue;
          const eliminations = new Map<
            string,
            { row: number; col: number; value: number }
          >();

          for (let col = 0; col < size; col++) {
            if (col >= boxCol && col < boxCol + boxSize) continue;
            if (board[row]![col] !== 0) continue;
            const list = candidateMap[row]![col]!;
            if (list.includes(v)) {
              const ek = eliminationCellKey(row, col, v);
              if (!eliminations.has(ek)) {
                eliminations.set(ek, { row, col, value: v });
              }
            }
          }

          if (eliminations.size > 0) {
            const dk = `pointing-${boxRow},${boxCol}-row-${row}-val-${v}`;
            if (!pairMap.has(dk)) {
              pairMap.set(dk, {
                patternCells: cells.map((c) => ({
                  row: c.row,
                  col: c.col,
                })),
                eliminations,
              });
            }
          }
        }

        if (cols.size === 1) {
          const col = cols.values().next().value;
          if (col === undefined) continue;
          const eliminations = new Map<
            string,
            { row: number; col: number; value: number }
          >();

          for (let row = 0; row < size; row++) {
            if (row >= boxRow && row < boxRow + boxSize) continue;
            if (board[row]![col] !== 0) continue;
            const list = candidateMap[row]![col]!;
            if (list.includes(v)) {
              const ek = eliminationCellKey(row, col, v);
              if (!eliminations.has(ek)) {
                eliminations.set(ek, { row, col, value: v });
              }
            }
          }

          if (eliminations.size > 0) {
            const dk = `pointing-${boxRow},${boxCol}-col-${col}-val-${v}`;
            if (!pairMap.has(dk)) {
              pairMap.set(dk, {
                patternCells: cells.map((c) => ({
                  row: c.row,
                  col: c.col,
                })),
                eliminations,
              });
            }
          }
        }
      }
    }
  }

  const moves: LogicalMove[] = [];
  for (const { patternCells, eliminations } of pairMap.values()) {
    moves.push({
      type: "elimination",
      technique: "Pointing Pair",
      patternCells,
      eliminations: [...eliminations.values()],
    });
  }
  return moves;
}

export function findClaimingPairs(ctx: HumanSolverContext): LogicalMove[] {
  const { board, size, boxSize, candidateMap } = ctx;
  const pairMap = new Map<
    string,
    {
      patternCells: Array<{ row: number; col: number }>;
      eliminations: Map<string, { row: number; col: number; value: number }>;
    }
  >();

  // Scan rows
  for (let row = 0; row < size; row++) {
    const valueCells = new Map<
      number,
      Array<{ row: number; col: number }>
    >();

    for (let col = 0; col < size; col++) {
      if (board[row]![col] !== 0) continue;
      const list = candidateMap[row]![col]!;
      for (const v of list) {
        const arr = valueCells.get(v) ?? [];
        arr.push({ row, col });
        valueCells.set(v, arr);
      }
    }

    for (const [v, cells] of valueCells) {
      if (cells.length < 2) continue;

      // Check if all cells share one box
      const boxCols = new Set<number>();
      for (const c of cells) {
        boxCols.add(Math.floor(c.col / boxSize) * boxSize);
      }
      if (boxCols.size !== 1) continue;

      const boxRow = Math.floor(row / boxSize) * boxSize;
      const boxCol = boxCols.values().next().value!;
      const eliminations = new Map<
        string,
        { row: number; col: number; value: number }
      >();

      for (let r = boxRow; r < boxRow + boxSize; r++) {
        if (r === row) continue;
        for (let c = boxCol; c < boxCol + boxSize; c++) {
          if (board[r]![c] !== 0) continue;
          const list = candidateMap[r]![c]!;
          if (list.includes(v)) {
            const ek = eliminationCellKey(r, c, v);
            if (!eliminations.has(ek)) {
              eliminations.set(ek, { row: r, col: c, value: v });
            }
          }
        }
      }

      if (eliminations.size > 0) {
        const dk = `claiming-row-${row}-box-${boxRow},${boxCol}-val-${v}`;
        if (!pairMap.has(dk)) {
          pairMap.set(dk, {
            patternCells: cells.map((c) => ({ row: c.row, col: c.col })),
            eliminations,
          });
        }
      }
    }
  }

  // Scan columns
  for (let col = 0; col < size; col++) {
    const valueCells = new Map<
      number,
      Array<{ row: number; col: number }>
    >();

    for (let row = 0; row < size; row++) {
      if (board[row]![col] !== 0) continue;
      const list = candidateMap[row]![col]!;
      for (const v of list) {
        const arr = valueCells.get(v) ?? [];
        arr.push({ row, col });
        valueCells.set(v, arr);
      }
    }

    for (const [v, cells] of valueCells) {
      if (cells.length < 2) continue;

      // Check if all cells share one box
      const boxRows = new Set<number>();
      for (const c of cells) {
        boxRows.add(Math.floor(c.row / boxSize) * boxSize);
      }
      if (boxRows.size !== 1) continue;

      const boxRow = boxRows.values().next().value!;
      const boxCol = Math.floor(col / boxSize) * boxSize;
      const eliminations = new Map<
        string,
        { row: number; col: number; value: number }
      >();

      for (let r = boxRow; r < boxRow + boxSize; r++) {
        for (let c = boxCol; c < boxCol + boxSize; c++) {
          if (c === col) continue;
          if (board[r]![c] !== 0) continue;
          const list = candidateMap[r]![c]!;
          if (list.includes(v)) {
            const ek = eliminationCellKey(r, c, v);
            if (!eliminations.has(ek)) {
              eliminations.set(ek, { row: r, col: c, value: v });
            }
          }
        }
      }

      if (eliminations.size > 0) {
        const dk = `claiming-col-${col}-box-${boxRow},${boxCol}-val-${v}`;
        if (!pairMap.has(dk)) {
          pairMap.set(dk, {
            patternCells: cells.map((c) => ({ row: c.row, col: c.col })),
            eliminations,
          });
        }
      }
    }
  }

  const moves: LogicalMove[] = [];
  for (const { patternCells, eliminations } of pairMap.values()) {
    moves.push({
      type: "elimination",
      technique: "Claiming Pair",
      patternCells,
      eliminations: [...eliminations.values()],
    });
  }
  return moves;
}

export function findXWings(ctx: HumanSolverContext): LogicalMove[] {
  const { board, size, candidateMap } = ctx;
  const xwingMap = new Map<
    string,
    {
      patternCells: Array<{ row: number; col: number }>;
      eliminations: Map<string, { row: number; col: number; value: number }>;
    }
  >();

  // Row-based X-Wing
  for (let v = 1; v <= size; v++) {
    const rowCols = new Map<number, number[]>();

    for (let row = 0; row < size; row++) {
      const cols: number[] = [];
      for (let col = 0; col < size; col++) {
        if (board[row]![col] !== 0) continue;
        const list = candidateMap[row]![col]!;
        if (list.includes(v)) {
          cols.push(col);
        }
      }
      if (cols.length === 2) {
        rowCols.set(row, cols);
      }
    }

    const rows = [...rowCols.keys()];
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const r1 = rows[i]!;
        const r2 = rows[j]!;
        const cols1 = rowCols.get(r1)!;
        const cols2 = rowCols.get(r2)!;

        const c1 = cols1[0]!;
        const c2 = cols1[1]!;
        if (cols2[0] === c1 && cols2[1] === c2) {
          // X-Wing found: rows r1, r2; columns c1, c2
          const eliminations = new Map<
            string,
            { row: number; col: number; value: number }
          >();

          for (let row = 0; row < size; row++) {
            if (row === r1 || row === r2) continue;
            for (const c of [c1, c2]) {
              if (board[row]![c] !== 0) continue;
              const list = candidateMap[row]![c]!;
              if (list.includes(v)) {
                const ek = eliminationCellKey(row, c, v);
                if (!eliminations.has(ek)) {
                  eliminations.set(ek, { row, col: c, value: v });
                }
              }
            }
          }

          if (eliminations.size > 0) {
            const patternCells = [
              { row: r1, col: c1 },
              { row: r1, col: c2 },
              { row: r2, col: c1 },
              { row: r2, col: c2 },
            ].sort((a, b) => a.row - b.row || a.col - b.col);
            const dk = `xwing-v${v}-${patternCells.map((c) => `${c.row},${c.col}`).join("-")}`;
            const existing = xwingMap.get(dk);
            if (existing) {
              for (const [ek, e] of eliminations) {
                if (!existing.eliminations.has(ek)) {
                  existing.eliminations.set(ek, e);
                }
              }
            } else {
              xwingMap.set(dk, { patternCells, eliminations });
            }
          }
        }
      }
    }
  }

  // Column-based X-Wing
  for (let v = 1; v <= size; v++) {
    const colRows = new Map<number, number[]>();

    for (let col = 0; col < size; col++) {
      const rows: number[] = [];
      for (let row = 0; row < size; row++) {
        if (board[row]![col] !== 0) continue;
        const list = candidateMap[row]![col]!;
        if (list.includes(v)) {
          rows.push(row);
        }
      }
      if (rows.length === 2) {
        colRows.set(col, rows);
      }
    }

    const cols = [...colRows.keys()];
    for (let i = 0; i < cols.length; i++) {
      for (let j = i + 1; j < cols.length; j++) {
        const c1 = cols[i]!;
        const c2 = cols[j]!;
        const rows1 = colRows.get(c1)!;
        const rows2 = colRows.get(c2)!;

        const r1 = rows1[0]!;
        const r2 = rows1[1]!;
        if (rows2[0] === r1 && rows2[1] === r2) {
          // X-Wing found: columns c1, c2; rows r1, r2
          const eliminations = new Map<
            string,
            { row: number; col: number; value: number }
          >();

          for (let col = 0; col < size; col++) {
            if (col === c1 || col === c2) continue;
            for (const r of [r1, r2]) {
              if (board[r]![col] !== 0) continue;
              const list = candidateMap[r]![col]!;
              if (list.includes(v)) {
                const ek = eliminationCellKey(r, col, v);
                if (!eliminations.has(ek)) {
                  eliminations.set(ek, { row: r, col, value: v });
                }
              }
            }
          }

          if (eliminations.size > 0) {
            const patternCells = [
              { row: r1, col: c1 },
              { row: r1, col: c2 },
              { row: r2, col: c1 },
              { row: r2, col: c2 },
            ].sort((a, b) => a.row - b.row || a.col - b.col);
            const dk = `xwing-v${v}-${patternCells.map((c) => `${c.row},${c.col}`).join("-")}`;
            // Merge eliminations with any existing row-based entry for this X-Wing
            const existing = xwingMap.get(dk);
            if (existing) {
              for (const [ek, e] of eliminations) {
                if (!existing.eliminations.has(ek)) {
                  existing.eliminations.set(ek, e);
                }
              }
            } else {
              xwingMap.set(dk, { patternCells, eliminations });
            }
          }
        }
      }
    }
  }

  const moves: LogicalMove[] = [];
  for (const { patternCells, eliminations } of xwingMap.values()) {
    moves.push({
      type: "elimination",
      technique: "X-Wing",
      patternCells,
      eliminations: [...eliminations.values()],
    });
  }
  return moves;
}

export function findXYWing(ctx: HumanSolverContext): LogicalMove[] {
  const { board, size, boxSize, candidateMap } = ctx;

  // Collect all bi-value cells as potential pivots
  const biValueCells: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r]![c] !== 0) continue;
      if (candidateMap[r]![c]!.length === 2) {
        biValueCells.push({ row: r, col: c });
      }
    }
  }

  const xyMap = new Map<
    string,
    {
      patternCells: Array<{ row: number; col: number }>;
      eliminations: Map<string, { row: number; col: number; value: number }>;
    }
  >();

  for (const pivot of biValueCells) {
    const pivotCands = candidateMap[pivot.row]![pivot.col]!;
    const [x, y] = pivotCands;

    // Find potential wings: bi-value cells that see the pivot and share exactly one candidate
    const wings: Array<{ row: number; col: number }> = [];
    for (const cell of biValueCells) {
      if (cell.row === pivot.row && cell.col === pivot.col) continue;
      if (!seeEachOther(pivot.row, pivot.col, cell.row, cell.col, boxSize)) continue;
 
      const cands = candidateMap[cell.row]![cell.col]!;
      const shared = cands.filter((c) => c === x || c === y);
      if (shared.length !== 1) continue;

      wings.push(cell);
    }

    // Pair wings: one shares X with pivot, the other shares Y, same Z value
    for (let i = 0; i < wings.length; i++) {
      for (let j = i + 1; j < wings.length; j++) {
        const wingA = wings[i]!;
        const wingB = wings[j]!;

        // Wings must not see each other
        if (seeEachOther(wingA.row, wingA.col, wingB.row, wingB.col, boxSize)) continue;
 
        const candsA = candidateMap[wingA.row]![wingA.col]!;
        const candsB = candidateMap[wingB.row]![wingB.col]!;

        const sharedA = candsA.find((c) => c === x || c === y)!;
        const sharedB = candsB.find((c) => c === x || c === y)!;

        // Shared candidates must differ (one must be X, the other Y)
        if (sharedA === sharedB) continue;

        // Both wings must share the same Z value
        const zA = candsA.find((c) => c !== sharedA)!;
        const zB = candsB.find((c) => c !== sharedB)!;
        if (zA !== zB) continue;

        const z = zA;

        // Find cells that see both wings and contain Z as a candidate
        const eliminations = new Map<
          string,
          { row: number; col: number; value: number }
        >();

        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (board[r]![c] !== 0) continue;
            if (
              (r === pivot.row && c === pivot.col) ||
              (r === wingA.row && c === wingA.col) ||
              (r === wingB.row && c === wingB.col)
            )
              continue;

            const cellCands = candidateMap[r]![c]!;
            if (!cellCands.includes(z)) continue;

            if (
              seeEachOther(r, c, wingA.row, wingA.col, boxSize) &&
              seeEachOther(r, c, wingB.row, wingB.col, boxSize)
            ) {
              const ek = eliminationCellKey(r, c, z);
              if (!eliminations.has(ek)) {
                eliminations.set(ek, { row: r, col: c, value: z });
              }
            }
          }
        }

        if (eliminations.size > 0) {
          const patternCells = [
            { row: pivot.row, col: pivot.col },
            { row: wingA.row, col: wingA.col },
            { row: wingB.row, col: wingB.col },
          ].sort((a, b) => a.row - b.row || a.col - b.col);

          const dk = `xywing-${patternCells.map((c) => `${c.row},${c.col}`).join("-")}-z${z}`;
          const existing = xyMap.get(dk);
          if (existing) {
            for (const [ek, e] of eliminations) {
              if (!existing.eliminations.has(ek)) {
                existing.eliminations.set(ek, e);
              }
            }
          } else {
            xyMap.set(dk, { patternCells, eliminations });
          }
        }
      }
    }
  }

  const moves: LogicalMove[] = [];
  for (const { patternCells, eliminations } of xyMap.values()) {
    moves.push({
      type: "elimination",
      technique: "XY-Wing",
      patternCells,
      eliminations: [...eliminations.values()],
    });
  }
  return moves;
}

export function findSwordfish(ctx: HumanSolverContext): LogicalMove[] {
  const { board, size, candidateMap } = ctx;
  const swordfishMap = new Map<
    string,
    {
      patternCells: Array<{ row: number; col: number }>;
      eliminations: Map<string, { row: number; col: number; value: number }>;
    }
  >();

  // Row-based Swordfish
  for (let v = 1; v <= size; v++) {
    const rowCols = new Map<number, number[]>();

    for (let row = 0; row < size; row++) {
      const cols: number[] = [];
      for (let col = 0; col < size; col++) {
        if (board[row]![col] !== 0) continue;
        const list = candidateMap[row]![col]!;
        if (list.includes(v)) {
          cols.push(col);
        }
      }
      if (cols.length >= 2 && cols.length <= 3) {
        rowCols.set(row, cols);
      }
    }

    const candidateRows = [...rowCols.keys()];
    for (let i = 0; i < candidateRows.length; i++) {
      for (let j = i + 1; j < candidateRows.length; j++) {
        for (let k = j + 1; k < candidateRows.length; k++) {
          const r1 = candidateRows[i]!;
          const r2 = candidateRows[j]!;
          const r3 = candidateRows[k]!;
          const cols1 = rowCols.get(r1)!;
          const cols2 = rowCols.get(r2)!;
          const cols3 = rowCols.get(r3)!;

          const union = new Set<number>();
          for (const c of cols1) union.add(c);
          for (const c of cols2) union.add(c);
          for (const c of cols3) union.add(c);

          if (union.size !== 3) continue;
          const patternCols = [...union];

          const eliminations = new Map<
            string,
            { row: number; col: number; value: number }
          >();

          for (const c of patternCols) {
            for (let row = 0; row < size; row++) {
              if (row === r1 || row === r2 || row === r3) continue;
              if (board[row]![c] !== 0) continue;
              const list = candidateMap[row]![c]!;
              if (list.includes(v)) {
                const ek = eliminationCellKey(row, c, v);
                if (!eliminations.has(ek)) {
                  eliminations.set(ek, { row, col: c, value: v });
                }
              }
            }
          }

          if (eliminations.size > 0) {
            const patternCells: Array<{ row: number; col: number }> = [];
            for (const r of [r1, r2, r3]) {
              const rowCandidateCols = rowCols.get(r)!;
              for (const c of rowCandidateCols) {
                patternCells.push({ row: r, col: c });
              }
            }
            patternCells.sort((a, b) => a.row - b.row || a.col - b.col);
            const dk = `swordfish-v${v}-${patternCells.map((c) => `${c.row},${c.col}`).join("-")}`;
            const existing = swordfishMap.get(dk);
            if (existing) {
              for (const [ek, e] of eliminations) {
                if (!existing.eliminations.has(ek)) {
                  existing.eliminations.set(ek, e);
                }
              }
            } else {
              swordfishMap.set(dk, { patternCells, eliminations });
            }
          }
        }
      }
    }
  }

  // Column-based Swordfish
  for (let v = 1; v <= size; v++) {
    const colRows = new Map<number, number[]>();

    for (let col = 0; col < size; col++) {
      const rows: number[] = [];
      for (let row = 0; row < size; row++) {
        if (board[row]![col] !== 0) continue;
        const list = candidateMap[row]![col]!;
        if (list.includes(v)) {
          rows.push(row);
        }
      }
      if (rows.length >= 2 && rows.length <= 3) {
        colRows.set(col, rows);
      }
    }

    const candidateCols = [...colRows.keys()];
    for (let i = 0; i < candidateCols.length; i++) {
      for (let j = i + 1; j < candidateCols.length; j++) {
        for (let k = j + 1; k < candidateCols.length; k++) {
          const c1 = candidateCols[i]!;
          const c2 = candidateCols[j]!;
          const c3 = candidateCols[k]!;
          const rows1 = colRows.get(c1)!;
          const rows2 = colRows.get(c2)!;
          const rows3 = colRows.get(c3)!;

          const union = new Set<number>();
          for (const r of rows1) union.add(r);
          for (const r of rows2) union.add(r);
          for (const r of rows3) union.add(r);

          if (union.size !== 3) continue;
          const patternRows = [...union];

          const eliminations = new Map<
            string,
            { row: number; col: number; value: number }
          >();

          for (const r of patternRows) {
            for (let col = 0; col < size; col++) {
              if (col === c1 || col === c2 || col === c3) continue;
              if (board[r]![col] !== 0) continue;
              const list = candidateMap[r]![col]!;
              if (list.includes(v)) {
                const ek = eliminationCellKey(r, col, v);
                if (!eliminations.has(ek)) {
                  eliminations.set(ek, { row: r, col, value: v });
                }
              }
            }
          }

          if (eliminations.size > 0) {
            const patternCells: Array<{ row: number; col: number }> = [];
            for (const c of [c1, c2, c3]) {
              const colCandidateRows = colRows.get(c)!;
              for (const r of colCandidateRows) {
                patternCells.push({ row: r, col: c });
              }
            }
            patternCells.sort((a, b) => a.row - b.row || a.col - b.col);
            const dk = `swordfish-v${v}-${patternCells.map((c) => `${c.row},${c.col}`).join("-")}`;
            const existing = swordfishMap.get(dk);
            if (existing) {
              for (const [ek, e] of eliminations) {
                if (!existing.eliminations.has(ek)) {
                  existing.eliminations.set(ek, e);
                }
              }
            } else {
              swordfishMap.set(dk, { patternCells, eliminations });
            }
          }
        }
      }
    }
  }

  const moves: LogicalMove[] = [];
  for (const { patternCells, eliminations } of swordfishMap.values()) {
    moves.push({
      type: "elimination",
      technique: "Swordfish",
      patternCells,
      eliminations: [...eliminations.values()],
    });
  }
  return moves;
}

export function findSkyscraper(ctx: HumanSolverContext): LogicalMove[] {
  const { board, size, boxSize, candidateMap } = ctx;
  const skyMap = new Map<
    string,
    {
      patternCells: Array<{ row: number; col: number }>;
      eliminations: Map<string, { row: number; col: number; value: number }>;
    }
  >();

  // Row-based Skyscraper
  for (let v = 1; v <= size; v++) {
    const rowCols = new Map<number, number[]>();

    for (let row = 0; row < size; row++) {
      const cols: number[] = [];
      for (let col = 0; col < size; col++) {
        if (board[row]![col] !== 0) continue;
        if (candidateMap[row]![col]!.includes(v)) {
          cols.push(col);
        }
      }
      if (cols.length === 2) {
        rowCols.set(row, cols);
      }
    }

    const rows = [...rowCols.keys()];
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const r1 = rows[i]!;
        const r2 = rows[j]!;
        const cols1 = rowCols.get(r1)!;
        const cols2 = rowCols.get(r2)!;

        // Find shared column (base)
        let baseCol: number;
        let topCol1: number;
        let topCol2: number;

        if (cols1[0]! === cols2[0]!) {
          baseCol = cols1[0]!; topCol1 = cols1[1]!; topCol2 = cols2[1]!;
        } else if (cols1[0]! === cols2[1]!) {
          baseCol = cols1[0]!; topCol1 = cols1[1]!; topCol2 = cols2[0]!;
        } else if (cols1[1]! === cols2[0]!) {
          baseCol = cols1[1]!; topCol1 = cols1[0]!; topCol2 = cols2[1]!;
        } else if (cols1[1]! === cols2[1]!) {
          baseCol = cols1[1]!; topCol1 = cols1[0]!; topCol2 = cols2[0]!;
        } else {
          continue;
        }

        // Top cells: (r1, topCol1) and (r2, topCol2)
        // Eliminate v from any cell that sees both top cells
        const eliminations = new Map<
          string,
          { row: number; col: number; value: number }
        >();

        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (board[r]![c] !== 0) continue;

            // Skip the four pattern cells themselves
            if ((r === r1 || r === r2) && c === baseCol) continue;
            if (r === r1 && c === topCol1) continue;
            if (r === r2 && c === topCol2) continue;

            if (!candidateMap[r]![c]!.includes(v)) continue;

            if (
              seeEachOther(r, c, r1, topCol1, boxSize) &&
              seeEachOther(r, c, r2, topCol2, boxSize)
            ) {
              const ek = eliminationCellKey(r, c, v);
              if (!eliminations.has(ek)) {
                eliminations.set(ek, { row: r, col: c, value: v });
              }
            }
          }
        }

        if (eliminations.size > 0) {
          const patternCells = [
            { row: r1, col: baseCol },
            { row: r1, col: topCol1 },
            { row: r2, col: baseCol },
            { row: r2, col: topCol2 },
          ].sort((a, b) => a.row - b.row || a.col - b.col);

          const dk = `skyscraper-row-v${v}-${patternCells.map((c) => `${c.row},${c.col}`).join("-")}`;
          const existing = skyMap.get(dk);
          if (existing) {
            for (const [ek, e] of eliminations) {
              if (!existing.eliminations.has(ek)) {
                existing.eliminations.set(ek, e);
              }
            }
          } else {
            skyMap.set(dk, { patternCells, eliminations });
          }
        }
      }
    }
  }

  // Column-based Skyscraper
  for (let v = 1; v <= size; v++) {
    const colRows = new Map<number, number[]>();

    for (let col = 0; col < size; col++) {
      const rows: number[] = [];
      for (let row = 0; row < size; row++) {
        if (board[row]![col] !== 0) continue;
        if (candidateMap[row]![col]!.includes(v)) {
          rows.push(row);
        }
      }
      if (rows.length === 2) {
        colRows.set(col, rows);
      }
    }

    const cols = [...colRows.keys()];
    for (let i = 0; i < cols.length; i++) {
      for (let j = i + 1; j < cols.length; j++) {
        const c1 = cols[i]!;
        const c2 = cols[j]!;
        const rows1 = colRows.get(c1)!;
        const rows2 = colRows.get(c2)!;

        // Find shared row (base)
        let baseRow: number;
        let topRow1: number;
        let topRow2: number;

        if (rows1[0]! === rows2[0]!) {
          baseRow = rows1[0]!; topRow1 = rows1[1]!; topRow2 = rows2[1]!;
        } else if (rows1[0]! === rows2[1]!) {
          baseRow = rows1[0]!; topRow1 = rows1[1]!; topRow2 = rows2[0]!;
        } else if (rows1[1]! === rows2[0]!) {
          baseRow = rows1[1]!; topRow1 = rows1[0]!; topRow2 = rows2[1]!;
        } else if (rows1[1]! === rows2[1]!) {
          baseRow = rows1[1]!; topRow1 = rows1[0]!; topRow2 = rows2[0]!;
        } else {
          continue;
        }

        // Top cells: (topRow1, c1) and (topRow2, c2)
        const eliminations = new Map<
          string,
          { row: number; col: number; value: number }
        >();

        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (board[r]![c] !== 0) continue;

            // Skip the four pattern cells themselves
            if (r === baseRow && (c === c1 || c === c2)) continue;
            if (r === topRow1 && c === c1) continue;
            if (r === topRow2 && c === c2) continue;

            if (!candidateMap[r]![c]!.includes(v)) continue;

            if (
              seeEachOther(r, c, topRow1, c1, boxSize) &&
              seeEachOther(r, c, topRow2, c2, boxSize)
            ) {
              const ek = eliminationCellKey(r, c, v);
              if (!eliminations.has(ek)) {
                eliminations.set(ek, { row: r, col: c, value: v });
              }
            }
          }
        }

        if (eliminations.size > 0) {
          const patternCells = [
            { row: baseRow, col: c1 },
            { row: topRow1, col: c1 },
            { row: baseRow, col: c2 },
            { row: topRow2, col: c2 },
          ].sort((a, b) => a.row - b.row || a.col - b.col);

          const dk = `skyscraper-col-v${v}-${patternCells.map((c) => `${c.row},${c.col}`).join("-")}`;
          const existing = skyMap.get(dk);
          if (existing) {
            for (const [ek, e] of eliminations) {
              if (!existing.eliminations.has(ek)) {
                existing.eliminations.set(ek, e);
              }
            }
          } else {
            skyMap.set(dk, { patternCells, eliminations });
          }
        }
      }
    }
  }

  const moves: LogicalMove[] = [];
  for (const { patternCells, eliminations } of skyMap.values()) {
    moves.push({
      type: "elimination",
      technique: "Skyscraper",
      patternCells,
      eliminations: [...eliminations.values()],
    });
  }
  return moves;
}
