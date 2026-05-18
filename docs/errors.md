# Errors

`safer-spec validate` emits one of four tagged errors. Each maps to a stable POSIX exit code. The CLI prints the diagnostic body to stderr and exits with the code; downstream automation routes on the code.

## `no-folders-resolved`

**Exit code:** 1
**Tag:** `NoFoldersResolvedError`
**Routes to:** the user invoking `safer-spec`

The validate run requested a folder (via `--folder X`) that did not resolve to any folder containing `index.ts`, or the default discovery (`src/*/`) found zero folders containing `index.ts`.

### Fix

- If you specified `--folder X`: check the path. Common typos are extra `./`, trailing `/`, or wrong casing. Try `ls X/index.ts` to confirm the barrel exists.
- If you ran `safer-spec validate` with no `--folder`: pass `--folder <path>` explicitly. The default discovery scans `src/*/` for `index.ts` barrels; projects with specs elsewhere (e.g. `packages/identity`) must pass the folder explicitly.

### Why this fails the gate

The gate's purpose is to validate every spec-emitting folder. Silently accepting "0 folders" would let CI pass on projects that lost their specs or moved them.

## `missing-spec-property`

**Exit code:** 11
**Tag:** `MissingSpecPropertyError`
**Routes to:** the spec author (the test JSDoc, or the committed `MODULE.md`)

The committed `MODULE.md` or `.safer-spec/<slug>.json` sidecar drifted from what `safer-spec generate` would emit right now. Either:

- A source `@spec.*` directive was added, removed, or edited and the artifact wasn't regenerated.
- A test JSDoc `@spec.property` / `@spec.type` / `@spec.exports` / `@spec.claim` value disagrees with the runtime `itSpec` argument.
- An `itSpec` call's runtime `opts.exports` is empty or omitted.
- An `@spec.skip` was added or removed and the MODULE.md `## Public Surface` section wasn't regenerated.

### Fix

```
pnpm safer-spec generate --write
git add -A && git commit
```

Then re-run `safer-spec validate --planned`. If the cross-check diagnostic names a JSDoc-vs-runtime mismatch, edit either the JSDoc or the `itSpec` call so they agree, then regenerate.

## `missing-stub`

**Exit code:** 12
**Tag:** `MissingStubError`
**Routes to:** the architect / test author

An `itSpec.todo` or `itSpec.prop` call site is missing one or more of the four required per-test directives: `@spec.property`, `@spec.type`, `@spec.exports`, `@spec.claim`.

### Fix

Add the missing directive(s) immediately above the `itSpec` call:

```ts
/**
 * @spec.property frontmatter-rejects-malformed
 * @spec.type Exception Raising
 * @spec.exports decodeSpecFrontmatter
 * @spec.claim malformed YAML fails on the Effect error channel
 */
itSpec.todo("frontmatter-rejects-malformed", {
  type: "Exception Raising",
  exports: [decodeSpecFrontmatter],
});
```

All four directives are required. The JSDoc values must match the `itSpec` runtime arguments (see `missing-spec-property` above).

## `missing-impl`

**Exit code:** 13
**Tag:** `MissingImplError`
**Routes to:** the implementer

A property is still a placeholder. Either:

- An `itSpec.todo(...)` call exists (and the run is `--implemented`, not `--planned`).
- An `itSpec.prop(...)` call has a trivially-empty body (e.g., `() => {}`, `() => undefined`, `Effect.die(...)`).
- Per-folder coverage thresholds (`typeCoverage`, `preconditionPassRate`, `branchCoverageFromSpecTests`) are below the configured floor.
- `branchCoverageFromSpecTests` is gated and `coverage/coverage-summary.json` is missing, stale, or has incomplete entries for the folder's source files.

### Fix

Promote `itSpec.todo` to `itSpec.prop` with a real fast-check arbitrary and assertion body:

```ts
itSpec.prop(
  "frontmatter-rejects-malformed",
  { type: "Exception Raising", exports: [decodeSpecFrontmatter] },
  fc.string(),
  (input) => {
    // assertions go here
  },
);
```

For coverage-threshold failures, the diagnostic names which property types lack tests. Add `itSpec.prop` calls covering those types, or declare `@spec.skip "<PropertyType>" reason: <why>` on the export to opt out explicitly.

## Coverage-threshold tuning

Default thresholds: `typeCoverage: 0.4`, `preconditionPassRate: 0`, `branchCoverageFromSpecTests: 0.75`. Projects raise or lower them via `safer-spec.config.json`:

```json
{
  "defaultThresholds": { "typeCoverage": 0.5, "branchCoverageFromSpecTests": 0.8 },
  "folderOverrides": {
    "src/commands": { "branchCoverageFromSpecTests": 0 }
  }
}
```

The validate gate compares the per-folder computed coverage against the resolved threshold (folder override > defaultThresholds > 0). Non-zero thresholds gate on shortfall; setting a threshold to `0` disables that gate for the folder. Use folder overrides for legitimate exceptions — e.g., cli entry-point files that nothing tests directly.
