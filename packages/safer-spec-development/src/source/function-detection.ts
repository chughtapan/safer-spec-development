/**
 * @spec.purpose Detect function exports and classify by return-type shape:
 *   `Effect<T, E, R>`, `Either<E, T>`, `Result<T, E>`, plain pure function, or
 *   `RpcDefinition<P, R>`. Each shape maps to a row in the applicability
 *   matrix.
 */

import { Effect } from "effect";
import type { UnknownExportShapeError } from "#source/kind-detector.js";

type FunctionReturnShape =
  | "Effect"
  | "Either"
  | "Result"
  | "RpcDefinition"
  | "pure"
  | "void"
  | "unknown";

interface FunctionShape {
  readonly kind: "function";
  readonly returnShape: FunctionReturnShape;
  readonly returnIsCollection: boolean;
}

interface NotFunctionShape {
  readonly kind: "not-function";
}

type FunctionDetection = FunctionShape | NotFunctionShape;

/**
 * @spec.guarantee "non-function exports return NotFunctionShape; never crashes on non-function input"
 *   reason: trust contract; called speculatively from kind-detector.
 * @spec.residual-contract "Promise<T> return types are NOT classified — the codebase forbids Promise per Principle 1; encountering one is a kind-detector error not a function shape"
 *   reason: encodes the codemod's own type-system-first stance.
 */
export const detectFunctionShape = (
  _filePath: string,
  _exportName: string,
): Effect.Effect<FunctionDetection, UnknownExportShapeError> =>
  Effect.die(new Error("Stage 1 stub: detectFunctionShape not implemented"));
