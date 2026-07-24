/**
 * Core domain model for PromptProof.
 *
 * These interfaces are the stable contract that the runner, registries, providers,
 * assertions, reporters, and all paid modules implement against. Keep them narrow.
 */

/* ────────────────────────────── Prompt I/O ────────────────────────────── */

export type Role = "system" | "user" | "assistant";

export interface PromptMessage {
  role: Role;
  content: string;
}

/**
 * A single request handed to a Provider. `key` is stamped by the runner with the
 * case name so deterministic providers (e.g. replay) can perform a pure lookup.
 */
export interface ProviderRequest {
  key: string;
  messages: PromptMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderUsage {
  promptTokens?: number;
  completionTokens?: number;
}

export interface ProviderResponse {
  output: string;
  model?: string;
  usage?: ProviderUsage;
  latencyMs?: number;
  /** Original vendor payload, for debugging. Never relied upon by the core. */
  raw?: unknown;
}

/**
 * A Provider turns a request into a completion. Implementations may be offline
 * (replay/mock) or call a real LLM vendor (Premium).
 */
export interface Provider {
  readonly name: string;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
}

/** A factory builds a configured Provider instance from suite-supplied config. */
export type ProviderFactory = (config: unknown) => Provider;

/* ────────────────────────────── Assertions ────────────────────────────── */

export interface AssertionContext {
  /** The provider output under test. */
  output: string;
  /** Name of the case, for error messages. */
  caseName: string;
}

export interface AssertionResult {
  pass: boolean;
  /** Human-readable explanation of the outcome. */
  message: string;
  /** Optional numeric score in [0,1] for eval-style assertions. */
  score?: number;
}

/**
 * An Assertion validates provider output against a spec. `config` is the raw
 * per-case assertion object from YAML; each assertion validates its own shape.
 */
export interface Assertion {
  readonly type: string;
  evaluate(
    ctx: AssertionContext,
    config: unknown,
  ): AssertionResult | Promise<AssertionResult>;
}

/* ────────────────────────────── Suite specs ───────────────────────────── */

/** A raw assertion entry from YAML: `{ type, ...assertion-specific }`. */
export interface AssertionSpec {
  type: string;
  [key: string]: unknown;
}

export interface CaseSpec {
  name: string;
  messages: PromptMessage[];
  /** Override the suite-level provider for this case. */
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  assert: AssertionSpec[];
}

export interface SuiteSpec {
  name: string;
  /** Default provider name for cases that don't specify one. */
  provider?: string;
  model?: string;
  /** Provider-name -> provider-specific config, passed to the ProviderFactory. */
  providers?: Record<string, unknown>;
  cases: CaseSpec[];
}

/* ────────────────────────────── Verdicts ──────────────────────────────── */

export interface AssertionOutcome {
  type: string;
  pass: boolean;
  message: string;
  score?: number;
}

export interface CaseVerdict {
  name: string;
  pass: boolean;
  output: string;
  assertions: AssertionOutcome[];
  latencyMs?: number;
  /** Set when the case aborted (provider threw, config invalid, etc.). */
  error?: string;
}

export interface SuiteVerdict {
  name: string;
  pass: boolean;
  total: number;
  passed: number;
  failed: number;
  cases: CaseVerdict[];
  durationMs: number;
}

/* ────────────────────────────── Reporters ─────────────────────────────── */

/**
 * A Reporter renders a verdict to a string. It performs no I/O itself — the CLI
 * decides whether to print to stdout or write to a file. This keeps reporters
 * pure and trivially unit-testable.
 */
export interface Reporter {
  readonly name: string;
  render(verdict: SuiteVerdict): string;
}
