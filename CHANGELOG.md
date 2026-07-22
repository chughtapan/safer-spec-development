# Changelog

## 0.3.0

### Added

- `excludeRootPrefixes` config key in `safer-spec.config.json`. Root-relative
  POSIX path prefixes listed here are removed from both source collection and
  folder discovery, so independent vendored or generated trees that own their
  own safer-spec configuration stay out of the current project's graph.
  Matching is path-segment aware (`vendor` excludes `vendor` and `vendor/**`,
  not `vendor-tools`); empty, absolute, drive-letter, backslash, NUL, `.`, and
  `..` entries are rejected at config load with a `ConfigError`.

### Changed

- Validate now precomputes the project-wide export-name set once at the command
  boundary (`buildKnownExports`) and threads it through `inspectFolder` instead
  of rebuilding it per folder, matching the generate path. Removes the
  per-folder `collectKnownExports` re-scan.
- The CLI `--version` flag now reports the package version read from
  `package.json` rather than the internal `SPEC_FORMAT_VERSION`.

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
