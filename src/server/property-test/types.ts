export type GridSize = 4 | 9;

export type RngFn = () => number;

export interface PropertyDefinition {
  name: string;
  fn: (context: PropertyContext) => PropertyResult | Promise<PropertyResult>;
}

export interface PropertyContext {
  size: GridSize;
  rng: RngFn;
  iteration: number;
  globalSeed: number;
  groupName: string;
  propertyName: string;
}

export type PropertyResult =
  | { pass: true }
  | { pass: false; reason: string };

export interface PropertyFailure {
  groupName: string;
  propertyName: string;
  size: GridSize;
  iteration: number;
  globalSeed: number;
  reason: string;
}

export interface ReplayState {
  globalSeed: number;
  groupName: string;
  propertyName: string;
  size: GridSize;
  iteration: number;
}

export interface SinglePropertyResult {
  propertyName: string;
  passed: boolean;
  iterationsRun: number;
  totalIterations: number;
  failures: PropertyFailure[];
  timedOut: boolean;
}

export interface GroupRunResult {
  groupName: string;
  size: GridSize;
  passed: boolean;
  propertyResults: SinglePropertyResult[];
}

export interface RunSummary {
  passed: boolean;
  groups: GroupRunResult[];
  failures: PropertyFailure[];
  totalIterations: number;
  totalTimeMs: number;
  config: PropertyTestConfig;
}

export interface PropertyTestConfig {
  sizes: GridSize[];
  iterationsPerSize: number;
  seed: number;
  stopOnFirstFailure: boolean;
  timeoutMs: number;
}

export interface PropertyGroup {
  name: string;
  properties: PropertyDefinition[];
}
