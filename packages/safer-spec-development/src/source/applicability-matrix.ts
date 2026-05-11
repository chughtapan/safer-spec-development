/**
 * @spec.purpose Static required-kind applicability matrix from the design doc.
 *   Each export shape maps to the set of kinds that MUST appear on the export's
 *   `*.spec.test.ts` coverage (unless explicitly `@spec.skip`-ed with reason).
 */

import type { ExportShape } from "@safer/source/kind-detector.js";
import type { Kind } from "@safer/kinds/index.js";

interface ApplicabilityRow {
  readonly shape: ExportShape;
  readonly requiredKinds: ReadonlyArray<Kind>;
  readonly conditionalKinds: ReadonlyArray<{
    readonly kind: Kind;
    readonly when: "result-is-collection";
  }>;
}

/**
 * @spec.guarantee "matrix membership is closed; every ExportShape has exactly one row"
 *   reason: contract; missing rows would silently skip kind-coverage
 *           checks for that shape.
 * @spec.residual-contract "conditional kinds fire only when the named condition (`result-is-collection`) holds; runtime decision is the validate gate's"
 *   reason: behavioral residue not captured in the static row data.
 */
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
