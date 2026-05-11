/**
 * @spec.purpose Detect function exports and classify by return-type shape:
 *   `Effect<T, E, R>`, `Either<E, T>`, `Result<T, E>`, plain pure function, or
 *   `RpcDefinition<P, R>`. Each shape maps to a row in the applicability
 *   matrix.
 */

import type { Effect } from "effect";
import { Effect as Eff } from "effect";
import type { UnknownExportShapeError } from "../errors/index.js";

export type FunctionReturnShape =
  | "Effect"
  | "Either"
  | "Result"
  | "RpcDefinition"
  | "pure"
  | "void"
  | "unknown";

export interface FunctionShape {
  readonly kind: "function";
  readonly returnShape: FunctionReturnShape;
  readonly returnIsCollection: boolean;
}

export interface NotFunctionShape {
  readonly kind: "not-function";
}

export type FunctionDetection = FunctionShape | NotFunctionShape;

export const detectFunctionShape = (
  _filePath: string,
  _exportName: string,
): Effect.Effect<FunctionDetection, UnknownExportShapeError> =>
  Eff.die(new Error("Stage 1 stub: detectFunctionShape not implemented"));
