/**
 * @spec.purpose Property tests for the tagged errors `commands/index.ts`
 *   publishes. `CliExitCode` carries the POSIX exit code the binary
 *   yields; `CliUsageError` carries a subcommand + reason for the
 *   `validate --planned --implemented` style mutually-exclusive flags
 *   path. Both are constructed via Effect's `Data.TaggedError` factory
 *   and consumed by `Effect.catchTag` at the runtime boundary.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import { CliExitCode, CliUsageError } from "@safer/commands/index.js";

class TaggedErrorAssertionError extends Data.TaggedError(
  "TaggedErrorAssertionError",
)<{ readonly detail: string }> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, TaggedErrorAssertionError> =>
  cond ? Effect.fail(new TaggedErrorAssertionError({ detail })) : Effect.void;

/**
 * @spec.property cli-exit-code-roundtrips-payload
 * @spec.type Constant Equality
 * @spec.exports CliExitCode
 * @spec.claim a `CliExitCode` constructed with `{ code }` exposes the same `code` value back through the public field — Data.TaggedError preserves the payload byte-for-byte
 */
itSpec.prop(
  "cli-exit-code-roundtrips-payload",
  { type: "Constant Equality", exports: [CliExitCode] },
  fc.integer({ min: 0, max: 255 }),
  (code) =>
    Effect.runPromise(
      failIf(
        new CliExitCode({ code }).code !== code,
        `CliExitCode({code:${code}}).code !== ${code}`,
      ),
    ),
);

/**
 * @spec.property cli-exit-code-tag-stable
 * @spec.type Constant Equality
 * @spec.exports CliExitCode
 * @spec.claim every `CliExitCode` instance carries `_tag: "CliExitCode"` — the discriminant `Effect.catchTag` keys on at the runtime boundary
 */
itSpec.prop(
  "cli-exit-code-tag-stable",
  { type: "Constant Equality", exports: [CliExitCode] },
  fc.integer({ min: 0, max: 255 }),
  (code) =>
    Effect.runPromise(
      failIf(
        new CliExitCode({ code })._tag !== "CliExitCode",
        `expected _tag "CliExitCode"`,
      ),
    ),
);

/**
 * @spec.property cli-exit-code-is-throwable
 * @spec.type Exception Raising
 * @spec.exports CliExitCode
 * @spec.claim `CliExitCode` is an Error subclass and can be raised through `Effect.fail` → unwound by `Effect.catchTag` without losing its tag or payload
 */
itSpec.prop(
  "cli-exit-code-is-throwable",
  { type: "Exception Raising", exports: [CliExitCode] },
  fc.integer({ min: 0, max: 255 }),
  (code) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new CliExitCode({ code });
        yield* failIf(
          !(e instanceof Error),
          `CliExitCode instance must extend Error`,
        );
        const caught = yield* Effect.fail(e).pipe(
          Effect.catchTag("CliExitCode", (x) => Effect.succeed(x.code)),
        );
        yield* failIf(
          caught !== code,
          `catchTag round-trip failed: got ${caught}, expected ${code}`,
        );
      }),
    ),
);

/**
 * @spec.property cli-usage-error-roundtrips-payload
 * @spec.type Constant Equality
 * @spec.exports CliUsageError
 * @spec.claim a `CliUsageError` constructed with `{ subcommand, reason }` exposes both fields back through their public names
 */
itSpec.prop(
  "cli-usage-error-roundtrips-payload",
  { type: "Constant Equality", exports: [CliUsageError] },
  fc.record({
    subcommand: fc.string({ minLength: 1, maxLength: 30 }),
    reason: fc.string({ minLength: 1, maxLength: 100 }),
  }),
  ({ subcommand, reason }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new CliUsageError({ subcommand, reason });
        yield* failIf(
          e.subcommand !== subcommand,
          `subcommand mismatch: ${e.subcommand} vs ${subcommand}`,
        );
        yield* failIf(
          e.reason !== reason,
          `reason mismatch: ${e.reason} vs ${reason}`,
        );
      }),
    ),
);

/**
 * @spec.property cli-usage-error-tag-stable
 * @spec.type Typechecking
 * @spec.exports CliUsageError
 * @spec.claim `CliUsageError._tag === "CliUsageError"` — distinct from `CliExitCode`'s tag so catchTag routes to the right exit-code branch
 */
itSpec.prop(
  "cli-usage-error-tag-stable",
  { type: "Typechecking", exports: [CliUsageError] },
  fc.record({
    subcommand: fc.string({ minLength: 1, maxLength: 30 }),
    reason: fc.string({ minLength: 1, maxLength: 100 }),
  }),
  ({ subcommand, reason }) =>
    Effect.runPromise(
      failIf(
        new CliUsageError({ subcommand, reason })._tag !== "CliUsageError",
        `expected _tag "CliUsageError"`,
      ),
    ),
);
