import { describe, it, expect } from "vitest";
import { getPeerCells, getRowPeers, getColPeers, getBoxPeers } from "./PeerCache";
import type { GridSize } from "./SudokuValidator";

describe("PeerCache — 9×9", () => {
  const SIZE_9: GridSize = 9;

  it("returns correct peer count for corner (0,0)", () => {
    const peers = getPeerCells(SIZE_9, 0, 0);
    // row (8) + col (8) + box (8) - overlaps (row/col 0)
    // Row: 1..8 (8 cells)
    // Col: 1..8 (8 cells)
    // Box: (0,1),(0,2),(1,0),(1,1),(1,2),(2,0),(2,1),(2,2) - (0,0) omitted = 8, but (0,1),(0,2) overlap row, (1,0),(2,0) overlap col
    // Unique: row 8 + col (8 - 1 row overlap counted above) + box (8 - 2 row - 2 col - 1 self) = 8 + 7 + 5 = 20
    expect(peers.length).toBe(20);
  });

  it("returns correct peer count for center (4,4)", () => {
    const peers = getPeerCells(SIZE_9, 4, 4);
    // Row: 8, Col: 8, Box (3-5,3-5): 8, overlaps: row/col intersect at 2, box overlaps row/col at 2+2=4
    // 8 + 8 + 8 - 4 = 20
    expect(peers.length).toBe(20);
  });

  it("returns correct peer count for edge-center (0,4)", () => {
    const peers = getPeerCells(SIZE_9, 0, 4);
    expect(peers.length).toBe(20);
  });

  it("contains no self-reference", () => {
    const peers = getPeerCells(SIZE_9, 3, 5);
    for (const [r, c] of peers) {
      expect(r === 3 && c === 5).toBe(false);
    }
  });

  it("contains no duplicate cell references", () => {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const peers = getPeerCells(SIZE_9, r, c);
        const seen = new Set<string>();
        for (const [pr, pc] of peers) {
          const key = `${pr},${pc}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
      }
    }
  });

  it("every peer of (r,c) contains (r,c) as a peer (symmetry)", () => {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const peers = getPeerCells(SIZE_9, r, c);
        for (const [pr, pc] of peers) {
          const backPeers = getPeerCells(SIZE_9, pr, pc);
          const found = backPeers.some(([br, bc]) => br === r && bc === c);
          expect(found).toBe(true);
        }
      }
    }
  });

  it("all peers share row, column, or box", () => {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const br = Math.floor(r / 3) * 3;
        const bc = Math.floor(c / 3) * 3;
        for (const [pr, pc] of getPeerCells(SIZE_9, r, c)) {
          const sameRow = pr === r;
          const sameCol = pc === c;
          const sameBox = pr >= br && pr < br + 3 && pc >= bc && pc < bc + 3;
          expect(sameRow || sameCol || sameBox).toBe(true);
        }
      }
    }
  });
});

describe("PeerCache — 4×4", () => {
  const SIZE_4: GridSize = 4;

  it("returns correct peer count for corner (0,0)", () => {
    const peers = getPeerCells(SIZE_4, 0, 0);
    // Row: (0,1),(0,2),(0,3) = 3
    // Col: (1,0),(2,0),(3,0) = 3
    // Box [0-1,0-1]: (0,1) overlapped, (1,0) overlapped, (1,1) new = 1
    // Total: 3 + 3 + 1 = 7
    expect(peers.length).toBe(7);
  });

  it("returns correct peer count for center (1,1)", () => {
    const peers = getPeerCells(SIZE_4, 1, 1);
    // Row: (1,0),(1,2),(1,3) = 3
    // Col: (0,1),(2,1),(3,1) = 3
    // Box [0-1,0-1]: (0,0),(0,1) overlapped, (1,0) overlapped, (1,1) self = 1
    // Total: 3 + 3 + 1 = 7
    expect(peers.length).toBe(7);
  });

  it("contains no self-reference", () => {
    const peers = getPeerCells(SIZE_4, 1, 2);
    for (const [r, c] of peers) {
      expect(r === 1 && c === 2).toBe(false);
    }
  });

  it("contains no duplicate cell references", () => {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const peers = getPeerCells(SIZE_4, r, c);
        const seen = new Set<string>();
        for (const [pr, pc] of peers) {
          const key = `${pr},${pc}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
      }
    }
  });

  it("symmetry holds", () => {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const peers = getPeerCells(SIZE_4, r, c);
        for (const [pr, pc] of peers) {
          const back = getPeerCells(SIZE_4, pr, pc);
          expect(back.some(([br, bc]) => br === r && bc === c)).toBe(true);
        }
      }
    }
  });

  it("box peers cover correct cells (2×2)", () => {
    // Box (0,0) covers cells (0,0)(0,1)(1,0)(1,1)
    const peers = getBoxPeers(SIZE_4, 0, 0);
    expect(peers.length).toBe(3);
    const keys = peers.map(([r, c]) => `${r},${c}`).sort();
    expect(keys).toEqual(["0,1", "1,0", "1,1"]);
  });
});

