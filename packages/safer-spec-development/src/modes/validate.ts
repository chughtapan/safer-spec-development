/* eslint-disable sonarjs/todo-tag -- the JSDoc references Vitest's
   `it.todo` / `it.prop` collector API by name as part of the gap-class
   contract documentation; the rule treats the lowercase token "todo" as a
   stale-task marker, but it is the public API name being cited */
/**
 * @spec.purpose
 *   `validate` mode entrypoint. Runs `generate` to memory, diffs against
 *   on-disk artifacts, reads Vitest reporter sidecars, asserts the gate
 *   classes, and fails on the typed error channel with one of the {11, 12,
 *   13} gap-class exit codes per the Stage 5 spec's `## Amendment 5 mapping`
 *   (sub-issue #3).
 *
 *   Per parent epic Amendment 6, the four cross-checks `validate
 *   --implemented` performs are:
 *     (a) Every `itSpec.prop`/`itSpec.todo` call site has the four required
 *         JSDoc directives (`@spec.property`, `@spec.kind`, `@spec.exports`,
 *         `@spec.claim`). Missing → gapClass 12 (MISSING_STUB).
 *     (b) JSDoc directive values match the runtime `meta` argument
 *         (id ↔ `@spec.property`, kind ↔ `@spec.kind`, exports member names
 *         ↔ `@spec.exports`). Mismatch → gapClass 11
 *         (MISSING_SPEC_PROPERTY).
 *     (c) Committed SPEC.md `## Properties` table is byte-equal to the
 *         re-generated table (the table is GENERATED from test JSDoc; hand
 *         edits are drift). Drift → gapClass 11.
 *     (d) Every `itSpec.prop` body is non-empty (not `it.todo`, not empty
 *         fast-check). Empty → gapClass 13 (MISSING_IMPL).
 *
 *   Exit-code contract:
 *     0  → success channel: `ValidatePassReport`.
 *     11 → error channel: `ValidateError({ gapClass: 11, ... })` (spec-tier ratchet).
 *     12 → error channel: `ValidateError({ gapClass: 12, ... })` (architect-tier ratchet).
 *     13 → error channel: `ValidateError({ gapClass: 13, ... })` (implementer-tier BLOCK).
 *
 *   `--planned` mode: kind-metadata-only check; classifier-coverage and
 *   precondition-pass-rate gates are skipped. Architect-PR-tolerant.
 *
 *   `--implemented` mode: full gate including (a) — (d).
 *
 *   Tagged error `ValidateError` is co-located here.
 *
 *   Caller pattern:
 *     ```ts
 *     validate(input).pipe(
 *       Effect.catchTag("ValidateError", (e) => translateExitCode(e.gapClass))
 *     )
 *     ```
 */

import type { FileSystem, Path } from "@effect/platform";
import { Data, Effect, Schema } from "effect";

const ValidateDiagnosticSchema = Schema.Struct({
  problem: Schema.String,
  cause: Schema.String,
  fix: Schema.String,
  docsLink: Schema.String,
});

export type ValidateDiagnostic = Schema.Schema.Type<typeof ValidateDiagnosticSchema>;

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
  readonly diagnostic: ValidateDiagnostic;
}> {}

/**
 * @spec.guarantee "the three exit codes are stable; CI scripts may switch on the integer values"
 *   reason: external scripts depend on the exact codes for routing
 *           (Amendment 5).
 * @spec.residual-contract none
 *   reason: shape captured by `as const` literal types.
 */
export const GAP_CLASS_EXIT_CODES = {
  MISSING_SPEC_PROPERTY: 11 as const,
  MISSING_STUB: 12 as const,
  MISSING_IMPL: 13 as const,
};

export type GapClassName = keyof typeof GAP_CLASS_EXIT_CODES;
export type GapClass = (typeof GAP_CLASS_EXIT_CODES)[GapClassName];

interface ValidateInput {
  readonly folder: string | null;
  readonly mode: "planned" | "implemented";
  readonly formatVersionCheck: boolean;
}

interface ValidatePassReport {
  readonly _tag: "pass";
  readonly foldersValidated: ReadonlyArray<string>;
}

/**
 * @spec.assume "the underlying `generate` step is deterministic at the same tree SHA"
 *   reason: cross-check (c) above relies on byte-equality between the
 *           on-disk SPEC.md and the regenerated one.
 * @spec.guarantee "first failing check short-circuits and emits a single `ValidateError`"
 *   reason: the orchestrator's Step-5d routing acts on the gapClass; a
 *           batched failure would obscure routing.
 * @spec.residual-contract "Vitest reporter sidecars must already exist on disk for `--implemented` mode; their absence is a separate diagnostic class (stale-CI-artifact)"
 *   reason: lifecycle ordering; not encoded in the input shape.
 */
export const validate = (
  _input: ValidateInput,
): Effect.Effect<
  ValidatePassReport,
  ValidateError,
  FileSystem.FileSystem | Path.Path
> => Effect.die(new Error("Stage 1 stub: validate not implemented"));

/**
 * @spec.guarantee "output string is the canonical user-facing diagnostic body for the given gap class"
 *   reason: the CLI binary writes this directly to stderr; no further
 *           shaping happens at the runtime boundary.
 * @spec.residual-contract none
 *   reason: pure transformation; output shape derived from input.
 */
export const formatDiagnostic = (
  _gapClass: GapClass,
  _diagnostic: ValidateDiagnostic,
): Effect.Effect<string, never> =>
  Effect.die(new Error("Stage 1 stub: formatDiagnostic not implemented"));
