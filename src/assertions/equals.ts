/**
 * `equals` assertion — exact string match.
 *
 * Config:
 *   { type: "equals", value: string, trim?: boolean, ignoreCase?: boolean }
 */

import { z } from "zod";
import { AssertionConfigError } from "../core/errors.js";
import type { Assertion, AssertionContext, AssertionResult } from "../core/types.js";

const schema = z.object({
  value: z.string(),
  trim: z.boolean().default(false),
  ignoreCase: z.boolean().default(false),
});

function normalize(s: string, trim: boolean, ignoreCase: boolean): string {
  let out = s;
  if (trim) out = out.trim();
  if (ignoreCase) out = out.toLowerCase();
  return out;
}

export const equalsAssertion: Assertion = {
  type: "equals",
  evaluate(ctx: AssertionContext, config: unknown): AssertionResult {
    const parsed = schema.safeParse(config);
    if (!parsed.success) {
      throw new AssertionConfigError(
        `equals assertion requires a string 'value' (case '${ctx.caseName}').`,
      );
    }
    const { value, trim, ignoreCase } = parsed.data;
    const actual = normalize(ctx.output, trim, ignoreCase);
    const expected = normalize(value, trim, ignoreCase);
    const pass = actual === expected;
    return {
      pass,
      message: pass
        ? `output equals expected value`
        : `expected output to equal ${JSON.stringify(value)}, got ${JSON.stringify(ctx.output)}`,
    };
  },
};
