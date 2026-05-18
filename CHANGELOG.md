# Changelog

## 0.2.0

### Breaking

- Per-folder artifact filename renamed from `SPEC.md` to `MODULE.md`. The
  generator writes `<folder>/MODULE.md` (previously `<folder>/SPEC.md`), the
  drift check reads `<folder>/MODULE.md`, and cross-folder backticked symbol
  links resolve to `../<folder>/MODULE.md` anchors. The rename disambiguates
  the per-folder artifact from the `/safer:contract` skill in
  `chughtapan/safer-by-default`; both surfaces previously read as "spec" and
  collided in agent prompts.

  Adopters with committed `SPEC.md` files: rename them to `MODULE.md` in
  the same commit that bumps the dep, then run `pnpm safer-spec generate
  --write` once to refresh the relative links inside (`../<folder>/SPEC.md`
  → `../<folder>/MODULE.md`).

  No transitional dual-read shim ships. Per project doctrine, back-compat is
  not the default; the new shape is the only shape.

### Deferred

- npm publish of `@chughtapan/safer-spec-development@0.2.0` is deferred to
  the safer-by-default v0.2.0 cleanup follow-up. v0.2.0 is consumed via git
  submodule from safer-by-default in this release window; the published
  package lags until the cleanup orchestration runs.
