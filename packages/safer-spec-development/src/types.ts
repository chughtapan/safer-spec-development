/**
 * @spec.purpose Type surface for the codemod's public API.
 *   Stage 0 — interface stubs; Stage 1 fills in.
 */

import type { Kind } from "./kinds.js";

export interface GenerateOptions {
  folder?: string;
  write?: boolean;
  dryRun?: boolean;
  watch?: boolean;
}

export interface ValidateOptions {
  folder?: string;
  mode: "planned" | "implemented";
  formatVersionCheck?: boolean;
}

export interface InitOptions {
  folder?: string;
}

export interface PropertyMeta {
  kind: Kind;
  exports: ReadonlyArray<unknown>;
}
