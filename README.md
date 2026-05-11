# @chughtapan/safer-spec-development

Per-folder `SPEC.md` codemod for TypeScript codebases. Generates structured specs from source + JSDoc directives + Effect Schema + fast-check property tests. Validates type-coverage, classifier-coverage, and precondition-pass-rate as hard CI gates.

**Status: early package.** Public contracts, CLI surface, and property metadata
are defined; mode implementations may still be incomplete.

## Quickstart

```bash
pnpm add -D @chughtapan/safer-spec-development
pnpm safer-spec init packages/identity        # scaffold first SPEC.md + property stub
pnpm safer-spec generate                       # regenerate SPEC.md per folder
pnpm safer-spec validate --implemented         # CI gate
```

## CLI surface

```
safer-spec init [folder]                       scaffold first SPEC.md + config
safer-spec generate [--folder X] [--write|--dry-run] [--watch]
safer-spec validate [--folder X] [--planned|--implemented]
safer-spec doctor                              health check
safer-spec explain <error-code>                error docs
safer-spec migrate                             apply format-version transitions
safer-spec --version
safer-spec --help
```

See [`docs/DESIGN.md`](docs/DESIGN.md) for the architecture.
