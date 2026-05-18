#!/usr/bin/env node
 
/**
 * @spec.purpose CLI binary. Composes the four subcommands (`generate`,
 *   `validate`, `doctor`, `explain`) into the top-level `safer-spec`
 *   Command, then translates each tagged failure into `process.exit(N)`
 *   at the runtime boundary.
 *
 *   `init` and `migrate` are intentionally NOT CLI commands. Both are
 *   project-lifecycle flows that depend on judgment a regex / ts-morph
 *   resolver can't make reliably (which export to bind the stub to;
 *   which format-version diffs need human review). They ship as
 *   coding-agent skills (`skills/safer-spec-init/SKILL.md`,
 *   `skills/safer-spec-migrate/SKILL.md`) — the agent reads the
 *   existing barrel + spec format, scaffolds the right shape, and
 *   leaves the diff for human review.
 *
 *   Exit-code mapping at this boundary:
 *     - `MissingSpecPropertyError` → exit 11
 *     - `MissingStubError`         → exit 12
 *     - `MissingImplError`         → exit 13
 *     - `CliUsageError`            → exit 2 (POSIX usage convention)
 *     - any other defect / failure → `NodeRuntime.runMain` default (non-zero)
 *
 *   Tagged errors `CliExitCode` and `CliUsageError` are co-located here.
 */

import { Args, Command, Options } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Data, Effect } from "effect";
import { doctor } from "@safer/commands/doctor.js";
import { explain } from "@safer/commands/explain.js";
import { generate } from "@safer/commands/generate.js";
import {
  FOLDER_NOT_FOUND_EXIT_CODE,
  formatDiagnostic,
  validate,
  VALIDATE_GAP_EXIT_CODES,
  type ValidateGapError,
} from "@safer/commands/validate.js";
import {
  FolderNotFoundError,
  SPEC_FORMAT_VERSION,
} from "@safer/project/index.js";

/**
 * @spec.guarantee "carries a POSIX exit code in `.code`; the runtime boundary unwraps it via `process.exit(code)`"
 *   reason: cli-final translation of validation outcomes to OS-visible signals.
 * @spec.skip "Roundtrip"
 *   reason: an error class carrying an integer; no encode/decode pair.
 * @spec.skip "Partial Roundtrip"
 *   reason: no normalize-then-recover relation.
 * @spec.skip "Commutative Paths"
 *   reason: a single tagged-error class; no alternative path constructs it.
 * @spec.skip "Inclusion"
 *   reason: not a collection.
 */
export class CliExitCode extends Data.TaggedError("CliExitCode")<{
  readonly code: number;
}> {}

/**
 * @spec.guarantee "carries the offending subcommand and a human-readable reason; routed to POSIX exit code 2 (usage error)"
 *   reason: cli convention; downstream automation greps the tag and the
 *           subcommand name.
 * @spec.skip "Roundtrip"
 *   reason: a tagged-error class; no encode/decode pair.
 * @spec.skip "Partial Roundtrip"
 *   reason: no normalize-then-recover relation.
 * @spec.skip "Commutative Paths"
 *   reason: a single tagged-error class; no alternative path constructs it.
 * @spec.skip "Inclusion"
 *   reason: not a collection.
 */
export class CliUsageError extends Data.TaggedError("CliUsageError")<{
  readonly subcommand: string;
  readonly reason: string;
}> {}

/**
 * Single source of truth for tag to POSIX exit code translation. Gap-class
 * codes come from `VALIDATE_GAP_EXIT_CODES`; the usage-error code is the
 * POSIX convention for command-line misuse. The `satisfies` clause guarantees
 * every named tag is mapped.
 */
const CLI_EXIT_CODES = {
  ...VALIDATE_GAP_EXIT_CODES,
  FolderNotFoundError: FOLDER_NOT_FOUND_EXIT_CODE,
  CliUsageError: 2,
} as const satisfies Record<
  ValidateGapError["_tag"] | FolderNotFoundError["_tag"] | CliUsageError["_tag"],
  number
>;

