import type {
  PropertyGroup,
  PropertyContext,
  PropertyFailure,
  PropertyResult,
  PropertyTestConfig,
  RunSummary,
  GroupRunResult,
  SinglePropertyResult,
  GridSize,
  RngFn,
} from "./types";
import { forkRng } from "./SeedManager";

// timeoutMs only detects asynchronous hangs (e.g. network, promises).
// Synchronous infinite loops cannot be pre-empted on the Node.js event loop.
async function runWithTimeout(
  fn: () => PropertyResult | Promise<PropertyResult>,
  timeoutMs: number,
): Promise<{ ok: true; result: PropertyResult } | { ok: false; reason: "timeout" | "error"; error?: string }> {
  const exec = async (): Promise<{ ok: true; result: PropertyResult } | { ok: false; reason: "error"; error: string }> => {
    try {
      return { ok: true, result: await fn() };
    } catch (err) {
      return { ok: false, reason: "error" as const, error: err instanceof Error ? (err.stack ?? err.message) : String(err) };
    }
  };

  if (timeoutMs <= 0) {
    return await exec();
  }

  return await Promise.race([
    exec(),
    new Promise<{ ok: false; reason: "timeout" }>((resolve) =>
      setTimeout(() => resolve({ ok: false, reason: "timeout" }), timeoutMs),
    ),
  ]);
}

function buildContext(
  config: PropertyTestConfig,
  groupName: string,
  propertyName: string,
  size: GridSize,
  iteration: number,
): { ctx: PropertyContext; rng: RngFn } {
  const rng = forkRng(config.seed, groupName, size, iteration);
  return {
    ctx: {
      size,
      rng,
      iteration,
      globalSeed: config.seed,
      groupName,
      propertyName,
    },
    rng,
  };
}

async function runProperty(
  prop: PropertyGroup["properties"][number],
  config: PropertyTestConfig,
  groupName: string,
  size: GridSize,
): Promise<SinglePropertyResult> {
  const failures: PropertyFailure[] = [];
  let timedOut = false;
  let iterationsRun = 0;

  for (let iteration = 0; iteration < config.iterationsPerSize; iteration++) {
    if (config.stopOnFirstFailure && failures.length > 0) break;

    const { ctx } = buildContext(config, groupName, prop.name, size, iteration);

    const race = await runWithTimeout(() => prop.fn(ctx), config.timeoutMs);

    if (!race.ok) {
      if (race.reason === "error") {
        const failure: PropertyFailure = {
          groupName,
          propertyName: prop.name,
          size,
          iteration,
          globalSeed: config.seed,
          reason: race.error ?? "unknown error",
        };
        failures.push(failure);
      } else {
        timedOut = true;
        const failure: PropertyFailure = {
          groupName,
          propertyName: prop.name,
          size,
          iteration,
          globalSeed: config.seed,
          reason: `Timeout exceeded (${config.timeoutMs} ms)`,
        };
        failures.push(failure);
      }
      continue;
    }

    iterationsRun++;
    const result = race.result;

    if (!result.pass) {
      const failure: PropertyFailure = {
        groupName,
        propertyName: prop.name,
        size,
        iteration,
        globalSeed: config.seed,
        reason: result.reason,
      };
      failures.push(failure);
    }
  }

  return {
    propertyName: prop.name,
    passed: failures.length === 0,
    iterationsRun,
    totalIterations: config.iterationsPerSize,
    failures,
    timedOut,
  };
}

export async function runPropertyTests(
  config: PropertyTestConfig,
  groups: PropertyGroup[],
): Promise<RunSummary> {
  const startTime = Date.now();
  const allFailures: PropertyFailure[] = [];
  const groupResults: GroupRunResult[] = [];
  let totalIterations = 0;

  for (const size of config.sizes) {
    if (config.stopOnFirstFailure && allFailures.length > 0) break;

    for (const group of groups) {
      if (config.stopOnFirstFailure && allFailures.length > 0) break;

      const propertyResults: SinglePropertyResult[] = [];

      for (const prop of group.properties) {
        if (config.stopOnFirstFailure && allFailures.length > 0) {
          propertyResults.push({
            propertyName: prop.name,
            passed: true,
            iterationsRun: 0,
            totalIterations: config.iterationsPerSize,
            failures: [],
            timedOut: false,
          });
          continue;
        }

        const result = await runProperty(prop, config, group.name, size);
        propertyResults.push(result);
        totalIterations += result.iterationsRun;

        for (const failure of result.failures) {
          allFailures.push(failure);
        }
      }

      groupResults.push({
        groupName: group.name,
        size,
        passed: propertyResults.every((pr) => pr.passed),
        propertyResults,
      });
    }
  }

  return {
    passed: allFailures.length === 0,
    groups: groupResults,
    failures: allFailures,
    totalIterations,
    totalTimeMs: Date.now() - startTime,
    config,
  };
}
