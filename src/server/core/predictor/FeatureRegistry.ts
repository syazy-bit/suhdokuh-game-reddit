import type { Stage1FilterDefinition, Stage2FeatureDefinition } from "./types";
import { isolationFilter } from "./features/Stage1IsolationFilter";
import { boxDepletionFilter } from "./features/Stage1BoxDepletionFilter";
import { bivalueCreatedFeature } from "./features/Stage2BivalueCreated";
import { nakedSingleCreatedFeature } from "./features/Stage2NakedSingleCreated";
import { strongLinkCreatedFeature } from "./features/Stage2StrongLinkCreated";
import { localCandidateSurgeFeature } from "./features/Stage2LocalCandidateSurge";
import { sectorConflictFeature } from "./features/Stage2SectorConflict";

const stage1Filters: Stage1FilterDefinition[] = [];
const stage2Features: Stage2FeatureDefinition[] = [];

export function registerStage1Filter(filter: Stage1FilterDefinition): void {
  stage1Filters.push(filter);
}

export function registerStage2Feature(feature: Stage2FeatureDefinition): void {
  stage2Features.push(feature);
}

export function getStage1Filters(): readonly Stage1FilterDefinition[] {
  return stage1Filters;
}

export function getStage2Features(): readonly Stage2FeatureDefinition[] {
  return stage2Features;
}

export function clearRegistry(): void {
  stage1Filters.length = 0;
  stage2Features.length = 0;
}

export function registerDefaultFeatures(): void {
  clearRegistry();
  registerStage1Filter(isolationFilter);
  registerStage1Filter(boxDepletionFilter);
  registerStage2Feature(bivalueCreatedFeature);
  registerStage2Feature(nakedSingleCreatedFeature);
  registerStage2Feature(strongLinkCreatedFeature);
  registerStage2Feature(localCandidateSurgeFeature);
  registerStage2Feature(sectorConflictFeature);
}
