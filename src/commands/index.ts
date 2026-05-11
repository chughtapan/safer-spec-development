#!/usr/bin/env node
/* eslint-disable max-classes-per-file -- the CLI binary emits two
   closely-related tagged errors (CliExitCode, CliUsageError); co-locating
   them with the binary they belong to is per-domain ownership. */
/**
 * @spec.purpose CLI binary. Composes the six subcommands (`init`, `generate`,
 *   `validate`, `doctor`, `explain`, `migrate`) into the top-level
 *   `safer-spec` Command, then translates each tagged failure into
 *   `process.exit(N)` at the runtime boundary.
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
import { init } from "@safer/commands/init.js";
import { migrate } from "@safer/commands/migrate.js";
import {
  formatDiagnostic,
  validate,
  VALIDATE_GAP_EXIT_CODES,
  type ValidateGapError,
} from "@safer/commands/validate.js";
import { SPEC_FORMAT_VERSION } from "@safer/commands/version.js";

export class CliExitCode extends Data.TaggedError("CliExitCode")<{
  readonly code: number;
}> {}

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
  CliUsageError: 2,
} as const satisfies Record<ValidateGapError["_tag"] | CliUsageError["_tag"], number>;

// --- init ---
const initFolderArg = Args.text({ name: "folder" }).pipe(Args.optional);
const initCommand = Command.make(
  "init",
  { folder: initFolderArg },
  ({ folder }) =>
    init({ folder }).pipe(
      Effect.flatMap((result) =>
        Effect.log(
          `init scaffolded ${result.filesCreated.length} files in ${result.folder}`,
        ),
      ),
    ),
);

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
const validateFormatVersionCheckOpt = Options.boolean("format-version-check").pipe(
  Options.withDefault(false),
);

const handleValidateError = (
  e: ValidateGapError | CliUsageError,
): Effect.Effect<never, CliExitCode> =>
  Effect.gen(function* () {
    if (e._tag === "CliUsageError") {
      yield* Effect.logError(`usage error in ${e.subcommand}: ${e.reason}`);
    } else {
      const formatted = yield* formatDiagnostic(e);
      yield* Effect.logError(formatted);
    }
    return yield* Effect.fail(new CliExitCode({ code: CLI_EXIT_CODES[e._tag] }));
  });

const validateCommand = Command.make(
  "validate",
  {
    folder: validateFolderOpt,
    planned: validatePlannedOpt,
    implemented: validateImplementedOpt,
    formatVersionCheck: validateFormatVersionCheckOpt,
  },
  ({ folder, planned, implemented, formatVersionCheck }) =>
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
      const report = yield* validate({ folder, mode, formatVersionCheck });
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

// --- migrate ---
const migrateFromOpt = Options.text("from").pipe(
  Options.withDefault(SPEC_FORMAT_VERSION),
);
const migrateToOpt = Options.text("to").pipe(
  Options.withDefault(SPEC_FORMAT_VERSION),
);
const migrateDryRunOpt = Options.boolean("dry-run").pipe(
  Options.withDefault(true),
);
const migrateCommand = Command.make(
  "migrate",
  { from: migrateFromOpt, to: migrateToOpt, dryRun: migrateDryRunOpt },
  ({ from, to, dryRun }) =>
    migrate({ fromVersion: from, toVersion: to, dryRun }).pipe(
      Effect.flatMap((result) =>
        Effect.log(
          `migrate ${result.fromVersion} → ${result.toVersion} (${result.filesUpdated.length} files)`,
        ),
      ),
    ),
);

// --- root ---
const root = Command.make("safer-spec", {}, () =>
  Effect.log("safer-spec — per-folder SPEC.md codemod. Pass --help."),
);

const command = root.pipe(
  Command.withSubcommands([
    initCommand,
    generateCommand,
    validateCommand,
    doctorCommand,
    explainCommand,
    migrateCommand,
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
