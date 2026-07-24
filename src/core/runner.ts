/**
 * Test runner — the orchestration core.
 *
 * For each case it: resolves the provider, requests a completion, runs every
 * assertion, and records a verdict. A failure in one case (provider error,
 * assertion-config error) is isolated to that case so the whole suite still
 * produces a complete report — essential for CI trust.
 */

import { ProviderError } from "./errors.js";
import type { Registries } from "./registry.js";
import type {
  AssertionOutcome,
  CaseSpec,
  CaseVerdict,
  Provider,
  ProviderRequest,
  SuiteSpec,
  SuiteVerdict,
} from "./types.js";

export interface RunOptions {
  /** Provider name used when neither the case nor the suite specifies one. */
  defaultProvider?: string;
  /** Injectable clock for deterministic duration in tests. */
  now?: () => number;
  /**
   * Per-case provider timeout in milliseconds. A provider that does not resolve
   * within this window fails the case instead of hanging the whole run. Set 0 to
   * disable (not recommended in CI). Default: 30000.
   */
  timeoutMs?: number;
}

const DEFAULT_PROVIDER = "replay";
const DEFAULT_TIMEOUT_MS = 30_000;

/** Reject if `promise` does not settle within `ms`. `ms <= 0` disables the guard. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  if (ms <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ProviderError(`${label} timed out after ${ms}ms`));
    }, ms);
    // Don't keep the event loop alive solely for this timer.
    if (typeof timer.unref === "function") timer.unref();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

export async function runSuite(
  suite: SuiteSpec,
  registries: Registries,
  options: RunOptions = {},
): Promise<SuiteVerdict> {
  const now = options.now ?? (() => Date.now());
  const fallbackProvider = options.defaultProvider ?? DEFAULT_PROVIDER;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const started = now();

  // Build each referenced provider once, lazily, and cache by name.
  const providerCache = new Map<string, Provider>();
  const providerConfigs = suite.providers ?? {};
  const getProvider = (name: string): Provider => {
    let provider = providerCache.get(name);
    if (!provider) {
      provider = registries.createProvider(name, providerConfigs[name]);
      providerCache.set(name, provider);
    }
    return provider;
  };

  const caseVerdicts: CaseVerdict[] = [];
  for (const testCase of suite.cases) {
    caseVerdicts.push(
      await runCase(testCase, suite, getProvider, fallbackProvider, registries, now, timeoutMs),
    );
  }

  const passed = caseVerdicts.filter((c) => c.pass).length;
  const failed = caseVerdicts.length - passed;

  return {
    name: suite.name,
    pass: failed === 0,
    total: caseVerdicts.length,
    passed,
    failed,
    cases: caseVerdicts,
    durationMs: now() - started,
  };
}

async function runCase(
  testCase: CaseSpec,
  suite: SuiteSpec,
  getProvider: (name: string) => Provider,
  fallbackProvider: string,
  registries: Registries,
  now: () => number,
  timeoutMs: number,
): Promise<CaseVerdict> {
  const providerName = testCase.provider ?? suite.provider ?? fallbackProvider;

  // 1. Get completion (isolated — provider/config errors fail just this case).
  let output: string;
  let latencyMs: number | undefined;
  try {
    const provider = getProvider(providerName);
    const request: ProviderRequest = {
      key: testCase.name,
      messages: testCase.messages,
      model: testCase.model ?? suite.model,
      temperature: testCase.temperature,
      maxTokens: testCase.maxTokens,
    };
    const t0 = now();
    const response = await withTimeout(
      provider.complete(request),
      timeoutMs,
      `provider '${providerName}' for case '${testCase.name}'`,
    );
    latencyMs = response.latencyMs ?? now() - t0;
    output = response.output;
  } catch (err) {
    return {
      name: testCase.name,
      pass: false,
      output: "",
      assertions: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // 2. Run assertions (each isolated — one throwing marks that assertion failed).
  const outcomes: AssertionOutcome[] = [];
  for (const spec of testCase.assert) {
    outcomes.push(await runAssertion(spec, output, testCase.name, registries));
  }

  const pass = outcomes.every((o) => o.pass);
  const verdict: CaseVerdict = {
    name: testCase.name,
    pass,
    output,
    assertions: outcomes,
  };
  if (latencyMs !== undefined) verdict.latencyMs = latencyMs;
  return verdict;
}

async function runAssertion(
  spec: { type: string; [k: string]: unknown },
  output: string,
  caseName: string,
  registries: Registries,
): Promise<AssertionOutcome> {
  try {
    const assertion = registries.getAssertion(spec.type);
    const result = await assertion.evaluate({ output, caseName }, spec);
    const outcome: AssertionOutcome = {
      type: spec.type,
      pass: result.pass,
      message: result.message,
    };
    if (result.score !== undefined) outcome.score = result.score;
    return outcome;
  } catch (err) {
    // An unknown type or invalid assertion config is a failed assertion, not a crash.
    return {
      type: spec.type,
      pass: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

// Re-export for consumers that catch provider errors specifically.
export { ProviderError };
