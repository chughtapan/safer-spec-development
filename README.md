# @chughtapan/safer-spec-development

Per-folder `SPEC.md` codemod for TypeScript codebases. Generates structured specs from source + JSDoc directives + Effect Schema + fast-check property tests. Validates type-coverage, precondition-pass-rate, and branch-coverage-from-spec-tests as hard CI gates.

**Status: early package.** Public contracts, CLI surface, and property metadata
are defined; mode implementations may still be incomplete.

## Quickstart

```bash
pnpm add -D @chughtapan/safer-spec-development
# Onboard the first folder via the safer-spec-init coding-agent skill (see below).
pnpm safer-spec generate                       # regenerate SPEC.md per folder
pnpm test                                      # property tests; reporter writes execution sidecars
pnpm safer-spec validate --implemented         # CI gate (consumes execution sidecars)
```

### Vitest reporter

`validate --implemented` reads per-folder `.safer-spec/<slug>.execution.json`
files written by the package's Vitest reporter. Register it in your
`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { SaferSpecExecutionReporter } from "@chughtapan/safer-spec-development/reporter";

export default defineConfig({
  test: {
    reporters: ["default", new SaferSpecExecutionReporter()],
  },
});
```

Import the reporter from the dedicated `/reporter` subpath, not the
package root. The root barrel pulls in `itSpec`, which transitively
imports `vitest`'s test API — Vitest forbids that from a config file
and will throw `Vitest failed to access its internal state`.

The reporter writes one sidecar per folder whose tests ran. Validate
compares the sidecar's property-id set against the folder's current
implemented properties so a stale sidecar (test set changed since the
last run) fails as `MissingImplError`.

## CLI surface

```
safer-spec generate [--folder X] [--write|--dry-run] [--watch]
safer-spec validate [--folder X] [--planned|--implemented]
safer-spec doctor                              health check
safer-spec explain <error-code>                error docs
safer-spec --version
safer-spec --help
```

## Skills (agent-driven flows)

Folder onboarding (`init`) and format-version migration (`migrate`) are not
CLI commands — they ship as coding-agent skills in [`skills/`](./skills/):

- [`skills/safer-spec-init`](./skills/safer-spec-init/SKILL.md) — scaffold a
  folder's first `SPEC.md` + property-test stub. The agent reads the
  existing `index.ts` (if any), picks the right runtime-named export to
  bind the stub against, and writes both files.
- [`skills/safer-spec-migrate`](./skills/safer-spec-migrate/SKILL.md) — walk
  committed SPEC artifacts for format-version transitions; produces a
  per-file diff for human review.

These flows depend on judgment (which export is value-bearing on a given
barrel; which format-version diffs need human eyes) that a regex /
ts-morph picker baked into the CLI handles unreliably — so they live as
SKILL docs a coding agent reads and executes.

See [`docs/DESIGN.md`](docs/DESIGN.md) for the architecture.
