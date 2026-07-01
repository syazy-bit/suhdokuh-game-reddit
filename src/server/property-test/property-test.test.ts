import { describe, it, expect } from "vitest";
import { runPropertyTests } from "./Runner";
import { formatRunSummary, formatShortSummary } from "./Reporter";
import { replayIteration } from "./Replay";
import type {
  PropertyGroup,
  PropertyDefinition,
  PropertyContext,
  ReplayState,
  PropertyTestConfig,
} from "./types";
import { resolveConfig } from "./Config";

const alwaysPass: PropertyDefinition = {
  name: "always pass",
  fn: () => ({ pass: true }),
};

const alwaysFail: PropertyDefinition = {
  name: "always fail",
  fn: () => ({ pass: false, reason: "intentional failure" }),
};

function makeCounterGroup(): { group: PropertyGroup; callCount: () => number } {
  let count = 0;
  return {
    group: {
      name: "counter",
      properties: [
        {
          name: "increment",
          fn: () => {
            count++;
            return { pass: true };
          },
        },
      ],
    },
    callCount: () => count,
  };
}

function makeFailOnIteration(failAt: number): PropertyDefinition {
  return {
    name: `fail at ${failAt}`,
    fn: (ctx: PropertyContext) => {
      if (ctx.iteration === failAt) {
        return { pass: false, reason: `failed at iteration ${failAt}` };
      }
      return { pass: true };
    },
  };
}

const passThroughRng: PropertyDefinition = {
  name: "rng value",
  fn: (ctx: PropertyContext) => {
    const val = ctx.rng();
    if (typeof val === "number" && val >= 0 && val < 1) {
      return { pass: true };
    }
    return { pass: false, reason: `unexpected RNG value: ${val}` };
  },
};

function quickConfig(overrides?: Partial<PropertyTestConfig>): PropertyTestConfig {
  return resolveConfig({
    sizes: [4],
    iterationsPerSize: 5,
    seed: 42,
    timeoutMs: 1000,
    stopOnFirstFailure: false,
    ...overrides,
  });
}

describe("runPropertyTests", () => {
  it("passes when all properties pass", async () => {
    const groups: PropertyGroup[] = [
      {
        name: "pass group",
        properties: [alwaysPass],
      },
    ];

    const result = await runPropertyTests(quickConfig(), groups);
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.totalIterations).toBe(5);
  });

  it("detects a failing property", async () => {
    const groups: PropertyGroup[] = [
      {
        name: "fail group",
        properties: [alwaysPass, alwaysFail],
      },
    ];

    const result = await runPropertyTests(quickConfig(), groups);
    expect(result.passed).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures[0]!.propertyName).toBe("always fail");
    expect(result.failures[0]!.reason).toBe("intentional failure");
  });

  it("records replay state in failures", async () => {
    const groups: PropertyGroup[] = [
      {
        name: "replay group",
        properties: [makeFailOnIteration(2)],
      },
    ];

    const result = await runPropertyTests(quickConfig(), groups);
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);

    const f = result.failures[0]!;
    expect(f.groupName).toBe("replay group");
    expect(f.propertyName).toBe("fail at 2");
    expect(f.iteration).toBe(2);
    expect(f.size).toBe(4);
    expect(f.globalSeed).toBe(42);
    expect(f.reason).toBe("failed at iteration 2");
  });

  it("produces deterministic results with the same seed", async () => {
    const groups: PropertyGroup[] = [
      {
        name: "deterministic",
        properties: [passThroughRng],
      },
    ];

    const config = quickConfig();
    const result1 = await runPropertyTests(config, groups);
    const result2 = await runPropertyTests(config, groups);

    expect(result1.passed).toBe(result2.passed);
    expect(result1.totalIterations).toBe(result2.totalIterations);
    expect(result1.groups.length).toBe(result2.groups.length);
    for (let i = 0; i < result1.groups.length; i++) {
      const g1 = result1.groups[i]!;
      const g2 = result2.groups[i]!;
      expect(g1.groupName).toBe(g2.groupName);
      expect(g1.size).toBe(g2.size);
      expect(g1.passed).toBe(g2.passed);
    }
  });

  it("respects stopOnFirstFailure", async () => {
    const groups: PropertyGroup[] = [
      {
        name: "stop group",
        properties: [
          makeFailOnIteration(0),
          alwaysPass,
        ],
      },
    ];

    const config = quickConfig({ stopOnFirstFailure: true });
    const result = await runPropertyTests(config, groups);

    expect(result.passed).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);

    // second property should have 0 iterations run
    const groupResult = result.groups[0]!;
    const secondProp = groupResult.propertyResults[1]!;
    expect(secondProp.iterationsRun).toBe(0);
  });

  it("handles property timeout", async () => {
    const slowProperty: PropertyDefinition = {
      name: "slow property",
      fn: async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return { pass: true };
      },
    };

    const groups: PropertyGroup[] = [
      {
        name: "timeout group",
        properties: [slowProperty],
      },
    ];

    const result = await runPropertyTests(
      quickConfig({ timeoutMs: 10, iterationsPerSize: 3 }),
      groups,
    );

    expect(result.groups[0]!.propertyResults[0]!.timedOut).toBe(true);
    // timed-out iteration doesn't count as iterationsRun
    expect(result.groups[0]!.propertyResults[0]!.iterationsRun).toBe(0);
  });

  it("handles multiple groups", async () => {
    const groups: PropertyGroup[] = [
      { name: "group A", properties: [alwaysPass] },
      { name: "group B", properties: [alwaysPass] },
      { name: "group C", properties: [alwaysPass] },
    ];

    const result = await runPropertyTests(quickConfig(), groups);
    expect(result.passed).toBe(true);
    expect(result.groups).toHaveLength(3);
    for (const g of result.groups) {
      expect(g.passed).toBe(true);
    }
  });

  it("handles multiple sizes", async () => {
    const groups: PropertyGroup[] = [
      { name: "multi-size", properties: [alwaysPass] },
    ];

    const config = quickConfig({ sizes: [4, 9] });
    const result = await runPropertyTests(config, groups);
    expect(result.passed).toBe(true);
    expect(result.groups).toHaveLength(2);

    const sizes = result.groups.map((g) => g.size);
    expect(sizes).toContain(4);
    expect(sizes).toContain(9);
  });

  it("handles a property that throws synchronously", async () => {
    const throwProperty: PropertyDefinition = {
      name: "throws",
      fn: () => {
        throw new Error("kaboom");
      },
    };

    const groups: PropertyGroup[] = [
      { name: "throw group", properties: [throwProperty] },
    ];

    const result = await runPropertyTests(quickConfig(), groups);
    expect(result.passed).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures[0]!.reason).toContain("kaboom");
  });
});