// --- generate ---
const generateFolderOpt = Options.text("folder").pipe(Options.optional);
const generateWriteOpt = Options.boolean("write").pipe(Options.withDefault(false));
const generateDryRunOpt = Options.boolean("dry-run").pipe(Options.withDefault(false));
const generateWatchOpt = Options.boolean("watch").pipe(Options.withDefault(false));
const generateCommand = Command.make(
  "generate",
  {
    folder: generateFolderOpt,
    write: generateWriteOpt,
    dryRun: generateDryRunOpt,
    watch: generateWatchOpt,
  },
  ({ folder, write, dryRun, watch }) =>
    generate({ folder, write, dryRun, watch }).pipe(
      Effect.flatMap((result) =>
        Effect.log(`generate touched ${result.foldersTouched.length} folders`),
      ),
    ),
);

// --- validate ---
const validateFolderOpt = Options.text("folder").pipe(Options.optional);
const validatePlannedOpt = Options.boolean("planned").pipe(Options.withDefault(false));
const validateImplementedOpt = Options.boolean("implemented").pipe(Options.withDefault(false));

// Effect's default logger writes to stdout; validate diagnostics
// belong on stderr so scripts piping the success path's stdout don't
// receive the error body.
const writeStderr = (message: string): Effect.Effect<void> =>
  Effect.sync(() => {
    process.stderr.write(`${message}\n`);
  });

const handleValidateError = (
  e: ValidateGapError | FolderNotFoundError | CliUsageError,
): Effect.Effect<never, CliExitCode> =>
  Effect.gen(function* () {
    if (e._tag === "CliUsageError") {
      yield* writeStderr(`usage error in ${e.subcommand}: ${e.reason}`);
    } else if (e._tag === "FolderNotFoundError") {
      yield* writeStderr(`folder not found: ${e.requested}`);
    } else {
      const formatted = yield* formatDiagnostic(e);
      yield* writeStderr(formatted);
    }
    return yield* Effect.fail(new CliExitCode({ code: CLI_EXIT_CODES[e._tag] }));
  });

const validateCommand = Command.make(
  "validate",
  {
    folder: validateFolderOpt,
    planned: validatePlannedOpt,
    implemented: validateImplementedOpt,
  },
  ({ folder, planned, implemented }) =>
    Effect.gen(function* () {
      if (planned && implemented) {
        return yield* Effect.fail(
          new CliUsageError({
            subcommand: "validate",
            reason: "--planned and --implemented are mutually exclusive",
          }),
        );
      }
      const mode: "planned" | "implemented" = planned ? "planned" : "implemented";
      const report = yield* validate({ folder, mode });
      yield* Effect.log(
        `validate passed across ${report.foldersValidated.length} folders`,
      );
      return report;
    }).pipe(
      Effect.catchAll(handleValidateError),
      Effect.withSpan("validateCommand"),
    ),
);

// --- doctor ---
const doctorCommand = Command.make("doctor", {}, () =>
  doctor().pipe(
    Effect.flatMap((report) =>
      Effect.log(`doctor ${report.overall} (${report.checks.length} checks)`),
    ),
  ),
);

// --- explain ---
const explainErrorCodeArg = Args.text({ name: "error-code" });
const explainCommand = Command.make(
  "explain",
  { errorCode: explainErrorCodeArg },
  ({ errorCode }) =>
    explain({ errorCode }).pipe(
      Effect.flatMap((result) => Effect.log(result.entry)),
    ),
);

// --- root ---
const root = Command.make("safer-spec", {}, () =>
  Effect.log("safer-spec — per-folder SPEC.md codemod. Pass --help."),
);

const command = root.pipe(
  Command.withSubcommands([
    generateCommand,
    validateCommand,
    doctorCommand,
    explainCommand,
  ]),
);

const cli = Command.run(command, {
  name: "safer-spec",
  version: SPEC_FORMAT_VERSION,
});

// eslint-disable-next-line agent-code-guard/prefer-effect-platform -- @effect/cli's Command.run consumes argv at the bootstrap entrypoint; no Effect-native source exists before the runtime starts
Effect.suspend(() => cli(process.argv))
  .pipe(
    Effect.catchTag("CliExitCode", (e) =>
      Effect.sync(() => {
        process.exit(e.code);
      }),
    ),
    Effect.provide(NodeContext.layer),
  )
  .pipe(NodeRuntime.runMain);
