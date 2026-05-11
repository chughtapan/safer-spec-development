/**
 * @spec.purpose Fail-closed resolver for ambiguous ts-morph type resolutions.
 *   When type resolution cannot determine kind unambiguously (generics,
 *   conditional types, recursive schemas, casted expressions), emit
 *   `UnknownExportShapeError` and require an explicit skip or ignore reason.
 *   No silent misclassification.
 *
 * @spec.guarantee The resolver never returns a candidate set without raising
 *   `AmbiguousPropertyTypeError` when multiple kinds are plausible for the same export.
 *   reason: silent misclassification produces drift the validate-gate cannot
 *           catch.
 */

import { Effect } from "effect";
import type { PropertyType } from "@safer/property-types/index.js";
import {
  AmbiguousPropertyTypeError,
  UnknownExportShapeError,
} from "@safer/source/shape-detector.js";

interface AmbiguityReport {
  readonly path: string;
  readonly exportName: string;
  readonly candidates: ReadonlyArray<PropertyType>;
  readonly reason: string;
}

/**
 * @spec.guarantee "returns true iff the type-text matches one of the documented ambiguous patterns (generics, conditional types, recursive schemas, casted expressions)"
 *   reason: trust contract; predicate is the gatekeeper for the
 *           fail-closed branch.
 * @spec.residual-contract none
 *   reason: pure predicate; behavior captured by signature.
 */
export const isAmbiguousType = (
  _typeText: string,
): Effect.Effect<boolean, never> =>
  Effect.die(new Error("Not implemented: isAmbiguousType"));

/**
 * @spec.guarantee "always fails on the error channel; never returns a value"
 *   reason: the function's purpose IS to raise; the never return type
 *           encodes it.
 * @spec.residual-contract none
 *   reason: shape captured by signature.
 */
export const raiseUnknownExportShape = (
  _path: string,
  _exportName: string,
  _reason: string,
): Effect.Effect<never, UnknownExportShapeError> =>
  Effect.die(new Error("Not implemented: raiseUnknownExportShape"));

/**
 * @spec.guarantee "always fails on the error channel; never returns a value"
 *   reason: same as raiseUnknownExportShape.
 * @spec.residual-contract none
 *   reason: shape captured by signature.
 */
export const raiseAmbiguousPropertyType = (
  _report: AmbiguityReport,
): Effect.Effect<never, AmbiguousPropertyTypeError> =>
  Effect.die(new Error("Not implemented: raiseAmbiguousPropertyType"));
