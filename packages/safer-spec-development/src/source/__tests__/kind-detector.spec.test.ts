/**
 * @spec.purpose Property stubs for the kind detector and its fail-closed
 *   resolver. Type-resolution outputs match the applicability matrix's
 *   ExportShape closed enum. Ambiguous types fail-closed (never silent).
 */

import { itSpec } from "@safer/authoring/index.js";
import { detectExports } from "@safer/source/kind-detector.js";
import {
  isAmbiguousType,
  raiseAmbiguousKind,
  raiseUnknownExportShape,
} from "@safer/source/failclosed.js";

/**
 * @spec.property kind-detector-shape-from-closed-enum
 * @spec.kind Inclusion
 * @spec.exports detectExports
 * @spec.claim every detected shape value is in the closed ExportShape enum
 */
itSpec.todo("kind-detector-shape-from-closed-enum", {
  kind: "Inclusion",
  exports: [detectExports],
});

/**
 * @spec.property kind-detector-failclosed-on-ambiguous
 * @spec.kind Exception Raising
 * @spec.exports detectExports, isAmbiguousType, raiseAmbiguousKind
 * @spec.claim ambiguous type-resolution fails with AmbiguousKindError; never returns a guess
 */
itSpec.todo("kind-detector-failclosed-on-ambiguous", {
  kind: "Exception Raising",
  exports: [detectExports, isAmbiguousType, raiseAmbiguousKind],
});

/**
 * @spec.property kind-detector-failclosed-on-unknown
 * @spec.kind Exception Raising
 * @spec.exports raiseUnknownExportShape
 * @spec.claim unknown export shapes fail with UnknownExportShapeError; require @spec.skip with reason
 */
itSpec.todo("kind-detector-failclosed-on-unknown", {
  kind: "Exception Raising",
  exports: [raiseUnknownExportShape],
});

/**
 * @spec.property kind-detector-detects-effect-schema
 * @spec.kind Typechecking
 * @spec.exports detectExports
 * @spec.claim Schema.Struct exports classify as ExportShape "Schema"; refinement chains are walked
 */
itSpec.todo("kind-detector-detects-effect-schema", {
  kind: "Typechecking",
  exports: [detectExports],
});
