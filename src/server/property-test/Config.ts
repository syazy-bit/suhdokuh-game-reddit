import type { PropertyTestConfig } from "./types";

export const DEFAULT_CONFIG: PropertyTestConfig = {
  sizes: [4, 9],
  iterationsPerSize: 100,
  seed: 42,
  stopOnFirstFailure: true,
  timeoutMs: 30_000,
};

export function resolveConfig(overrides?: Partial<PropertyTestConfig>): PropertyTestConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}
