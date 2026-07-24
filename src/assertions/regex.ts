/**
 * `regex` assertion — output must match (or not match) a regular expression.
 *
 * Config:
 *   { type: "regex", pattern: string, flags?: string, negate?: boolean }
 *
 * Note: the pattern is compiled per evaluation from user config. We guard against
 * an invalid pattern with a clear AssertionConfigError rather than letting a raw
 * SyntaxError escape.
 */

import { z } from "zod";
import { AssertionConfigError } from "../core/errors.js";
import type { Assertion, AssertionContext, AssertionResult } from "../core/types.js";

const schema = z.object({
  pattern: z.string().min(1, "regex 'pattern' is required"),
  flags: z
    .string()
    .regex(/^[gimsuy]*$/, "invalid regex flags")
    .default(""),
  negate: z.boolean().default(false),
});

export const regexAssertion: Assertion = {
  type: "regex",
  evaluate(ctx: AssertionContext, config: unknown): AssertionResult {
    const parsed = schema.safeParse(config);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => i.message).join("; ");
      throw new AssertionConfigError(
        `regex assertion config invalid (case '${ctx.caseName}'): ${detail}`,
      );
    }
    const { pattern, flags, negate } = parsed.data;

    let re: RegExp;
    try {
      re = new RegExp(pattern, flags);
    } catch (err) {
      throw new AssertionConfigError(
        `regex assertion has an invalid pattern (case '${ctx.caseName}'): ${(err as Error).message}`,
      );
    }

    const matched = re.test(ctx.output);
    const pass = negate ? !matched : matched;
    const verb = negate ? "not match" : "match";
    return {
      pass,
      message: pass
        ? `output ${negate ? "does not match" : "matches"} /${pattern}/${flags}`
        : `expected output to ${verb} /${pattern}/${flags}`,
    };
  },
};
