/* eslint-disable max-classes-per-file -- the shape-detector emits two
   closely-related tagged errors (UnknownExportShape, AmbiguousPropertyType);
   co-locating them with their producer is per-domain ownership. */
/**
 * @spec.purpose
 *   Classifies each TypeScript export by structural shape via ts-morph
 *   (Schema.Struct → "Schema"; RpcDefinition → "RpcDefinition"; function exports
 *   by return type; types/interfaces; branded primitives). The applicability
 *   module consumes this shape to derive required-kind sets.
 *
 *   Tagged errors `UnknownExportShapeError` and `AmbiguousPropertyTypeError` are
 *   co-located here — the shape-detector emits them on shape-classification
 *   failures.
 *
 * @spec.guarantee Fail-closed on ambiguous types: emits
 *   `UnknownExportShapeError` or `AmbiguousPropertyTypeError` rather than guessing.
 *   reason: silent misclassification drift the validate-gate cannot catch.
 */

import { Data, Effect } from "effect";
import type { ExportShape, PropertyType } from "@safer/property-types/index.js";

export class UnknownExportShapeError extends Data.TaggedError(
  "UnknownExportShapeError",
)<{
  readonly path: string;
  readonly exportName: string;
  readonly reason: string;
}> {}

export class AmbiguousPropertyTypeError extends Data.TaggedError("AmbiguousPropertyTypeError")<{
  readonly path: string;
  readonly exportName: string;
  readonly candidates: ReadonlyArray<PropertyType>;
}> {}

export interface DetectedExport {
  readonly name: string;
  readonly shape: ExportShape;
  readonly sourceRef: {
    readonly path: string;
    readonly line: number;
    readonly sha: string;
  };
  readonly observedPropertyTypes: ReadonlyArray<PropertyType>;
}

type DetectError = UnknownExportShapeError | AmbiguousPropertyTypeError;

/**
 * @spec.guarantee "every detected export carries a non-null `shape`; the catchall is `\"unknown\"` and triggers `UnknownExportShapeError` upstream"
 *   reason: trust-boundary; silent misclassification is the bug class
 *           this domain is built to prevent.
 * @spec.residual-contract "ts-morph version compatibility; the function returns over the project the ts-morph instance was created with"
 *   reason: lifecycle contract beyond the Effect signature.
 */
export const detectExports = (
  _filePath: string,
): Effect.Effect<ReadonlyArray<DetectedExport>, DetectError> =>
  Effect.die(new Error("Not implemented: detectExports"));
