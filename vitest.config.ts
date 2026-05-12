/**
 * @spec.purpose Vitest configuration. Reads `paths` from tsconfig.json via
 *   `vite-tsconfig-paths` so the alias map is single-sourced — adding or
 *   renaming a domain only requires editing tsconfig.json's `paths` entry,
 *   not duplicating the change here AND in tsc-alias's read of the same
 *   tsconfig.
 *
 *   Registers `SaferSpecExecutionReporter` alongside Vitest's default
 *   reporter so each test run emits per-folder execution sidecars that
 *   `safer-spec validate --implemented` consumes.
 */

import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
// eslint-disable-next-line import/no-relative-parent-imports -- vitest evaluates this config before its own tsconfigPaths plugin is wired, so the alias cannot resolve here; this is the only file in the repo that must reach into `src/` by relative path
import { SaferSpecExecutionReporter } from "./src/spec/reporter.ts";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      ".claude/worktrees/**",
    ],
    reporters: ["default", new SaferSpecExecutionReporter()],
  },
});
