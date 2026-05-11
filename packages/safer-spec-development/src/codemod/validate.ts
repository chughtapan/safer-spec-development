/* eslint-disable sonarjs/todo-tag -- the JSDoc references Vitest's
   `it.todo` / `it.prop` collector API by name as part of the gap-class
   contract documentation; the rule treats the lowercase token "todo" as a
   stale-task marker, but it is the public API name being cited */
/**
 * @spec.purpose
 *   `validate` mode entrypoint. Runs `generate` to memory, diffs against
 *   on-disk artifacts, reads Vitest reporter sidecars, asserts the three gate
 *   classes, and fails on the typed error channel with one of the {11, 12, 13}
 *   gap-class exit codes per the Stage 5 spec's `## Amendment 5 mapping`
 *   (sub-issue #3).
 *
 *   Exit-code contract (per Stage 5 spec source-properties + Amendment 5):
 *     0  → success channel: `ValidatePassReport`.
 *     11 → error channel: `ValidateError({ gapClass: 11, ... })` (MISSING_SPEC_PROPERTY,
 *          spec-tier ratchet; the consuming SPEC.md's `## Properties` table has no
 *          row whose observation surface targets the export AND whose kind matches
 *          the applicability matrix).
 *     12 → error channel: `ValidateError({ gapClass: 12, ... })` (MISSING_STUB,
 *          architect-tier ratchet; a `## Properties` row exists with no colocated
 *          `it.todo` / `it.prop` declaration).
 *     13 → error channel: `ValidateError({ gapClass: 13, ... })` (MISSING_IMPL,
 *          implementer-tier BLOCK; an `it.prop` declaration exists with an empty
 *          fast-check body).
 *
 *   `--planned` mode: kind-metadata-only check; classifier-coverage and
 *   precondition-pass-rate gates are skipped. Architect-PR-tolerant.
 *
 *   `--implemented` mode: full gate.
 *
 *   Caller pattern:
 *     ```ts
 *     validate(input).pipe(
 *       Effect.catchTag("ValidateError", (e) => translateExitCode(e.gapClass))
 *     )
 *     ```
 *
 * @spec.guarantee Every emitted diagnostic conforms to
 *   `{ problem, cause, fix, docsLink }` (Stage 5 source property
 *   `validate-diagnostic-shape`).
 *   reason: structured diagnostics are the contract the orchestrator's Step-5d
 *           routing consumes.
 */

import type { FileSystem, Path } from "@effect/platform";
import { Schema, type Effect } from "effect";
import { Effect as Eff } from "effect";
import type { ValidateError } from "../errors/index.js";

const ValidateDiagnosticSchema = Schema.Struct({
  problem: Schema.String,
  cause: Schema.String,
  fix: Schema.String,
  docsLink: Schema.String,
});

export type ValidateDiagnostic = Schema.Schema.Type<typeof ValidateDiagnosticSchema>;

export const GAP_CLASS_EXIT_CODES = {
  MISSING_SPEC_PROPERTY: 11 as const,
  MISSING_STUB: 12 as const,
  MISSING_IMPL: 13 as const,
};

export type GapClassName = keyof typeof GAP_CLASS_EXIT_CODES;
export type GapClass = (typeof GAP_CLASS_EXIT_CODES)[GapClassName];

export interface ValidateInput {
  readonly folder: string | null;
  readonly mode: "planned" | "implemented";
  readonly formatVersionCheck: boolean;
}

export interface ValidatePassReport {
  readonly _tag: "pass";
  readonly foldersValidated: ReadonlyArray<string>;
}

export const validate = (
  _input: ValidateInput,
): Effect.Effect<
  ValidatePassReport,
  ValidateError,
  FileSystem.FileSystem | Path.Path
> => Eff.die(new Error("Stage 1 stub: validate not implemented"));

export const formatDiagnostic = (
  _gapClass: GapClass,
  _diagnostic: ValidateDiagnostic,
): Effect.Effect<string, never> =>
  Eff.die(new Error("Stage 1 stub: formatDiagnostic not implemented"));
