export interface ModeDef {
  name: string;
  label: string;
  config: {
    useGuidedRemoval: boolean;
    usePredictor: boolean;
    usePredictorAwareBudget: boolean;
  };
  enableLocalSearch: boolean;
}

export const MODES: ModeDef[] = [
  {
    name: "baseline",
    label: "Baseline",
    config: { useGuidedRemoval: false, usePredictor: false, usePredictorAwareBudget: false },
    enableLocalSearch: false,
  },
  {
    name: "guided",
    label: "Guided Removal",
    config: { useGuidedRemoval: true, usePredictor: false, usePredictorAwareBudget: false },
    enableLocalSearch: false,
  },
  {
    name: "predictor",
    label: "Predictor",
    config: { useGuidedRemoval: true, usePredictor: true, usePredictorAwareBudget: false },
    enableLocalSearch: false,
  },
  {
    name: "predictor-budget",
    label: "Predictor-aware Budget",
    config: { useGuidedRemoval: true, usePredictor: true, usePredictorAwareBudget: true },
    enableLocalSearch: false,
  },
  {
    name: "local-search",
    label: "Local Search",
    config: { useGuidedRemoval: true, usePredictor: true, usePredictorAwareBudget: true },
    enableLocalSearch: true,
  },
  {
    name: "guided+ls",
    label: "Guided + Local Search",
    config: { useGuidedRemoval: true, usePredictor: false, usePredictorAwareBudget: false },
    enableLocalSearch: true,
  },
  {
    name: "full",
    label: "All Optimizations",
    config: { useGuidedRemoval: true, usePredictor: true, usePredictorAwareBudget: true },
    enableLocalSearch: true,
  },
];
