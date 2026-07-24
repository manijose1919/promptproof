/**
 * PromptProof public API (Free tier).
 *
 * `createFreeRegistries()` wires the standalone Free product: replay provider,
 * the four Free assertions, and the console + junit reporters. Paid modules
 * (Premium/Pro) extend the *same* registries via their own `register*` calls —
 * the core never imports them, which is what keeps the Free build shippable alone.
 */

import { Registries } from "./core/registry.js";
import { replayProviderFactory, REPLAY_PROVIDER_NAME } from "./providers/replay.js";
import { registerFreeAssertions } from "./assertions/index.js";
import { registerFreeReporters } from "./reporters/index.js";

export function createFreeRegistries(): Registries {
  const registries = new Registries();
  registries.providers.register(REPLAY_PROVIDER_NAME, replayProviderFactory, { override: true });
  registerFreeAssertions(registries);
  registerFreeReporters(registries);
  return registries;
}

// ── Re-exports for programmatic consumers ─────────────────────────────────
export { Registries } from "./core/registry.js";
export { runSuite } from "./core/runner.js";
export type { RunOptions } from "./core/runner.js";
export { parseSuite, loadSuiteFromFile } from "./core/config.js";
export {
  PromptProofError,
  ConfigError,
  ProviderError,
  AssertionConfigError,
} from "./core/errors.js";
export * from "./core/types.js";
export { registerFreeAssertions } from "./assertions/index.js";
export { registerFreeReporters } from "./reporters/index.js";
export { replayProviderFactory, REPLAY_PROVIDER_NAME } from "./providers/replay.js";
