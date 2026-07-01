import type { GridSize } from "./SudokuValidator";

type PeerList = ReadonlyArray<readonly [number, number]>;

interface CellPeers {
  all: PeerList;
  row: PeerList;
  col: PeerList;
  box: PeerList;
}

type PeerCellCache = CellPeers[][];

const caches = new Map<GridSize, PeerCellCache>();

function getBoxSize(size: GridSize): number {
  return size === 9 ? 3 : 2;
}

function buildPeerCache(size: GridSize): PeerCellCache {
  const boxSize = getBoxSize(size);
  const cache: PeerCellCache = [];
  for (let r = 0; r < size; r++) {
    cache[r] = [];
    for (let c = 0; c < size; c++) {
      const rowPeers: Array<[number, number]> = [];
      for (let cc = 0; cc < size; cc++) {
        if (cc !== c) rowPeers.push([r, cc]);
      }

      const colPeers: Array<[number, number]> = [];
      for (let rr = 0; rr < size; rr++) {
        if (rr !== r) colPeers.push([rr, c]);
      }

      const br = Math.floor(r / boxSize) * boxSize;
      const bc = Math.floor(c / boxSize) * boxSize;
      const boxPeers: Array<[number, number]> = [];
      for (let rr = br; rr < br + boxSize; rr++) {
        for (let cc = bc; cc < bc + boxSize; cc++) {
          if (rr !== r || cc !== c) boxPeers.push([rr, cc]);
        }
      }

      const seen = new Set<number>();
      const allPeers: Array<[number, number]> = [];
      const key = (rr: number, cc: number) => rr * size + cc;
      for (const [rr, cc] of rowPeers) {
        const k = key(rr, cc);
        if (!seen.has(k)) { seen.add(k); allPeers.push([rr, cc]); }
      }
      for (const [rr, cc] of colPeers) {
        const k = key(rr, cc);
        if (!seen.has(k)) { seen.add(k); allPeers.push([rr, cc]); }
      }
      for (const [rr, cc] of boxPeers) {
        const k = key(rr, cc);
        if (!seen.has(k)) { seen.add(k); allPeers.push([rr, cc]); }
      }

      cache[r]![c] = {
        all: Object.freeze(allPeers),
        row: Object.freeze(rowPeers),
        col: Object.freeze(colPeers),
        box: Object.freeze(boxPeers),
      };
    }
  }
  return cache;
}

function getCache(size: GridSize): PeerCellCache {
  let cache = caches.get(size);
  if (!cache) {
    cache = buildPeerCache(size);
    caches.set(size, cache);
  }
  return cache;
}

function getPeerCells(size: GridSize, row: number, col: number): PeerList {
  return getCache(size)[row]![col]!.all;
}

function getRowPeers(size: GridSize, row: number, col: number): PeerList {
  return getCache(size)[row]![col]!.row;
}

function getColPeers(size: GridSize, row: number, col: number): PeerList {
  return getCache(size)[row]![col]!.col;
}

function getBoxPeers(size: GridSize, row: number, col: number): PeerList {
  return getCache(size)[row]![col]!.box;
}

export { getPeerCells, getRowPeers, getColPeers, getBoxPeers };
export type { PeerList };
