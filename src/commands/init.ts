/**
 * @spec.purpose
 *   `init` command entrypoint. Scaffolds a folder's `index.ts` barrel plus
 *   a single `itSpec.todo` property stub under `__tests__/&lt;slug>.spec.test.ts`.
 *   When `folder` is omitted, picks the first discovered `index.ts`-bearing
 *   leaf that does not yet carry a `SPEC.md`. Targets TTHW &lt;10 minutes.
 *
 *   Tagged error `InitError` is co-located here.
 */

import { FileSystem, Path } from "@effect/platform";
import { Data, Effect, Option } from "effect";
import { discoverFolders } from "@safer/commands/folder-discovery.js";
import { normalizeFolder } from "@safer/commands/project-context.js";

export class InitError extends Data.TaggedError("InitError")<{
  readonly folder: string;
  readonly reason: string;
  readonly cause: string;
}> {}

interface InitInput {
  /** `Option.none()` picks a leaf folder with `index.ts`; `Option.some(path)` scopes to one. */
  readonly folder: Option.Option<string>;
}

interface InitResult {
  readonly folder: string;
  readonly filesCreated: ReadonlyArray<string>;
}

const fileExists = (
  fs: FileSystem.FileSystem,
  p: string,
): Effect.Effect<boolean, never> =>
  fs.exists(p).pipe(Effect.catchAll(() => Effect.succeed(false)));

const readDirSafe = (
  fs: FileSystem.FileSystem,
  dir: string,
): Effect.Effect<ReadonlyArray<string>, never> =>
  fs.readDirectory(dir).pipe(
    Effect.map((es) => [...es]),
    Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<string>)),
  );

const hasExistingTestFile = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  folder: string,
): Effect.Effect<boolean, never> =>
  readDirSafe(fs, path.join(folder, "__tests__")).pipe(
    Effect.map((entries) => entries.some((n) => n.endsWith(".spec.test.ts"))),
  );

const DASH = 45;
const trimDashes = (s: string): string => {
  let start = 0;
  let end = s.length;
  while (start < end && s.charCodeAt(start) === DASH) start += 1;
  while (end > start && s.charCodeAt(end - 1) === DASH) end -= 1;
  return s.slice(start, end);
};

const folderSlug = (path: Path.Path, folder: string): string => {
  if (folder === "." || folder === "") return "root";
  const base = path.basename(folder);
  const dashed = base.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const trimmed = trimDashes(dashed);
  return trimmed.length === 0 ? "root" : trimmed;
};

const indexTemplate = (): string =>
  `/**\n` +
  ` * @spec.purpose Scaffolded by \`safer-spec init\`. Replace this with what the folder owns.\n` +
  ` */\n` +
  `\n` +
  `export const placeholder = "TODO" as const;\n`;

const testTemplate = (slug: string): string => {
  const propertyId = `${slug}-placeholder-is-todo`;
  return (
    `/**\n` +
    ` * @spec.purpose Scaffolded by \`safer-spec init\`. Replace this with what the tests assert.\n` +
    ` */\n` +
    `\n` +
    `import { itSpec } from "@chughtapan/safer-spec-development";\n` +
    `import { placeholder } from "../index.js";\n` +
    `\n` +
    `/**\n` +
    ` * @spec.property ${propertyId}\n` +
    ` * @spec.type Constant Equality\n` +
    ` * @spec.exports placeholder\n` +
    ` * @spec.claim placeholder export equals "TODO"\n` +
    ` */\n` +
    `itSpec.todo("${propertyId}", {\n` +
    `  type: "Constant Equality",\n` +
    `  exports: [placeholder],\n` +
    `});\n`
  );
};

const refusalCause = (kind: "spec-md" | "scaffolded"): string =>
  kind === "spec-md"
    ? "SPEC.md already exists in the target folder"
    : "index.ts already has content AND __tests__/ already has a .spec.test.ts";

const refusalReason = (kind: "spec-md" | "scaffolded"): string =>
  kind === "spec-md"
    ? "SPEC.md already exists; run `safer-spec generate --folder <folder>` to refresh it"
    : "folder is already scaffolded; run `safer-spec generate --folder <folder>` to refresh artifacts";

