/**
 * Typed error hierarchy for PromptProof.
 *
 * A single base class lets callers `catch (e) { if (e instanceof PromptProofError) ... }`
 * to distinguish *our* well-formed, user-actionable errors from unexpected runtime crashes.
 */

export class PromptProofError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptProofError";
    // Restore prototype chain when compiled down for older targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when a suite file cannot be read, parsed, or fails schema validation. */
export class ConfigError extends PromptProofError {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/** Thrown when a provider is missing, misconfigured, or fails to produce output. */
export class ProviderError extends PromptProofError {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Thrown when an assertion type is unknown or its config is invalid. */
export class AssertionConfigError extends PromptProofError {
  constructor(message: string) {
    super(message);
    this.name = "AssertionConfigError";
  }
}
