/**
 * Suite configuration: zod schema + YAML/JSON loader.
 *
 * All external input passes through `parseSuite`, so a malformed suite fails
 * loudly with a precise, path-annotated message instead of surfacing as a
 * confusing `undefined` deep in the runner.
 */

import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { ConfigError } from "./errors.js";
import type { SuiteSpec } from "./types.js";

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

/** Assertions keep their extra keys via passthrough; each assertion validates its own shape. */
const assertionSchema = z
  .object({ type: z.string().min(1, "assertion 'type' is required") })
  .passthrough();

const caseSchema = z.object({
  name: z.string().min(1, "case 'name' is required"),
  messages: z.array(messageSchema).min(1, "each case needs at least one message"),
  provider: z.string().min(1).optional(),
  model: z.string().optional(),
  temperature: z
    .number()
    .min(0, "temperature must be >= 0")
    .max(2, "temperature must be <= 2")
    .optional(),
  maxTokens: z.number().int().positive().optional(),
  assert: z.array(assertionSchema).min(1, "each case needs at least one assertion"),
});

const suiteSchema = z
  .object({
    name: z.string().min(1).default("promptproof suite"),
    provider: z.string().min(1).optional(),
    model: z.string().optional(),
    providers: z.record(z.string(), z.unknown()).optional(),
    cases: z.array(caseSchema).min(1, "a suite needs at least one case"),
  })
  .superRefine((suite, ctx) => {
    // Case names are used as the deterministic replay key, so they must be unique.
    const seen = new Set<string>();
    suite.cases.forEach((c, i) => {
      if (seen.has(c.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate case name '${c.name}' (case names must be unique)`,
          path: ["cases", i, "name"],
        });
      }
      seen.add(c.name);
    });
  });

/** Validate an already-parsed object into a SuiteSpec. */
export function parseSuite(raw: unknown, source = "<inline>"): SuiteSpec {
  const result = suiteSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new ConfigError(`Invalid suite config in ${source}:\n${issues}`);
  }
  return result.data as SuiteSpec;
}

/** Read + parse (YAML or JSON — YAML is a superset) + validate a suite file. */
export function loadSuiteFromFile(path: string): SuiteSpec {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    throw new ConfigError(
      `Cannot read suite file '${path}': ${(err as Error).message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch (err) {
    throw new ConfigError(
      `Cannot parse YAML/JSON in '${path}': ${(err as Error).message}`,
    );
  }

  if (parsed === null || typeof parsed !== "object") {
    throw new ConfigError(
      `Suite file '${path}' is empty or not a mapping.`,
    );
  }

  if (Array.isArray(parsed)) {
    throw new ConfigError(
      `Suite file '${path}' is a top-level list. Wrap your cases under a 'cases:' key, ` +
        `e.g.\n  name: my suite\n  cases:\n    - name: ...`,
    );
  }

  return parseSuite(parsed, path);
}