const refuseIfExisting = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  folder: string,
): Effect.Effect<void, InitError> =>
  Effect.gen(function* () {
    const specPath = path.join(folder, "SPEC.md");
    if (yield* fileExists(fs, specPath)) {
      return yield* Effect.fail(
        new InitError({
          folder,
          reason: refusalReason("spec-md"),
          cause: refusalCause("spec-md"),
        }),
      );
    }
    const indexPath = path.join(folder, "index.ts");
    const indexThere = yield* fileExists(fs, indexPath);
    if (indexThere && (yield* hasExistingTestFile(fs, path, folder))) {
      return yield* Effect.fail(
        new InitError({
          folder,
          reason: refusalReason("scaffolded"),
          cause: refusalCause("scaffolded"),
        }),
      );
    }
  });

const pickDefaultFolder = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
): Effect.Effect<string, InitError> =>
  Effect.gen(function* () {
    const folders = yield* discoverFolders(fs, path, ".");
    for (const f of folders) {
      const hasSpec = yield* fileExists(fs, path.join(f, "SPEC.md"));
      if (!hasSpec) return f;
    }
    return yield* Effect.fail(
      new InitError({
        folder: "<default>",
        reason:
          "no leaf folder available: every discovered `index.ts` folder already has a SPEC.md. Pass `init <folder>` explicitly.",
        cause: "discoverFolders returned no SPEC.md-less candidates",
      }),
    );
  });

const resolveFolder = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  input: Option.Option<string>,
): Effect.Effect<string, InitError> =>
  Option.isSome(input)
    ? Effect.succeed(normalizeFolder(input.value))
    : pickDefaultFolder(fs, path);

const causeOf = (e: unknown): string => {
  if (typeof e !== "object" || e === null || !("message" in e)) return String(e);
  const m = (e as { message: unknown }).message;
  return typeof m === "string" ? m : String(e);
};

const ioFail = (folder: string, target: string) =>
  (e: unknown): InitError =>
    new InitError({
      folder,
      reason: `failed to write ${target}`,
      cause: causeOf(e),
    });

interface WriteCtx {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly folder: string;
}

const writeIndexIfMissing = (
  c: WriteCtx,
  written: string[],
): Effect.Effect<void, InitError> =>
  Effect.gen(function* () {
    const indexPath = c.path.join(c.folder, "index.ts");
    if (yield* fileExists(c.fs, indexPath)) return;
    yield* c.fs
      .writeFileString(indexPath, indexTemplate())
      .pipe(Effect.mapError(ioFail(c.folder, indexPath)));
    written.push(indexPath);
  });

const writeTestStub = (
  c: WriteCtx,
  written: string[],
): Effect.Effect<void, InitError> =>
  Effect.gen(function* () {
    const testsDir = c.path.join(c.folder, "__tests__");
    yield* c.fs
      .makeDirectory(testsDir, { recursive: true })
      .pipe(Effect.catchAll(() => Effect.succeed(void 0)));
    const slug = folderSlug(c.path, c.folder);
    const testPath = c.path.join(testsDir, `${slug}.spec.test.ts`);
    if (yield* fileExists(c.fs, testPath)) return;
    yield* c.fs
      .writeFileString(testPath, testTemplate(slug))
      .pipe(Effect.mapError(ioFail(c.folder, testPath)));
    written.push(testPath);
  });

/**
 * @spec.assume "the target folder either does not exist yet, is empty, or contains an `index.ts` without a SPEC.md"
 *   reason: lifecycle precondition; not encoded in the InitInput shape.
 * @spec.guarantee "writes are per-file via the FileSystem service; an already-present index.ts is preserved untouched and only the missing pieces are added"
 *   reason: side-effect contract; init must never overwrite existing work.
 * @spec.residual-contract "scaffold templates are stable across patch versions; format-version bumps require migrate"
 *   reason: lifecycle contract beyond the Effect signature.
 */
export const init = (
  input: InitInput,
): Effect.Effect<InitResult, InitError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const folder = yield* resolveFolder(fs, path, input.folder);
    yield* fs
      .makeDirectory(folder, { recursive: true })
      .pipe(
        Effect.catchAll(() => Effect.succeed(void 0)),
      );
    yield* refuseIfExisting(fs, path, folder);
    const written: string[] = [];
    const ctx: WriteCtx = { fs, path, folder };
    yield* writeIndexIfMissing(ctx, written);
    yield* writeTestStub(ctx, written);
    return { folder, filesCreated: written };
  }).pipe(Effect.withSpan("commands/init"));