describe("formatRunSummary", () => {
  it("returns a string", async () => {
    const groups: PropertyGroup[] = [
      { name: "format test", properties: [alwaysPass] },
    ];
    const result = await runPropertyTests(quickConfig(), groups);
    const output = formatRunSummary(result);
    expect(typeof output).toBe("string");
    expect(output).toContain("PASSED");
    expect(output).toContain("format test");
    expect(output).toContain("4×4");
  });

  it("includes failure details", async () => {
    const groups: PropertyGroup[] = [
      { name: "fail fmt", properties: [makeFailOnIteration(0)] },
    ];
    const result = await runPropertyTests(quickConfig(), groups);
    const output = formatRunSummary(result);
    expect(output).toContain("FAILED");
    expect(output).toContain("fail fmt");
    expect(output).toContain("failed at iteration 0");
  });
});

describe("formatShortSummary", () => {
  it("returns a short string for pass", async () => {
    const groups: PropertyGroup[] = [
      { name: "short test", properties: [alwaysPass] },
    ];
    const result = await runPropertyTests(quickConfig(), groups);
    const output = formatShortSummary(result);
    expect(output).toContain("PASSED");
  });

  it("returns a short string for failure", async () => {
    const groups: PropertyGroup[] = [
      { name: "short fail", properties: [makeFailOnIteration(0)] },
    ];
    const result = await runPropertyTests(quickConfig(), groups);
    const output = formatShortSummary(result);
    expect(output).toContain("FAILED");
  });
});

describe("replayIteration", () => {
  it("replays a failing iteration", async () => {
    const groups: PropertyGroup[] = [
      {
        name: "replay group",
        properties: [makeFailOnIteration(3)],
      },
    ];

    const state: ReplayState = {
      globalSeed: 42,
      groupName: "replay group",
      propertyName: "fail at 3",
      size: 4,
      iteration: 3,
    };

    const result = await replayIteration(groups, state);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.reason).toBe("failed at iteration 3");
    }
  });

  it("replays a passing iteration", async () => {
    const groups: PropertyGroup[] = [
      {
        name: "replay pass group",
        properties: [makeFailOnIteration(3)],
      },
    ];

    const state: ReplayState = {
      globalSeed: 42,
      groupName: "replay pass group",
      propertyName: "fail at 3",
      size: 4,
      iteration: 1,
    };

    const result = await replayIteration(groups, state);
    expect(result.pass).toBe(true);
  });

  it("returns failure for unknown group", async () => {
    const state: ReplayState = {
      globalSeed: 42,
      groupName: "unknown",
      propertyName: "prop",
      size: 4,
      iteration: 0,
    };

    const result = await replayIteration([], state);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.reason).toContain("unknown");
    }
  });

  it("returns failure for unknown property", async () => {
    const groups: PropertyGroup[] = [
      { name: "g", properties: [alwaysPass] },
    ];

    const state: ReplayState = {
      globalSeed: 42,
      groupName: "g",
      propertyName: "nonexistent",
      size: 4,
      iteration: 0,
    };

    const result = await replayIteration(groups, state);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.reason).toContain("nonexistent");
    }
  });

  it("produces the same result deterministically", async () => {
    const groups: PropertyGroup[] = [
      {
        name: "rng group",
        properties: [passThroughRng],
      },
    ];

    const state: ReplayState = {
      globalSeed: 42,
      groupName: "rng group",
      propertyName: "rng value",
      size: 4,
      iteration: 0,
    };

    const r1 = await replayIteration(groups, state);
    const r2 = await replayIteration(groups, state);
    expect(r1).toEqual(r2);
  });
});
