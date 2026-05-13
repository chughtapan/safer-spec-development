/**
 * @spec.purpose
 *   `init` command entrypoint. Scaffolds a folder's `index.ts` barrel plus
 *   a single `itSpec.todo` property stub under `__tests__/&lt;slug>.spec.test.ts`.
 *   When `folder` is omitted, picks a leaf folder (no descendant candidate)
 *   among `index.ts`-bearing folders without a `SPEC.md`, so the default
 *   target is always a leaf. When the target already has an `index.ts`, the
 *   test stub imports the first named runtime export of that barrel; the
 *   picker resolves direct value declarations, `export { ... }` clauses,
 *   `export * as ns from ...` namespace aliases, and follows
 *   `export * from ...` re-exports up to STAR_MAX_DEPTH levels deep.
 *   Refuses if no runtime-named export resolves. Targets TTHW &lt;10 minutes.
 *
 *   Tagged error `InitError` is co-located here.
 */

import { FileSystem, Path } from "@effect/platform";
import { Data, Effect, Option } from "effect";
import { discoverFolders } from "@safer/commands/folder-discovery.js";
import { readFirstExport } from "@safer/commands/init-export-picker.js";
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

const PLACEHOLDER_EXPORT = "placeholder";

const indexTemplate = (): string =>
  `/**\n` +
  ` * @spec.purpose Scaffolded by \`safer-spec init\`. Replace this with what the folder owns.\n` +
  ` */\n` +
  `\n` +
  `export const ${PLACEHOLDER_EXPORT} = "TODO" as const;\n`;

const testTemplate = (slug: string, exportName: string): string => {
  const propertyId = `${slug}-${exportName}-stub`;
  return (
    `/**\n` +
    ` * @spec.purpose Scaffolded by \`safer-spec init\`. Replace this with what the tests assert.\n` +
    ` */\n` +
    `\n` +
    `import { itSpec } from "@chughtapan/safer-spec-development";\n` +
    `import { ${exportName} } from "../index.js";\n` +
    `\n` +
    `/**\n` +
    ` * @spec.property ${propertyId}\n` +
    ` * @spec.type Constant Equality\n` +
    ` * @spec.exports ${exportName}\n` +
    ` * @spec.claim placeholder property for the \`${exportName}\` export; promote to itSpec.prop with a real claim\n` +
    ` */\n` +
    `itSpec.todo("${propertyId}", {\n` +
    `  type: "Constant Equality",\n` +
    `  exports: [${exportName}],\n` +
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

const isAncestorOfAny = (
  path: Path.Path,
  candidate: string,
  others: ReadonlyArray<string>,
): boolean => {
  // discoverFolders yields the project root as `.` and descendants as `src`,
  // `src/components`, etc. — without a `./` prefix. A literal-prefix check
  // therefore never matches; treat `.` as an ancestor of every sibling
  // candidate so the leaf preference still picks the deeper folder.
  if (candidate === ".") return others.some((o) => o !== ".");
  const prefix = `${candidate}${path.sep}`;
  return others.some((o) => o !== candidate && o.startsWith(prefix));
};

const pickDefaultFolder = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
): Effect.Effect<string, InitError> =>
  Effect.gen(function* () {
    const folders = yield* discoverFolders(fs, path, ".");
    const candidates: string[] = [];
    for (const f of folders) {
      if (!(yield* fileExists(fs, path.join(f, "SPEC.md")))) candidates.push(f);
    }
    const leaf = candidates.find((c) => !isAncestorOfAny(path, c, candidates));
    if (leaf !== undefined) return leaf;
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
): Effect.Effect<boolean, InitError> =>
  Effect.gen(function* () {
    const indexPath = c.path.join(c.folder, "index.ts");
    if (yield* fileExists(c.fs, indexPath)) return false;
    yield* c.fs
      .writeFileString(indexPath, indexTemplate())
      .pipe(Effect.mapError(ioFail(c.folder, indexPath)));
    written.push(indexPath);
    return true;
  });

const resolveStubExport = (
  c: WriteCtx,
  indexWasWritten: boolean,
): Effect.Effect<string, InitError> =>
  Effect.gen(function* () {
    if (indexWasWritten) return PLACEHOLDER_EXPORT;
    const indexPath = c.path.join(c.folder, "index.ts");
    const found = yield* readFirstExport(c.fs, c.path, indexPath);
    if (found !== null) return found;
    return yield* Effect.fail(
      new InitError({
        folder: c.folder,
        reason:
          "existing `index.ts` declares no named export. Add `export const <name> = ...` (or a `function`/`class`/re-export) before re-running `init`, or remove the file to let init scaffold one.",
        cause: "no named export matched in existing index.ts",
      }),
    );
  });

const writeTestStub = (
  c: WriteCtx,
  exportName: string,
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
      .writeFileString(testPath, testTemplate(slug, exportName))
      .pipe(Effect.mapError(ioFail(c.folder, testPath)));
    written.push(testPath);
  });

/**
 * @spec.assume "the target folder either does not exist yet, is empty, or contains an `index.ts` (with at least one named export) without a SPEC.md"
 *   reason: lifecycle precondition; an existing barrel without named exports
 *           cannot be paired with a meaningful test stub and InitError surfaces
 *           the missing precondition.
 * @spec.guarantee "writes are per-file via the FileSystem service; an already-present index.ts is preserved untouched and the test stub imports its first named export instead of the scaffold's `placeholder`"
 *   reason: side-effect contract; init must never overwrite existing work and
 *           must never emit a stub that references a symbol the barrel does not export.
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
    const indexWasWritten = yield* writeIndexIfMissing(ctx, written);
    const exportName = yield* resolveStubExport(ctx, indexWasWritten);
    yield* writeTestStub(ctx, exportName, written);
    return { folder, filesCreated: written };
  }).pipe(Effect.withSpan("commands/init"));
