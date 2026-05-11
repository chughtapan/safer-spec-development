/**
 * @spec.purpose
 *   `generate` mode entrypoint. Walks `src/**` (source) AND `**\/*.spec.test.ts`
 *   (tests), parses JSDoc directives on both surfaces, and emits per-folder
 *   SPEC.md plus `.safer-spec/<folder>.json` structured sidecar.
 *
 *   Per parent epic Amendment 6 (the property-model inversion):
 *     - `## Properties` table rows are EXTRACTED FROM tests (each
 *       `itSpec.prop`/`itSpec.todo` call site contributes one row, sourced
 *       from the four required JSDoc directives `@spec.property`,
 *       `@spec.kind`, `@spec.exports`, `@spec.claim`).
 *     - All other SPEC.md sections (`## Purpose`, `## Public surface /
 *       <Export> / Residual contract`, etc.) are emitted from per-export
 *       JSDoc on the source declarations + the kind-detector + applicability
 *       matrix output.
 *
 *   Composes glob → ts-morph → jsdoc-parser → kind-detector → applicability →
 *   section-emitter → reporter.sidecar-writer. Idempotent steady-state
 *   regeneration in canonical form.
 */

import type { FileSystem, Path } from "@effect/platform";
import type { Effect } from "effect";
import { Effect as Eff } from "effect";
import type { GenerateError } from "../errors/index.js";

interface GenerateInput {
  readonly folder: string | null;
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
 * @spec.assume "every source export in scope carries either at least one `@spec.assume`/`@spec.guarantee` directive OR `@spec.residual-contract none reason: ...`"
 *   reason: per-export contract enforced separately by `validate
 *           --implemented` (exit 12 when missing); the generate step
 *           assumes the contract and emits its rendered form.
 * @spec.guarantee "writes are SHA-stable: re-running on the same tree SHA produces byte-identical output modulo `generated-at-sha`"
 *   reason: roundtrip contract; downstream `validate-gate-determ` test
 *           asserts this property at the codemod's own self-host.
 * @spec.residual-contract "watch mode debounces filesystem events; debounce window is implementation-defined"
 *   reason: behavioral residue beyond the Effect signature.
 */
export const generate = (
  _input: GenerateInput,
): Effect.Effect<
  GenerateResult,
  GenerateError,
  FileSystem.FileSystem | Path.Path
> => Eff.die(new Error("Stage 1 stub: generate not implemented"));
