import type { PropertyGroup, PropertyContext, PropertyResult } from "../types";
import { fullMask, emptyMask, randomMask, randomNonEmptyMask, randomSingleCandidateMask, maskWithValues } from "../Generators/candidateGenerator";
import { toArray, candidateCount } from "../../core/CandidateMask";

function allOnes(size: number): number {
  return (1 << size) - 1;
}

const properties = [
  {
    name: "fullMask contains every candidate",
    fn: (ctx: PropertyContext): PropertyResult => {
      const mask = fullMask(ctx.size);
      const expected = allOnes(ctx.size);
      return mask === expected
        ? { pass: true }
        : { pass: false, reason: `fullMask(${ctx.size}) = ${mask}, expected ${expected}` };
    },
  },
  {
    name: "emptyMask equals 0",
    fn: (_ctx: PropertyContext): PropertyResult => {
      const mask = emptyMask();
      return mask === 0
        ? { pass: true }
        : { pass: false, reason: `emptyMask() = ${mask}, expected 0` };
    },
  },
  {
    name: "randomMask is within valid bounds",
    fn: (ctx: PropertyContext): PropertyResult => {
      const mask = randomMask(ctx.size, ctx.rng);
      const max = allOnes(ctx.size);
      if (mask < 0 || mask > max) {
        return { pass: false, reason: `randomMask(${ctx.size}) = ${mask}, expected in [0, ${max}]` };
      }
      return { pass: true };
    },
  },
  {
    name: "randomNonEmptyMask never returns 0",
    fn: (ctx: PropertyContext): PropertyResult => {
      const mask = randomNonEmptyMask(ctx.size, ctx.rng);
      return mask !== 0
        ? { pass: true }
        : { pass: false, reason: "randomNonEmptyMask returned 0" };
    },
  },
  {
    name: "randomSingleCandidateMask has exactly one candidate",
    fn: (ctx: PropertyContext): PropertyResult => {
      const mask = randomSingleCandidateMask(ctx.size, ctx.rng);
      const count = candidateCount(mask);
      return count === 1
        ? { pass: true }
        : { pass: false, reason: `randomSingleCandidateMask has ${count} candidates, expected 1` };
    },
  },
  {
    name: "maskWithValues round-trips correctly",
    fn: (ctx: PropertyContext): PropertyResult => {
      const values = [1, 3, ctx.size];
      const mask = maskWithValues(values);
      const roundTrip = toArray(mask);
      const sorted = [...roundTrip].sort((a, b) => a - b);
      return JSON.stringify(sorted) === JSON.stringify(values)
        ? { pass: true }
        : { pass: false, reason: `maskWithValues([${values}]) → [${roundTrip}], expected [${values}]` };
    },
  },
];

export const candidateMaskGroup: PropertyGroup = {
  name: "CandidateMask",
  properties,
};
