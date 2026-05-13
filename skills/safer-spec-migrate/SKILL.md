---
name: safer-spec-migrate
description: Walk committed `SPEC.md` + sidecar files for safer-spec format-version transitions. Emit a per-file diff for human review; idempotent — running twice on already-migrated files is a no-op. Use this when CHANGELOG signposts a `SPEC_FORMAT_VERSION` bump and your repo's committed files still carry the old version.
---

# safer-spec-migrate

You are migrating a project's committed safer-spec artifacts (`SPEC.md`, `.safer-spec/<slug>.json`) from one `SPEC_FORMAT_VERSION` to another. `generate` and `validate` are CLI commands; `migrate` is a SKILL because the diff between format versions involves judgment (which fields to drop, how to merge new sections, what to flag for the human) that a coding agent does more reliably than a versioned codegen path baked into the CLI.

## Inputs

- **`fromVersion`** — usually the version embedded in the on-disk files' `formatVersion:` frontmatter. Read one to confirm.
- **`toVersion`** — the current `SPEC_FORMAT_VERSION` constant (in `src/commands/version.ts`), or whichever target the CHANGELOG signposts.
- **`dryRun`** — default true. When dry-run, do not write; produce a unified diff per file and ask the user to confirm before re-running with `dryRun: false`.

If `fromVersion === toVersion` for every file, nothing to migrate. Report cleanly and exit.

## What to read first

1. **`CHANGELOG.md`** between `fromVersion` and `toVersion` — the format-version section lists the structural changes (e.g., "0.3 → 0.4: drop `purpose:` frontmatter; rename `Public surface` to `Exports`; add `## Children` section").
2. **One representative on-disk `SPEC.md`** — confirm its frontmatter `formatVersion:` matches `fromVersion`.
3. **The source files the SPEC was generated from** — `src/<folder>/index.ts`, `src/<folder>/__tests__/<slug>.spec.test.ts`. The migration MUST preserve every fact those files declare; only the rendering changes.

## The migration loop

For each tracked `SPEC.md` (use `git ls-files '**/SPEC.md' '**/*.json'` scoped to `.safer-spec/`):

1. Parse the on-disk file's frontmatter. If `formatVersion: <toVersion>`, skip (already migrated — idempotent).
2. If `formatVersion: <fromVersion>`, apply the CHANGELOG-listed structural changes by REGENERATING the file from source via `pnpm safer-spec generate --folder <folder> --write`. The codemod's emitter is the canonical source-of-truth for the current `toVersion`'s shape; you do not hand-edit the markdown.
3. If neither version matches, FLAG the file. Don't touch it. Tell the user which file is at which version and ask whether to backstop with a separate migration pass or hand-edit.

After all folders are regenerated:

4. Run `pnpm safer-spec validate --planned` to check that every regenerated SPEC.md + sidecar passes the drift cross-check.
5. If `validate` reports a gap, STOP. The gap means the regeneration produced bytes that don't match what the source files imply — usually a JSDoc directive that needs updating, not a migration bug. Tell the user the diagnostic verbatim.

## Producing the diff

Run `git diff -- '**/SPEC.md' '**/*.json'` after step 2's regeneration. Show the user the diff. Ask:

- "Looks right? Apply with `git add -p` to stage, then commit."
- "Anything surprising?" — flag drift that you can't explain from the CHANGELOG.

When `dryRun: true`, regenerate to a tmpdir instead and diff against the on-disk copies — never modify the working tree without confirmation.

## Refusals

Refuse to migrate (do NOT regenerate anything) when:

1. The working tree has uncommitted changes to `SPEC.md` or `.safer-spec/` files. Migration must start from a clean checkpoint so the diff is purely the migration's doing.
2. `CHANGELOG.md` has no section describing the `fromVersion` → `toVersion` transition. You'd be guessing at the shape change.
3. The on-disk `formatVersion:` doesn't match `fromVersion` for any inspected file (and isn't already `toVersion`). Probably the user meant a different `fromVersion`.

Each refusal is a STOP — tell the user the specific reason and what they need to fix before re-running.

## Why this is a skill, not a CLI command

A versioned migration table baked into the CLI would have to grow with every format-version bump. The committed `SPEC.md` shape is already what `generate` emits at the current `SPEC_FORMAT_VERSION`; migration reduces to "regenerate then diff." The judgment lives in (a) reading the CHANGELOG to know what changed, (b) deciding when an unexpected diff is a migration bug vs. real source drift, and (c) deciding whether to ask the user for confirmation. All three are agent work. The CLI keeps the regen path; the agent owns the migration loop.

The original `migrate` stub lived in `src/commands/migrate.ts`. It never had a real implementation — keeping it as `Effect.die("Not implemented: migrate")` for hypothetical future bumps would have meant carrying the wrong-shaped abstraction. Removed in favor of this skill.
