/**
 * @spec.purpose Detect Effect Schema exports (`Schema.Struct`, `Schema.Union`,
 *   `Schema.Literal`, refinement chains) via ts-morph type-resolution. Returns
 *   the export's structural shape so the applicability matrix can derive its
 *   required-kind set.
 *
 * @spec.residual-contract Schema refinements (`Schema.minLength`,
 *   `Schema.maxLength`, branded primitives) are walked and reported as
 *   refinement bullets in the emitted SPEC.md.
 *   reason: refinements are Schema-encodable; this is the type-system-first
 *           projection that keeps `@spec.assume` quiet on what types already
 *           say.
 */

import { Effect } from "effect";
import type { UnknownExportShapeError } from "@safer/source/kind-detector.js";

interface SchemaShape {
  readonly kind: "Schema";
  readonly inner: "Struct" | "Union" | "Literal" | "Brand" | "Refinement" | "Unknown";
  readonly refinements: ReadonlyArray<string>;
}

interface NotSchemaShape {
  readonly kind: "not-schema";
}

type SchemaDetection = SchemaShape | NotSchemaShape;

/**
 * @spec.guarantee "returns NotSchemaShape with `kind: 'not-schema'` when the export is not a Schema; never crashes on non-Schema input"
 *   reason: trust contract; called speculatively from kind-detector for
 *           every export.
 * @spec.residual-contract "ts-morph compatibility; refinement chain traversal terminates at the first non-Schema marker"
 *   reason: behavioral residue beyond the Effect signature.
 */
export const detectSchemaShape = (
  _filePath: string,
  _exportName: string,
): Effect.Effect<SchemaDetection, UnknownExportShapeError> =>
  Effect.die(new Error("Stage 1 stub: detectSchemaShape not implemented"));
