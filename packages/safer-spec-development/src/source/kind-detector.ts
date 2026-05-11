/* eslint-disable max-classes-per-file -- the kind-detector emits two
   closely-related tagged errors (UnknownExportShape, AmbiguousKind);
   co-locating them with their producer is per-domain ownership. */
/**
 * @spec.purpose
 *   Classifies each TypeScript export by structural shape via ts-morph
 *   (Schema.Struct → "Schema"; RpcDefinition → "RpcDefinition"; function exports
 *   by return type; types/interfaces; branded primitives). The applicability
 *   module consumes this shape to derive required-kind sets.
 *
 *   Tagged errors `UnknownExportShapeError` and `AmbiguousKindError` are
 *   co-located here — the kind-detector emits them on shape-classification
 *   failures.
 *
 * @spec.guarantee Fail-closed on ambiguous types: emits
 *   `UnknownExportShapeError` or `AmbiguousKindError` rather than guessing.
 *   reason: silent misclassification drift the validate-gate cannot catch.
 */

import { Data, Effect } from "effect";
import type { Kind } from "@safer/kinds/index.js";

export class UnknownExportShapeError extends Data.TaggedError(
  "UnknownExportShapeError",
)<{
  readonly path: string;
  readonly exportName: string;
  readonly reason: string;
}> {}

export class AmbiguousKindError extends Data.TaggedError("AmbiguousKindError")<{
  readonly path: string;
  readonly exportName: string;
  readonly candidates: ReadonlyArray<Kind>;
}> {}

export type ExportShape =
  | "Schema"
  | "RpcDefinition"
  | "function"
  | "type"
  | "Branded"
  | "unknown";

export interface DetectedExport {
  readonly name: string;
  readonly shape: ExportShape;
  readonly sourceRef: {
    readonly path: string;
    readonly line: number;
    readonly sha: string;
  };
  readonly observedKinds: ReadonlyArray<Kind>;
}

type DetectError = UnknownExportShapeError | AmbiguousKindError;

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
