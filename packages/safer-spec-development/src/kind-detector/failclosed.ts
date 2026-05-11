/**
 * @spec.purpose Fail-closed resolver for ambiguous ts-morph type resolutions.
 *   Implements the design doc's Recommended Approach §5: when type-resolution
 *   cannot determine kind unambiguously (generics, conditional types, recursive
 *   schemas, casted expressions), emit `UnknownExportShapeError` and require
 *   `@spec.skip` with reason. No silent misclassification.
 *
 * @spec.guarantee The resolver never returns a candidate set without raising
 *   `AmbiguousKindError` when multiple kinds are plausible for the same export.
 *   reason: silent misclassification produces drift the validate-gate cannot
 *           catch.
 */

import type { Effect } from "effect";
import { Effect as Eff } from "effect";
import type {
  AmbiguousKindError,
  UnknownExportShapeError,
} from "../errors/index.js";
import type { Kind } from "../kinds.js";

export interface AmbiguityReport {
  readonly path: string;
  readonly exportName: string;
  readonly candidates: ReadonlyArray<Kind>;
  readonly reason: string;
}

export const isAmbiguousType = (
  _typeText: string,
): Effect.Effect<boolean, never> =>
  Eff.die(new Error("Stage 1 stub: isAmbiguousType not implemented"));

export const raiseUnknownExportShape = (
  _path: string,
  _exportName: string,
  _reason: string,
): Effect.Effect<never, UnknownExportShapeError> =>
  Eff.die(new Error("Stage 1 stub: raiseUnknownExportShape not implemented"));

export const raiseAmbiguousKind = (
  _report: AmbiguityReport,
): Effect.Effect<never, AmbiguousKindError> =>
  Eff.die(new Error("Stage 1 stub: raiseAmbiguousKind not implemented"));
