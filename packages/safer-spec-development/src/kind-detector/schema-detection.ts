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

import type { Effect } from "effect";
import { Effect as Eff } from "effect";
import type { UnknownExportShapeError } from "../errors/index.js";

export interface SchemaShape {
  readonly kind: "Schema";
  readonly inner: "Struct" | "Union" | "Literal" | "Brand" | "Refinement" | "Unknown";
  readonly refinements: ReadonlyArray<string>;
}

export interface NotSchemaShape {
  readonly kind: "not-schema";
}

export type SchemaDetection = SchemaShape | NotSchemaShape;

export const detectSchemaShape = (
  _filePath: string,
  _exportName: string,
): Effect.Effect<SchemaDetection, UnknownExportShapeError> =>
  Eff.die(new Error("Stage 1 stub: detectSchemaShape not implemented"));
