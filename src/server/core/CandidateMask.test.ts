import { describe, it, expect } from "vitest";
import {
  hasCandidate,
  addCandidate,
  removeCandidate,
  candidateCount,
  iterateCandidates,
  firstCandidate,
  candidateKey,
  hasIntersection,
  maskFromValues,
  toArray,
  maskSize,
  intersectionCount,
} from "./CandidateMask";

describe("hasCandidate", () => {
  it("returns true when the bit is set", () => {
    const mask = 1 << 2; // value 3
    expect(hasCandidate(mask, 3)).toBe(true);
  });

  it("returns false when the bit is not set", () => {
    const mask = 1 << 2; // value 3
    expect(hasCandidate(mask, 2)).toBe(false);
  });

  it("returns false for mask 0", () => {
    expect(hasCandidate(0, 1)).toBe(false);
  });
});

describe("addCandidate", () => {
  it("sets the bit for a value", () => {
    const m = addCandidate(0, 5);
    expect(hasCandidate(m, 5)).toBe(true);
  });

  it("is idempotent", () => {
    const m = addCandidate(addCandidate(0, 5), 5);
    expect(candidateCount(m)).toBe(1);
  });
});

describe("removeCandidate", () => {
  it("clears the bit for a value", () => {
    const m = removeCandidate(0b111, 2);
    expect(hasCandidate(m, 2)).toBe(false);
    expect(candidateCount(m)).toBe(2);
  });

  it("is a no-op when value not present", () => {
    const m = removeCandidate(0, 5);
    expect(m).toBe(0);
  });
});

describe("candidateCount", () => {
  it("returns 0 for empty mask", () => {
    expect(candidateCount(0)).toBe(0);
  });

  it("counts set bits", () => {
    const mask = (1 << 0) | (1 << 3) | (1 << 8); // values 1, 4, 9
    expect(candidateCount(mask)).toBe(3);
  });
});

describe("iterateCandidates", () => {
  it("iterates over set values in ascending order", () => {
    const mask = (1 << 0) | (1 << 3) | (1 << 8); // values 1, 4, 9
    const result: number[] = [];
    iterateCandidates(mask, (v) => result.push(v));
    expect(result).toEqual([1, 4, 9]);
  });

  it("calls nothing for empty mask", () => {
    const result: number[] = [];
    iterateCandidates(0, (v) => result.push(v));
    expect(result).toEqual([]);
  });
});

describe("firstCandidate", () => {
  it("returns the smallest value", () => {
    const mask = (1 << 4) | (1 << 0) | (1 << 8); // values 5, 1, 9
    expect(firstCandidate(mask)).toBe(1);
  });

  it("returns null for empty mask", () => {
    expect(firstCandidate(0)).toBeNull();
  });
});

describe("candidateKey", () => {
  it("produces a sorted comma-separated key", () => {
    const mask = (1 << 4) | (1 << 0) | (1 << 8); // values 5, 1, 9
    expect(candidateKey(mask)).toBe("1,5,9");
  });

  it("returns empty string for empty mask", () => {
    expect(candidateKey(0)).toBe("");
  });
});

describe("hasIntersection", () => {
  it("returns true when masks share a bit", () => {
    const a = (1 << 0) | (1 << 2); // 1, 3
    const b = (1 << 2) | (1 << 4); // 3, 5
    expect(hasIntersection(a, b)).toBe(true);
  });

  it("returns false when masks are disjoint", () => {
    const a = (1 << 0) | (1 << 2); // 1, 3
    const b = (1 << 4) | (1 << 6); // 5, 7
    expect(hasIntersection(a, b)).toBe(false);
  });
});

describe("maskFromValues", () => {
  it("creates a mask from an array of values", () => {
    const mask = maskFromValues([1, 4, 9]);
    expect(hasCandidate(mask, 1)).toBe(true);
    expect(hasCandidate(mask, 4)).toBe(true);
    expect(hasCandidate(mask, 9)).toBe(true);
    expect(candidateCount(mask)).toBe(3);
  });

  it("returns 0 for empty array", () => {
    expect(maskFromValues([])).toBe(0);
  });
});

describe("toArray", () => {
  it("returns sorted array of candidate values", () => {
    const mask = (1 << 4) | (1 << 0) | (1 << 8); // values 5, 1, 9
    expect(toArray(mask)).toEqual([1, 5, 9]);
  });

  it("returns empty array for empty mask", () => {
    expect(toArray(0)).toEqual([]);
  });
});

describe("maskSize", () => {
  it("is an alias for candidateCount", () => {
    const mask = (1 << 0) | (1 << 3) | (1 << 8);
    expect(maskSize(mask)).toBe(3);
  });
});

describe("intersectionCount", () => {
  it("counts shared bits between two masks", () => {
    const a = (1 << 0) | (1 << 2) | (1 << 4); // 1, 3, 5
    const b = (1 << 2) | (1 << 4) | (1 << 6); // 3, 5, 7
    expect(intersectionCount(a, b)).toBe(2); // 3 and 5
  });

  it("returns 0 for disjoint masks", () => {
    const a = (1 << 0) | (1 << 2);
    const b = (1 << 4) | (1 << 6);
    expect(intersectionCount(a, b)).toBe(0);
  });
});
