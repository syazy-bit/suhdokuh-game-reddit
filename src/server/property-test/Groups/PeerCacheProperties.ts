import type { PropertyGroup, PropertyContext, PropertyResult, GridSize } from "../types";
import { getPeerCells } from "../../core/PeerCache";

function peerCountForSize(size: GridSize): number {
  return size === 9 ? 20 : 7;
}

function getAllPeerKeys(size: GridSize, row: number, col: number): Set<string> {
  const peers = getPeerCells(size, row, col);
  const set = new Set<string>();
  for (const [r, c] of peers) {
    set.add(`${r},${c}`);
  }
  return set;
}

const properties = [
  {
    name: "peer count matches formula",
    fn: (ctx: PropertyContext): PropertyResult => {
      const size = ctx.size;
      const expected = peerCountForSize(size);
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const peers = getPeerCells(size, r, c);
          if (peers.length !== expected) {
            return {
              pass: false,
              reason: `cell (${r},${c}) in ${size}×${size} has ${peers.length} peers, expected ${expected}`,
            };
          }
        }
      }
      return { pass: true };
    },
  },
  {
    name: "no duplicate peers",
    fn: (ctx: PropertyContext): PropertyResult => {
      const size = ctx.size;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const keys = getAllPeerKeys(size, r, c);
          const peers = getPeerCells(size, r, c);
          if (keys.size !== peers.length) {
            return {
              pass: false,
              reason: `cell (${r},${c}) has ${peers.length} entries but ${keys.size} unique peers`,
            };
          }
        }
      }
      return { pass: true };
    },
  },
  {
    name: "peer list excludes the cell itself",
    fn: (ctx: PropertyContext): PropertyResult => {
      const size = ctx.size;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const keys = getAllPeerKeys(size, r, c);
          if (keys.has(`${r},${c}`)) {
            return {
              pass: false,
              reason: `cell (${r},${c}) contains itself in its peer list`,
            };
          }
        }
      }
      return { pass: true };
    },
  },
  {
    name: "peer symmetry: if A sees B then B sees A",
    fn: (ctx: PropertyContext): PropertyResult => {
      const size = ctx.size;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const peersA = getPeerCells(size, r, c);
          for (const [pr, pc] of peersA) {
            const peersBKeys = getAllPeerKeys(size, pr, pc);
            if (!peersBKeys.has(`${r},${c}`)) {
              return {
                pass: false,
                reason: `cell (${r},${c}) lists (${pr},${pc}) as peer but not vice versa`,
              };
            }
          }
        }
      }
      return { pass: true };
    },
  },
  {
    name: "deterministic regardless of seed",
    fn: (ctx: PropertyContext): PropertyResult => {
      const size = ctx.size;
      const first = getAllPeerKeys(size, 0, 0);
      const second = getAllPeerKeys(size, 0, 0);
      for (const key of first) {
        if (!second.has(key)) {
          return { pass: false, reason: "peer cache not deterministic" };
        }
      }
      return { pass: true };
    },
  },
];

export const peerCacheGroup: PropertyGroup = {
  name: "PeerCache",
  properties,
};
