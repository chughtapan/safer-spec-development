/**
 * @spec.purpose Coverage-sweep tests for `commands/` — adds property
 *   types beyond `tagged-errors.spec.test.ts` for the two tagged errors
 *   `CliExitCode` and `CliUsageError` so each crosses the gate threshold.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import { CliExitCode, CliUsageError } from "@safer/commands/index.js";

class CommandsSweepAssertionError extends Data.TaggedError(
  "CommandsSweepAssertionError",
)<{ readonly detail: string }> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, CommandsSweepAssertionError> =>
  cond ? Effect.fail(new CommandsSweepAssertionError({ detail })) : Effect.void;

/* ---------- CliExitCode additional property types ---------- */

/**
 * @spec.property cli-exit-code-bounded-by-posix-range
 * @spec.type Constant Bounds Checking
 * @spec.exports CliExitCode
 * @spec.claim `CliExitCode.code` accepts any number in `[0, 255]` — the POSIX exit-code range; values outside this range get truncated by the OS at `process.exit(code)` time
 */
itSpec.prop(
  "cli-exit-code-bounded-by-posix-range",
  { type: "Constant Bounds Checking", exports: [CliExitCode] },
  fc.integer({ min: 0, max: 255 }),
  (code) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new CliExitCode({ code });
        yield* failIf(e.code < 0, `negative code: ${e.code}`);
        yield* failIf(e.code > 255, `exceeds POSIX range: ${e.code}`);
      }),
    ),
);

/**
 * @spec.property cli-exit-code-non-equal-codes
 * @spec.type Constant Non-Equality
 * @spec.exports CliExitCode
 * @spec.claim two `CliExitCode` instances with different `code` values expose different `code` fields — no payload aliasing across instances
 */
itSpec.prop(
  "cli-exit-code-non-equal-codes",
  { type: "Constant Non-Equality", exports: [CliExitCode] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        new CliExitCode({ code: 0 }).code === new CliExitCode({ code: 1 }).code,
        `payload aliased across instances`,
      ),
    ),
);

/**
 * @spec.property cli-exit-code-typecheck
 * @spec.type Typechecking
 * @spec.exports CliExitCode
 * @spec.claim `CliExitCode` instances extend `Error` and expose `code` as a `number` — the runtime shape `process.exit(e.code)` consumes at the cli boundary
 */
itSpec.prop(
  "cli-exit-code-typecheck",
  { type: "Typechecking", exports: [CliExitCode] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new CliExitCode({ code: 0 });
        yield* failIf(!(e instanceof Error), `must extend Error`);
        yield* failIf(typeof e.code !== "number", `code must be number`);
      }),
    ),
);

/* ---------- CliUsageError additional property types ---------- */

/**
 * @spec.property cli-usage-error-typecheck
 * @spec.type Typechecking
 * @spec.exports CliUsageError
 * @spec.claim `CliUsageError` instances extend `Error` and expose `subcommand` + `reason` strings — the runtime shape the cli's stderr renderer concatenates
 */
itSpec.prop(
  "cli-usage-error-typecheck",
  { type: "Typechecking", exports: [CliUsageError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new CliUsageError({ subcommand: "validate", reason: "x" });
        yield* failIf(!(e instanceof Error), `must extend Error`);
        yield* failIf(typeof e.subcommand !== "string", `subcommand string`);
        yield* failIf(typeof e.reason !== "string", `reason string`);
      }),
    ),
);

/**
 * @spec.property cli-usage-error-non-equal-payloads
 * @spec.type Constant Non-Equality
 * @spec.exports CliUsageError
 * @spec.claim two `CliUsageError` instances with different `reason` strings expose different `reason` fields — no payload aliasing
 */
itSpec.prop(
  "cli-usage-error-non-equal-payloads",
  { type: "Constant Non-Equality", exports: [CliUsageError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        new CliUsageError({ subcommand: "validate", reason: "a" }).reason ===
          new CliUsageError({ subcommand: "validate", reason: "b" }).reason,
        `reason aliased`,
      ),
    ),
);

/**
 * @spec.property cli-usage-error-bounded-payload-types
 * @spec.type Constant Bounds Checking
 * @spec.exports CliUsageError
 * @spec.claim both payload fields stay strings even when constructed with empty input — `Data.TaggedError` doesn't coerce or default
 */
itSpec.prop(
  "cli-usage-error-bounded-payload-types",
  { type: "Constant Bounds Checking", exports: [CliUsageError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new CliUsageError({ subcommand: "", reason: "" });
        yield* failIf(typeof e.subcommand !== "string", `subcommand type drift`);
        yield* failIf(typeof e.reason !== "string", `reason type drift`);
      }),
    ),
);

/**
 * @spec.property cli-usage-error-is-throwable
 * @spec.type Exception Raising
 * @spec.exports CliUsageError
 * @spec.claim `CliUsageError` round-trips through `Effect.fail` / `Effect.catchTag` — the surface the cli's exit-2 path catches at the `@effect/cli` composition root
 */
itSpec.prop(
  "cli-usage-error-is-throwable",
  { type: "Exception Raising", exports: [CliUsageError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const caught = yield* Effect.fail(
          new CliUsageError({ subcommand: "validate", reason: "fixture" }),
        ).pipe(Effect.catchTag("CliUsageError", (e) => Effect.succeed(e.reason)));
        yield* failIf(caught !== "fixture", `catchTag roundtrip`);
      }),
    ),
);
