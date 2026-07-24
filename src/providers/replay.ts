/**
 * Replay provider (Free tier) — deterministic, offline completions.
 *
 * This is the keystone of PromptProof's Free tier: it lets teams record real LLM
 * outputs once and replay them forever in CI with zero API cost and zero flakiness.
 * It looks up responses by the request `key` (the case name, stamped by the runner).
 *
 * Config shape (from the suite's `providers.replay` block):
 *   {
 *     responses: { "<case name>": "<output>", ... },
 *     strict?: boolean,   // default true: throw on a missing key
 *     fallback?: string   // used when strict=false and key is absent
 *   }
 */

import { z } from "zod";
import { ProviderError } from "../core/errors.js";
import type { Provider, ProviderFactory, ProviderRequest, ProviderResponse } from "../core/types.js";

const replayConfigSchema = z.object({
  responses: z.record(z.string(), z.string()).default({}),
  strict: z.boolean().default(true),
  fallback: z.string().optional(),
});

export const REPLAY_PROVIDER_NAME = "replay";

class ReplayProvider implements Provider {
  readonly name = REPLAY_PROVIDER_NAME;

  constructor(
    private readonly responses: Record<string, string>,
    private readonly strict: boolean,
    private readonly fallback: string | undefined,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const hit = Object.prototype.hasOwnProperty.call(this.responses, request.key)
      ? this.responses[request.key]
      : undefined;

    if (hit !== undefined) {
      return { output: hit, model: "replay", latencyMs: 0 };
    }

    if (this.strict) {
      const known = Object.keys(this.responses);
      throw new ProviderError(
        `Replay provider has no recorded response for case '${request.key}'. ` +
          `Recorded keys: ${known.length ? known.map((k) => `'${k}'`).join(", ") : "(none)"}. ` +
          `Add it under providers.replay.responses, or set providers.replay.strict: false.`,
      );
    }

    if (this.fallback !== undefined) {
      return { output: this.fallback, model: "replay", latencyMs: 0 };
    }

    return { output: "", model: "replay", latencyMs: 0 };
  }
}

/** Factory registered into the provider registry by the core. */
export const replayProviderFactory: ProviderFactory = (config: unknown): Provider => {
  const parsed = replayConfigSchema.safeParse(config ?? {});
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new ProviderError(`Invalid replay provider config: ${issues}`);
  }
  const { responses, strict, fallback } = parsed.data;
  return new ReplayProvider(responses, strict, fallback);
};
