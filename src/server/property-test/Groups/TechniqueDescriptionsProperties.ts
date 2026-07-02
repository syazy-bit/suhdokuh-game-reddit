import type { PropertyGroup, PropertyContext, PropertyResult } from "../types";
import { TECHNIQUES } from "../../core/HumanSolverTypes";
import {
  TECHNIQUE_DESCRIPTIONS,
  getTechniqueDescription,
} from "../../core/TechniqueDescriptions";

const properties = [
  {
    name: "CompleteCoverage",
    fn: (_ctx: PropertyContext): PropertyResult => {
      for (const technique of TECHNIQUES) {
        if (!(technique in TECHNIQUE_DESCRIPTIONS)) {
          return {
            pass: false,
            reason: `technique "${technique}" missing from TECHNIQUE_DESCRIPTIONS`,
          };
        }
        const desc = getTechniqueDescription(technique);
        if (desc === undefined || desc === null) {
          return {
            pass: false,
            reason: `getTechniqueDescription("${technique}") returned ${desc}`,
          };
        }
      }
      return { pass: true };
    },
  },
  {
    name: "NonEmptyFields",
    fn: (_ctx: PropertyContext): PropertyResult => {
      for (const technique of TECHNIQUES) {
        const desc = getTechniqueDescription(technique);
        if (desc.title.trim().length === 0) {
          return {
            pass: false,
            reason: `technique "${technique}": title is empty or whitespace`,
          };
        }
        if (desc.summary.trim().length === 0) {
          return {
            pass: false,
            reason: `technique "${technique}": summary is empty or whitespace`,
          };
        }
        if (desc.explanation.trim().length === 0) {
          return {
            pass: false,
            reason: `technique "${technique}": explanation is empty or whitespace`,
          };
        }
      }
      return { pass: true };
    },
  },
  {
    name: "LookupRoundTrip",
    fn: (_ctx: PropertyContext): PropertyResult => {
      for (const technique of TECHNIQUES) {
        const direct = TECHNIQUE_DESCRIPTIONS[technique];
        const lookup = getTechniqueDescription(technique);
        if (lookup.title !== direct.title) {
          return {
            pass: false,
            reason: `technique "${technique}": title mismatch — direct="${direct.title}", lookup="${lookup.title}"`,
          };
        }
        if (lookup.summary !== direct.summary) {
          return {
            pass: false,
            reason: `technique "${technique}": summary mismatch — direct="${direct.summary}", lookup="${lookup.summary}"`,
          };
        }
        if (lookup.explanation !== direct.explanation) {
          return {
            pass: false,
            reason: `technique "${technique}": explanation mismatch — direct="${direct.explanation}", lookup="${lookup.explanation}"`,
          };
        }
      }
      return { pass: true };
    },
  },
];

export const techniqueDescriptionsGroup: PropertyGroup = {
  name: "TechniqueDescriptions",
  properties,
};
