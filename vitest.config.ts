/**
 * @spec.purpose Vitest configuration. Reads `paths` from tsconfig.json via
 *   `vite-tsconfig-paths` so the alias map is single-sourced — adding or
 *   renaming a domain only requires editing tsconfig.json's `paths` entry,
 *   not duplicating the change here AND in tsc-alias's read of the same
 *   tsconfig.
 */

import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      ".claude/worktrees/**",
    ],
  },
});
