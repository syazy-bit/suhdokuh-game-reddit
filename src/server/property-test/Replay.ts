import type { PropertyGroup, PropertyContext, PropertyResult, ReplayState } from "./types";
import { forkRng } from "./SeedManager";

export async function replayIteration(
  groups: PropertyGroup[],
  state: ReplayState,
): Promise<PropertyResult> {
  const group = groups.find((g) => g.name === state.groupName);
  if (!group) {
    return { pass: false, reason: `Group "${state.groupName}" not found` };
  }

  const prop = group.properties.find((p) => p.name === state.propertyName);
  if (!prop) {
    return { pass: false, reason: `Property "${state.propertyName}" not found` };
  }

  const rng = forkRng(state.globalSeed, state.groupName, state.size, state.iteration);
  const context: PropertyContext = {
    size: state.size,
    rng,
    iteration: state.iteration,
    globalSeed: state.globalSeed,
    groupName: state.groupName,
    propertyName: state.propertyName,
  };

  return await prop.fn(context);
}
