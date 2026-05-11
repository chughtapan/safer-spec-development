/**
 * @spec.purpose
 *   `generate` mode entrypoint. Walks `src/**` (source) AND `**\/*.spec.test.ts`
 *   (tests), parses JSDoc directives on both surfaces, and emits per-folder
 *   SPEC.md plus `.safer-spec/<folder>.json` structured sidecar.
 *
 *   The `## Properties` table is extracted from tests: each
 *   `itSpec.prop`/`itSpec.todo` call site contributes one row sourced from
 *   `@spec.property`, `@spec.kind`, `@spec.exports`, and `@spec.claim`.
 *   Other sections are emitted from source-side JSDoc, kind detection, and
 *   applicability output.
 *
 *   Composes spec/ + source/ + sidecar/ domains. Mode is the orchestrator;
 *   the domains are the workers.
 *
 *   Tagged error `GenerateError` is co-located here.
 */

import type { FileSystem, Path } from "@effect/platform";
import { Data, Effect, Option } from "effect";

export class GenerateError extends Data.TaggedError("GenerateError")<{
  readonly folder: string;
  readonly reason: string;
}> {}

interface GenerateInput {
  /** `Option.none()` walks every folder under cwd; `Option.some(path)` scopes to one. */
  readonly folder: Option.Option<string>;
  readonly write: boolean;
  readonly dryRun: boolean;
  readonly watch: boolean;
}

interface GenerateResult {
  readonly foldersTouched: ReadonlyArray<string>;
  readonly filesWritten: ReadonlyArray<string>;
  readonly diff: string;
}

/**
 * @spec.assume "every source export in scope carries at least one `@spec.assume`/`@spec.guarantee` directive OR `@spec.residual-contract none reason: ...`"
 *   reason: per-export contract enforced separately by `validate
 *           --implemented` (exit 12 when missing); generate assumes the
 *           contract and emits its rendered form.
 * @spec.guarantee "writes are SHA-stable: re-running on the same tree SHA produces byte-identical output modulo `generated-at-sha`"
 *   reason: roundtrip contract; downstream `validate-gate-determ`
 *           property test asserts this at the codemod's own self-host.
 * @spec.residual-contract "watch mode debounces filesystem events; debounce window is implementation-defined"
 *   reason: behavioral residue beyond the Effect signature.
 */
export const generate = (
  _input: GenerateInput,
): Effect.Effect<
  GenerateResult,
  GenerateError,
  FileSystem.FileSystem | Path.Path
> => Effect.die(new Error("Not implemented: generate"));
