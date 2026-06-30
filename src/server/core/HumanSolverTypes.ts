export const TECHNIQUES = [
  "Naked Single",
  "Hidden Single",
  "Naked Pair",
  "Hidden Pair",
  "Pointing Pair",
  "Claiming Pair",
  "X-Wing",
  "XY-Wing",
  "Swordfish",
] as const;

export type Technique = typeof TECHNIQUES[number];

export const TECHNIQUE_PRIORITY: readonly Technique[] = TECHNIQUES;
