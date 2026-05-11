/**
 * @spec.purpose Static required-kind applicability matrix from the design doc.
 *   Each export shape maps to the set of kinds that MUST appear on the export's
 *   `*.spec.test.ts` coverage (unless explicitly `@spec.skip`-ed with reason).
 */

import type { ExportShape } from "../../detection/kind-detector/index.js";
import type { Kind } from "../../kernel/index.js";

export interface ApplicabilityRow {
  readonly shape: ExportShape;
  readonly requiredKinds: ReadonlyArray<Kind>;
  readonly conditionalKinds: ReadonlyArray<{
    readonly kind: Kind;
    readonly when: "result-is-collection";
  }>;
}

export const APPLICABILITY_MATRIX: ReadonlyArray<ApplicabilityRow> = [
  {
    shape: "Schema",
    requiredKinds: ["Roundtrip", "Exception Raising", "Typechecking"],
    conditionalKinds: [],
  },
  {
    shape: "RpcDefinition",
    requiredKinds: ["Roundtrip", "Exception Raising"],
    conditionalKinds: [{ kind: "Inclusion", when: "result-is-collection" }],
  },
  {
    shape: "function",
    requiredKinds: [],
    conditionalKinds: [],
  },
  {
    shape: "type",
    requiredKinds: ["Typechecking"],
    conditionalKinds: [],
  },
  {
    shape: "Branded",
    requiredKinds: [],
    conditionalKinds: [],
  },
  {
    shape: "unknown",
    requiredKinds: [],
    conditionalKinds: [],
  },
];
