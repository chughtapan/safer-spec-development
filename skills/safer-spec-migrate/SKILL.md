---
name: safer-spec-migrate
description: Walk committed `SPEC.md` + sidecar files for safer-spec format-version transitions. Emit a per-file diff for human review; idempotent — running twice on already-migrated files is a no-op. Use this when CHANGELOG signposts a `SPEC_FORMAT_VERSION` bump and your repo's committed files still carry the old version.
---

# safer-spec-migrate

You are migrating a project's committed safer-spec artifacts (`SPEC.md`, `.safer-spec/<slug>.json`) from one `SPEC_FORMAT_VERSION` to another. `generate` and `validate` are CLI commands; `migrate` is a SKILL because the diff between format versions involves judgment (which fields to drop, how to merge new sections, what to flag for the human) that a coding agent does more reliably than a versioned codegen path baked into the CLI.

## Inputs

- **`fromVersion`** — read from the on-disk files. The two artifact kinds use DIFFERENT keys:
  - `SPEC.md` YAML frontmatter: `format-version:` (dashed).
  - `.safer-spec/<slug>.json` sidecar: `"formatVersion"` (camelCase).
  Confirm at least one of each kind to make sure they agree.
- **`toVersion`** — the version the currently-installed CLI emits. Run `pnpm safer-spec --version` (or `npx safer-spec --version`) to read it directly from the installed binary — that's the canonical source. Do NOT read `src/commands/version.ts`; the npm package ships `dist/**` and `skills/**` only, so that path won't exist for adopters.
- **`dryRun`** — default true. When dry-run, do not write to the working tree; produce a unified diff per file in a tmpdir and ask the user to confirm before re-running with `dryRun: false`.

If `fromVersion === toVersion` for every file, nothing to migrate. Report cleanly and exit.

## What to read first

1. **`CHANGELOG.md`** between `fromVersion` and `toVersion` — the format-version section lists the structural changes (e.g., "0.3 → 0.4: drop `purpose:` frontmatter; rename `Public surface` to `Exports`; add `## Children` section").
2. **One representative on-disk `SPEC.md`** — confirm its frontmatter `format-version:` value matches `fromVersion`.
3. **One representative `.safer-spec/<slug>.json` sidecar** — confirm its `"formatVersion"` value matches the same `fromVersion`. If the two artifact kinds disagree, STOP and report the discrepancy; a partial-migration state needs human triage.
4. **The source files the SPEC was generated from** — `src/<folder>/index.ts`, `src/<folder>/__tests__/<slug>.spec.test.ts`. The migration MUST preserve every fact those files declare; only the rendering changes.

## The migration loop

For each tracked `SPEC.md` (use `git ls-files '**/SPEC.md' '**/*.json'` scoped to `.safer-spec/`):

1. Parse the on-disk file's version: `format-version:` for SPEC.md, `"formatVersion"` for sidecar JSON. If the value equals `toVersion`, skip (already migrated — idempotent).
2. If the value equals `fromVersion`, regenerate. **The regeneration step branches on `dryRun`:**
   - **`dryRun: true`** (the default): `cp -r` the entire repo to a tmpdir, run `pnpm safer-spec generate --folder <folder> --write` THERE, then `diff -ur <project>/<folder> <tmpdir>/<folder>` to show the user the proposed change. The working tree is never touched.
   - **`dryRun: false`**: run `pnpm safer-spec generate --folder <folder> --write` against the project directly. The codemod's emitter is the canonical source-of-truth for `toVersion`'s shape; do not hand-edit the markdown.
3. If neither version matches, FLAG the file. Don't touch it. Tell the user which file is at which version and ask whether to backstop with a separate migration pass or hand-edit.

After all folders are regenerated (or dry-run-regenerated):

4. Run `pnpm safer-spec validate --planned` (against the regenerated location — tmpdir for dry-run, project tree for the real run) to check that every regenerated SPEC.md + sidecar passes the drift cross-check.
5. If `validate` reports a gap, STOP. The gap means the regeneration produced bytes that don't match what the source files imply — usually a JSDoc directive that needs updating, not a migration bug. Tell the user the diagnostic verbatim.

## Producing the diff

For `dryRun: true`, the diff comes from step 2's `diff -ur` of tmpdir vs project. Show the user. Ask:

- "Looks right? Re-run with `dryRun: false` to apply against the project."
- "Anything surprising?" — flag drift that you can't explain from the CHANGELOG.

For `dryRun: false`, run `git diff -- '**/SPEC.md' '**/*.json'` after the regeneration to see what the write produced. Same questions; commit with `git add -p` to stage selectively.

## Refusals

Refuse to migrate (do NOT regenerate anything) when:

1. The working tree has uncommitted changes to `SPEC.md` or `.safer-spec/` files. Migration must start from a clean checkpoint so the diff is purely the migration's doing.
2. `CHANGELOG.md` has no section describing the `fromVersion` → `toVersion` transition. You'd be guessing at the shape change.
3. The on-disk `formatVersion:` doesn't match `fromVersion` for any inspected file (and isn't already `toVersion`). Probably the user meant a different `fromVersion`.

Each refusal is a STOP — tell the user the specific reason and what they need to fix before re-running.

## Why this is a skill, not a CLI command

A versioned migration table baked into the CLI would have to grow with every format-version bump. The committed `SPEC.md` shape is already what `generate` emits at the current `SPEC_FORMAT_VERSION`; migration reduces to "regenerate then diff." The judgment lives in (a) reading the CHANGELOG to know what changed, (b) deciding when an unexpected diff is a migration bug vs. real source drift, and (c) deciding whether to ask the user for confirmation. All three are agent work. The CLI keeps the regen path; the agent owns the migration loop.

The original `migrate` stub lived in `src/commands/migrate.ts`. It never had a real implementation — keeping it as `Effect.die("Not implemented: migrate")` for hypothetical future bumps would have meant carrying the wrong-shaped abstraction. Removed in favor of this skill.
