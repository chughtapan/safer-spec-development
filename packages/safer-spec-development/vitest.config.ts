/**
 * @spec.purpose Vitest configuration. Wires the tsconfig `paths` map into
 *   vitest's resolver via `vite-tsconfig-paths`-equivalent inline plugin so
 *   `#kinds/*`, `#spec/*` and the other Node-ESM-style internal paths
 *   resolve identically at type-check time, vitest run time, and Node
 *   runtime (where `package.json` `imports` map handles them).
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^#kinds\/(.+)\.js$/, replacement: resolve(here, "src/kinds/$1.ts") },
      { find: /^#authoring\/(.+)\.js$/, replacement: resolve(here, "src/authoring/$1.ts") },
      { find: /^#spec\/(.+)\.js$/, replacement: resolve(here, "src/spec/$1.ts") },
      { find: /^#source\/(.+)\.js$/, replacement: resolve(here, "src/source/$1.ts") },
      { find: /^#sidecar\/(.+)\.js$/, replacement: resolve(here, "src/sidecar/$1.ts") },
      { find: /^#modes\/(.+)\.js$/, replacement: resolve(here, "src/modes/$1.ts") },
      { find: /^#cli\/(.+)\.js$/, replacement: resolve(here, "src/cli/$1.ts") },
    ],
  },
});
