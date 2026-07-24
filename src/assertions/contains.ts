/**
 * `contains` assertion — substring presence (or absence).
 *
 * Config:
 *   {
 *     type: "contains",
 *     value: string | string[],   // one or more required substrings
 *     ignoreCase?: boolean,
 *     all?: boolean,               // when value is an array: require all (default) vs. any
 *     negate?: boolean             // assert the substring is ABSENT
 *   }
 */

import { z } from "zod";
import { AssertionConfigError } from "../core/errors.js";
import type { Assertion, AssertionContext, AssertionResult } from "../core/types.js";

const schema = z.object({
  value: z.union([z.string(), z.array(z.string()).min(1)]),
  ignoreCase: z.boolean().default(false),
  all: z.boolean().default(true),
  negate: z.boolean().default(false),
});

export const containsAssertion: Assertion = {
  type: "contains",
  evaluate(ctx: AssertionContext, config: unknown): AssertionResult {
    const parsed = schema.safeParse(config);
    if (!parsed.success) {
      throw new AssertionConfigError(
        `contains assertion requires 'value' to be a string or non-empty string array (case '${ctx.caseName}').`,
      );
    }
    const { value, ignoreCase, all, negate } = parsed.data;
    const needles = Array.isArray(value) ? value : [value];
    const haystack = ignoreCase ? ctx.output.toLowerCase() : ctx.output;

    const present = (needle: string): boolean =>
      haystack.includes(ignoreCase ? needle.toLowerCase() : needle);

    // "found" = does the output satisfy the presence requirement across needles?
    const found = all ? needles.every(present) : needles.some(present);
    const pass = negate ? !found : found;

    const list = needles.map((n) => JSON.stringify(n)).join(all ? " AND " : " OR ");
    const verb = negate ? "not contain" : "contain";
    return {
      pass,
      message: pass
        ? `output satisfies: ${verb} ${list}`
        : `expected output to ${verb} ${list}`,
    };
  },
};
