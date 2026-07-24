/**
 * Capability registries.
 *
 * The registry is the seam that separates Free from paid tiers. The core wires in
 * only Free capabilities; paid modules call `register*` from the outside to add
 * their own. Because the core never imports paid modules, the Free build compiles
 * and ships standalone.
 */

import { AssertionConfigError, ProviderError, PromptProofError } from "./errors.js";
import type { Assertion, Provider, ProviderFactory, Reporter } from "./types.js";

/** Generic name->value store with a helpful "did you register it?" miss message. */
class NamedRegistry<T> {
  private readonly entries = new Map<string, T>();

  constructor(private readonly kind: string) {}

  register(name: string, value: T, { override = false } = {}): void {
    const key = name.toLowerCase();
    if (!override && this.entries.has(key)) {
      throw new PromptProofError(
        `${this.kind} '${name}' is already registered. Pass { override: true } to replace it.`,
      );
    }
    this.entries.set(key, value);
  }

  get(name: string): T | undefined {
    return this.entries.get(name.toLowerCase());
  }

  has(name: string): boolean {
    return this.entries.has(name.toLowerCase());
  }

  names(): string[] {
    return [...this.entries.keys()].sort();
  }
}

export class Registries {
  readonly providers = new NamedRegistry<ProviderFactory>("provider");
  readonly assertions = new NamedRegistry<Assertion>("assertion");
  readonly reporters = new NamedRegistry<Reporter>("reporter");

  /** Build a configured provider instance, or throw a clear error listing what's available. */
  createProvider(name: string, config: unknown): Provider {
    const factory = this.providers.get(name);
    if (!factory) {
      throw new ProviderError(
        `Unknown provider '${name}'. Registered providers: ${this.providers.names().join(", ") || "(none)"}. ` +
          `Real LLM providers (openai, anthropic) require the Premium module.`,
      );
    }
    return factory(config);
  }

  /** Sorted list of registered provider names (for CLI `--list`). */
  listProviders(): string[] {
    return this.providers.names();
  }

  /** Sorted list of registered assertion types (for CLI `--list`). */
  listAssertions(): string[] {
    return this.assertions.names();
  }

  /** Sorted list of registered reporter names (for CLI `--list`). */
  listReporters(): string[] {
    return this.reporters.names();
  }

  /** Look up an assertion by type, or throw listing what's available. */
  getAssertion(type: string): Assertion {
    const assertion = this.assertions.get(type);
    if (!assertion) {
      throw new AssertionConfigError(
        `Unknown assertion type '${type}'. Registered types: ${this.assertions.names().join(", ") || "(none)"}. ` +
          `Advanced assertions (similarity, llm-judge) require the Premium module.`,
      );
    }
    return assertion;
  }
}
