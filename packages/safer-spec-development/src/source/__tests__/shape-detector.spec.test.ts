/**
 * @spec.purpose Property stubs for the kind detector and its fail-closed
 *   resolver. Type-resolution outputs match the applicability matrix's
 *   ExportShape closed enum. Ambiguous types fail-closed (never silent).
 */

import { itSpec } from "@safer/authoring/index.js";
import { detectExports } from "@safer/source/shape-detector.js";
import {
  isAmbiguousType,
  raiseAmbiguousPropertyType,
  raiseUnknownExportShape,
} from "@safer/source/failclosed.js";

/**
 * @spec.property shape-detector-shape-from-closed-enum
 * @spec.type Inclusion
 * @spec.exports detectExports
 * @spec.claim every detected shape value is in the closed ExportShape enum
 */
itSpec.todo("shape-detector-shape-from-closed-enum", {
  type: "Inclusion",
  exports: [detectExports],
});

/**
 * @spec.property shape-detector-failclosed-on-ambiguous
 * @spec.type Exception Raising
 * @spec.exports detectExports, isAmbiguousType, raiseAmbiguousPropertyType
 * @spec.claim ambiguous type-resolution fails with AmbiguousPropertyTypeError; never returns a guess
 */
itSpec.todo("shape-detector-failclosed-on-ambiguous", {
  type: "Exception Raising",
  exports: [detectExports, isAmbiguousType, raiseAmbiguousPropertyType],
});

/**
 * @spec.property shape-detector-failclosed-on-unknown
 * @spec.type Exception Raising
 * @spec.exports raiseUnknownExportShape
 * @spec.claim unknown export shapes fail with UnknownExportShapeError; require @spec.skip with reason
 */
itSpec.todo("shape-detector-failclosed-on-unknown", {
  type: "Exception Raising",
  exports: [raiseUnknownExportShape],
});

/**
 * @spec.property shape-detector-detects-effect-schema
 * @spec.type Typechecking
 * @spec.exports detectExports
 * @spec.claim Schema.Struct exports classify as ExportShape "Schema"; refinement chains are walked
 */
itSpec.todo("shape-detector-detects-effect-schema", {
  type: "Typechecking",
  exports: [detectExports],
});
