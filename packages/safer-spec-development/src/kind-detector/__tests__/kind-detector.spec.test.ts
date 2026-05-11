/**
 * @spec.purpose Property stubs for the kind detector and its fail-closed
 *   resolver. Type-resolution outputs match the applicability matrix's
 *   per-shape kind set; ambiguous types fail closed with
 *   `UnknownExportShapeError` rather than silent misclassification.
 */

import { itSpec } from "../../helper.js";
import {
  detectExports,
  detectFunctionShape,
  detectSchemaShape,
  isAmbiguousType,
  raiseAmbiguousKind,
  raiseUnknownExportShape,
} from "../index.js";

itSpec.todo("kind-detector-resolves-shape", {
  kind: "Typechecking",
  exports: [detectExports],
});

itSpec.todo("kind-detector-schema-detection", {
  kind: "Typechecking",
  exports: [detectSchemaShape],
});

itSpec.todo("kind-detector-function-detection", {
  kind: "Typechecking",
  exports: [detectFunctionShape],
});

itSpec.todo("kind-detector-fails-closed-on-ambiguous", {
  kind: "Exception Raising",
  exports: [detectExports, isAmbiguousType, raiseAmbiguousKind, raiseUnknownExportShape],
});
