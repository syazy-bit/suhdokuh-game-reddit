export type GridSize = 4 | 9;

export type RngFn = () => number;

export interface PropertyDefinition {
  name: string;
  fn: (context: PropertyContext) => PropertyResult;
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
  size: GridSize;
  iteration: number;
}

export interface PropertyGroup {
  name: string;
  properties: PropertyDefinition[];
}
