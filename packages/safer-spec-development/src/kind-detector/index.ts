/**
 * @spec.purpose
 *   Classifies each TypeScript export by structural shape via ts-morph
 *   (Schema.Struct → "Schema"; RpcDefinition → "RpcDefinition"; function exports
 *   by return type; types/interfaces; branded primitives). The applicability
 *   module consumes this shape to derive required-kind sets.
 *
 * @spec.guarantee Fail-closed on ambiguous types: emits
 *   `UnknownExportShapeError` or `AmbiguousKindError` rather than guessing.
 *   reason: silent misclassification drift the validate-gate cannot catch.
 */

import type { Effect } from "effect";
import { Effect as Eff } from "effect";
import type {
  AmbiguousKindError,
  UnknownExportShapeError,
} from "../errors/index.js";
import type { Kind } from "../kinds.js";

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

export type DetectError = UnknownExportShapeError | AmbiguousKindError;

export const detectExports = (
  _filePath: string,
): Effect.Effect<ReadonlyArray<DetectedExport>, DetectError> =>
  Eff.die(new Error("Stage 1 stub: detectExports not implemented"));

export const detectFolderExports = (
  _folder: string,
): Effect.Effect<ReadonlyArray<DetectedExport>, DetectError> =>
  Eff.die(new Error("Stage 1 stub: detectFolderExports not implemented"));

export { detectSchemaShape } from "./schema-detection.js";
export type { SchemaDetection, SchemaShape } from "./schema-detection.js";
export { detectFunctionShape } from "./function-detection.js";
export type {
  FunctionDetection,
  FunctionReturnShape,
  FunctionShape,
} from "./function-detection.js";
export {
  isAmbiguousType,
  raiseAmbiguousKind,
  raiseUnknownExportShape,
} from "./failclosed.js";
export type { AmbiguityReport } from "./failclosed.js";
