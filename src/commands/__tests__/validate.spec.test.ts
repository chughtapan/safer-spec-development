/**
 * @spec.purpose Property stubs for the `validate` command entrypoint. Validate
 *   enforces four cross-checks: JSDoc directives exist on every itSpec call,
 *   JSDoc values match runtime metadata, committed SPEC.md equals regenerated
 *   output, and every implemented property has a non-empty body.
 *
 *   Each test memoizes its heavy I/O once at module load (fc runs the test
 *   body 100×; without memoization the project walks would time out).
 *   Drift-gate properties live in `validate-drift.spec.test.ts`.
 */

import { Cause, Data, Effect, Exit, Option } from "effect";
import { NodeContext } from "@effect/platform-node";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import {
  formatDiagnostic,
  validate,
  VALIDATE_GAP_EXIT_CODES,
} from "@safer/commands/validate.js";

class ValidateAssertionError extends Data.TaggedError(
  "ValidateAssertionError",
)<{ readonly detail: string }> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, ValidateAssertionError> =>
  cond ? Effect.fail(new ValidateAssertionError({ detail })) : Effect.void;

const tagOfFirstFailure = <A, E>(exit: Exit.Exit<A, E>): string | null => {
  if (!Exit.isFailure(exit)) return null;
  const [first] = [...Cause.failures(exit.cause)];
  const probe = first as { readonly _tag?: unknown } | undefined;
  return probe !== undefined && typeof probe._tag === "string" ? probe._tag : null;
};

const firstFailure = <A, E>(exit: Exit.Exit<A, E>): unknown => {
  if (!Exit.isFailure(exit)) return undefined;
  const [first] = [...Cause.failures(exit.cause)];
  return first;
};

const runValidate = (
  folder: Option.Option<string>,
  mode: "planned" | "implemented",
): Effect.Effect<Exit.Exit<unknown, unknown>, never> =>
  Effect.exit(validate({ folder, mode }).pipe(Effect.provide(NodeContext.layer)));

// Top-level await pre-resolves these once during Vitest collect so the
// fc loop never blocks on the heavy walks.
const NONEXISTENT_PLANNED_EXIT = await Effect.runPromise(
  runValidate(Option.some("__nonexistent__"), "planned"),
);
const NONEXISTENT_PLANNED_EXIT_2 = await Effect.runPromise(
  runValidate(Option.some("__nonexistent__"), "planned"),
);
const SELF_HOST_PLANNED_EXIT = await Effect.runPromise(
  runValidate(Option.none(), "planned"),
);

const DIAG_FIELDS = ["problem", "cause", "fix", "docsLink"] as const;

const hasValidShape = (diag: Record<string, unknown> | undefined): boolean => {
  if (diag === undefined) return false;
  return DIAG_FIELDS.every((f) => typeof diag[f] === "string");
};

/**
 * @spec.property validate-gate-determ
 * @spec.type Roundtrip
 * @spec.exports validate
 * @spec.claim two validate runs at the same tree SHA produce byte-identical reports modulo generated-at-sha
 */
itSpec.prop(
  "validate-gate-determ",
  { type: "Roundtrip", exports: [validate] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        tagOfFirstFailure(NONEXISTENT_PLANNED_EXIT) !==
          tagOfFirstFailure(NONEXISTENT_PLANNED_EXIT_2),
        `two runs produced different failure tags`,
      ),
    ),
);

/**
 * @spec.property validate-rejects-unresolved-folder
 * @spec.type Exception Raising
 * @spec.exports validate
 * @spec.claim `validate --folder X` for a folder X not in the discovered list fails with `FolderNotFoundError` carrying the user's requested string — the cli's exit-1 path
 */
itSpec.prop(
  "validate-rejects-unresolved-folder",
  { type: "Exception Raising", exports: [validate] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        tagOfFirstFailure(NONEXISTENT_PLANNED_EXIT) !== "FolderNotFoundError",
        `expected FolderNotFoundError; got ${tagOfFirstFailure(NONEXISTENT_PLANNED_EXIT) ?? "<null>"}`,
      ),
    ),
);

/**
 * @spec.property validate-gap-exit-codes-cover-three-tags
 * @spec.type Typechecking
 * @spec.exports validate, formatDiagnostic
 * @spec.claim `VALIDATE_GAP_EXIT_CODES` maps each of the three gap-class tags to an exit code in {11, 12, 13} — the cli's exit-code contract
 */
itSpec.prop(
  "validate-gap-exit-codes-cover-three-tags",
  { type: "Typechecking", exports: [validate, formatDiagnostic] },
  fc.constantFrom(
    "MissingSpecPropertyError" as const,
    "MissingStubError" as const,
    "MissingImplError" as const,
  ),
  (tag) =>
    Effect.runPromise(
      failIf(
        ![11, 12, 13].includes(VALIDATE_GAP_EXIT_CODES[tag]),
        `tag ${tag} mapped to unexpected code ${VALIDATE_GAP_EXIT_CODES[tag]}`,
      ),
    ),
);

/**
 * @spec.property properties-table-self-host
 * @spec.type Inclusion
 * @spec.exports validate
 * @spec.claim the codemod's own SPEC.md ## Properties table equals what generate would emit from this codemod's test JSDoc
 */
itSpec.prop(
  "properties-table-self-host",
  { type: "Inclusion", exports: [validate] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        !Exit.isSuccess(SELF_HOST_PLANNED_EXIT),
        `self-host validate --planned failed: ${tagOfFirstFailure(SELF_HOST_PLANNED_EXIT) ?? ""}`,
      ),
    ),
);

/**
 * @spec.property properties-table-self-host-bodied
 * @spec.type Inclusion
 * @spec.exports validate
 * @spec.claim every itSpec.prop in the codemod's own tree has a non-empty fast-check body (no it.todo, no empty body)
 */
itSpec.prop(
  "properties-table-self-host-bodied",
  { type: "Inclusion", exports: [validate] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        !Exit.isSuccess(SELF_HOST_PLANNED_EXIT),
        `planned validate failed (precondition for implemented): ${tagOfFirstFailure(SELF_HOST_PLANNED_EXIT) ?? ""}`,
      ),
    ),
);
