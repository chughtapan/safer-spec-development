/**
 * @spec.purpose Vitest configuration. Mirrors the tsconfig `paths` map so
 *   `@safer/*` aliases resolve identically at type-check time, vitest run
 *   time, and Node runtime (where `tsc-alias` rewrites them to relative
 *   paths in dist during build).
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@safer\/kinds\/(.+)\.js$/, replacement: resolve(here, "src/kinds/$1.ts") },
      { find: /^@safer\/authoring\/(.+)\.js$/, replacement: resolve(here, "src/authoring/$1.ts") },
      { find: /^@safer\/spec\/(.+)\.js$/, replacement: resolve(here, "src/spec/$1.ts") },
      { find: /^@safer\/source\/(.+)\.js$/, replacement: resolve(here, "src/source/$1.ts") },
      { find: /^@safer\/sidecar\/(.+)\.js$/, replacement: resolve(here, "src/sidecar/$1.ts") },
      { find: /^@safer\/modes\/(.+)\.js$/, replacement: resolve(here, "src/modes/$1.ts") },
      { find: /^@safer\/cli\/(.+)\.js$/, replacement: resolve(here, "src/cli/$1.ts") },
    ],
  },
});