describe("PeerCache — interleaved 4×4 and 9×9 access", () => {
  it("returns different peer lists for 4×4 and 9×9 at same coordinates", () => {
    const p4 = getPeerCells(4 as GridSize, 0, 0);
    const p9 = getPeerCells(9 as GridSize, 0, 0);
    expect(p4.length).toBe(7);
    expect(p9.length).toBe(20);
  });

  it("caches are independent", () => {
    const peers = getPeerCells(9 as GridSize, 0, 0);
    expect(Object.isFrozen(peers)).toBe(true);
  });

  it("access order does not affect results", () => {
    // Access 9×9 first, then 4×4 — should have no cross-contamination
    const p9 = getPeerCells(9 as GridSize, 0, 0);
    const p4 = getPeerCells(4 as GridSize, 0, 0);
    expect(p9.length).toBe(20);
    expect(p4.length).toBe(7);
  });
});

describe("PeerCache — getRowPeers / getColPeers / getBoxPeers", () => {
  const SIZE: GridSize = 9;

  it("getRowPeers returns correct count", () => {
    const peers = getRowPeers(SIZE, 3, 5);
    expect(peers.length).toBe(8);
    for (const [r, c] of peers) {
      expect(r).toBe(3);
      expect(c).not.toBe(5);
    }
  });

  it("getColPeers returns correct count", () => {
    const peers = getColPeers(SIZE, 3, 5);
    expect(peers.length).toBe(8);
    for (const [r, c] of peers) {
      expect(c).toBe(5);
      expect(r).not.toBe(3);
    }
  });

  it("getBoxPeers returns correct count for corner", () => {
    const peers = getBoxPeers(SIZE, 0, 0);
    expect(peers.length).toBe(8);
  });

  it("getBoxPeers returns correct count for center", () => {
    const peers = getBoxPeers(SIZE, 4, 4);
    expect(peers.length).toBe(8);
  });
});

describe("PeerCache — behavioural equivalence with raw loops", () => {
  function rawPeerKeys(row: number, col: number, size: number, boxSize: number): string[] {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (let c = 0; c < size; c++) {
      if (c !== col) { const k = `${row},${c}`; if (!seen.has(k)) { seen.add(k); keys.push(k); } }
    }
    for (let r = 0; r < size; r++) {
      if (r !== row) { const k = `${r},${col}`; if (!seen.has(k)) { seen.add(k); keys.push(k); } }
    }
    const br = Math.floor(row / boxSize) * boxSize;
    const bc = Math.floor(col / boxSize) * boxSize;
    for (let r = br; r < br + boxSize; r++) {
      for (let c = bc; c < bc + boxSize; c++) {
        if (r !== row || c !== col) { const k = `${r},${c}`; if (!seen.has(k)) { seen.add(k); keys.push(k); } }
      }
    }
    return keys;
  }

  function rawPeerCount(size: number): number {
    const boxSize = size === 9 ? 3 : 2;
    let total = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        total += rawPeerKeys(r, c, size, boxSize).length;
      }
    }
    return total;
  }

  it("total unique peer links matches raw loops for 4×4", () => {
    const rawTotal = rawPeerCount(4);
    let cacheTotal = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        cacheTotal += getPeerCells(4 as GridSize, r, c).length;
      }
    }
    expect(cacheTotal).toBe(rawTotal);
  });

  it("total unique peer links matches raw loops for 9×9", () => {
    const rawTotal = rawPeerCount(9);
    let cacheTotal = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        cacheTotal += getPeerCells(9 as GridSize, r, c).length;
      }
    }
    expect(cacheTotal).toBe(rawTotal);
  });
});
