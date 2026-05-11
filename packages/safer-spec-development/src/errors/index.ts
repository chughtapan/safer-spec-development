/* eslint-disable max-classes-per-file -- tagged-error registry: every named
   failure mode in the codemod maps to one Data.TaggedError subclass; co-locating
   them is the single-source-of-truth pattern the design doc prescribes. */
/**
 * @spec.purpose
 *   Tagged error registry for the codemod. Every named failure mode in the
 *   design doc maps to one Data.TaggedError subclass declared here. Downstream
 *   modules import these and emit them via `Effect.fail`. No raw `throw` lives
 *   anywhere in the codemod's runtime path.
 *
 * @spec.guarantee Each error class carries a structured payload (no plain
 *   strings); fields are size-capped and serializable into the validate-mode
 *   diagnostic shape `{ problem, cause, fix, docsLink }`.
 *   reason: agents consume these error payloads as context for downstream
 *           dispatch; un-typed message strings would defeat the typed channel.
 */

import { Data } from "effect";
import type { Kind } from "../kernel/index.js";

export class SidecarSchemaError extends Data.TaggedError("SidecarSchemaError")<{
  readonly path: string;
  readonly issues: ReadonlyArray<string>;
}> {}

export class JsDocDirectiveParseError extends Data.TaggedError("JsDocDirectiveParseError")<{
  readonly path: string;
  readonly line: number;
  readonly directive: string;
  readonly reason: string;
}> {}

export class JsDocDirectiveOverflowError extends Data.TaggedError("JsDocDirectiveOverflowError")<{
  readonly path: string;
  readonly line: number;
  readonly directive: string;
  readonly length: number;
  readonly limit: number;
}> {}

export class JsDocUnknownDirectiveError extends Data.TaggedError("JsDocUnknownDirectiveError")<{
  readonly path: string;
  readonly line: number;
  readonly directive: string;
}> {}

export class UnknownExportShapeError extends Data.TaggedError("UnknownExportShapeError")<{
  readonly path: string;
  readonly exportName: string;
  readonly reason: string;
}> {}

export class AmbiguousKindError extends Data.TaggedError("AmbiguousKindError")<{
  readonly path: string;
  readonly exportName: string;
  readonly candidates: ReadonlyArray<Kind>;
}> {}

export class ApplicabilityResolutionError extends Data.TaggedError("ApplicabilityResolutionError")<{
  readonly exportName: string;
  readonly shape: string;
  readonly reason: string;
}> {}

export class LinkResolutionError extends Data.TaggedError("LinkResolutionError")<{
  readonly symbol: string;
  readonly origin: string;
  readonly reason: string;
}> {}

export class SidecarWriteError extends Data.TaggedError("SidecarWriteError")<{
  readonly folder: string;
  readonly cause: unknown;
}> {}

export class GenerateError extends Data.TaggedError("GenerateError")<{
  readonly folder: string;
  readonly reason: string;
}> {}

/**
 * @spec.guarantee "the gapClass field is one of {11, 12, 13}; the runtime constructor enforces the literal-union type"
 *   reason: external CI scripts and the orchestrator's Step-5d routing
 *           switch on the integer code (Amendment 5).
 * @spec.residual-contract "diagnostic body conforms to `validate-diagnostic-shape` (problem, cause, fix, docsLink); each field is size-capped at the codemod's emit boundary"
 *   reason: trust contract; agents consume the diagnostic as routing input.
 */
export class ValidateError extends Data.TaggedError("ValidateError")<{
  readonly gapClass: 11 | 12 | 13;
  readonly location: string;
  readonly diagnostic: {
    readonly problem: string;
    readonly cause: string;
    readonly fix: string;
    readonly docsLink: string;
  };
}> {}

export class CliExitCode extends Data.TaggedError("CliExitCode")<{
  readonly code: number;
}> {}

export class InitError extends Data.TaggedError("InitError")<{
  readonly folder: string;
  readonly reason: string;
}> {}

export class DoctorError extends Data.TaggedError("DoctorError")<{
  readonly check: string;
  readonly reason: string;
}> {}

export class MigrateError extends Data.TaggedError("MigrateError")<{
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly reason: string;
}> {}

export class ExplainError extends Data.TaggedError("ExplainError")<{
  readonly errorCode: string;
  readonly reason: string;
}> {}

export class CliUsageError extends Data.TaggedError("CliUsageError")<{
  readonly subcommand: string;
  readonly reason: string;
}> {}
