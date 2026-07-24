/**
 * `json-schema` assertion — parse the output as JSON and validate its shape.
 *
 * This is the workhorse for testing *structured* LLM output. It implements a
 * pragmatic, dependency-free subset of JSON Schema (Draft-07-ish) covering the
 * keywords that actually matter for LLM output validation.
 *
 * Config:
 *   { type: "json-schema", schema: <JSON Schema object>, parse?: boolean }
 *
 * `parse` (default true): JSON.parse the output first. Set false to validate an
 * already-structured value that a Premium provider attached (not used in Free).
 *
 * Supported keywords: type, enum, const, required, properties,
 * additionalProperties (boolean), items, minItems, maxItems, minLength,
 * maxLength, minimum, maximum, pattern, nullable.
 */

import { z } from "zod";
import { AssertionConfigError } from "../core/errors.js";
import type { Assertion, AssertionContext, AssertionResult } from "../core/types.js";

const configSchema = z.object({
  schema: z.record(z.string(), z.unknown()),
  parse: z.boolean().default(true),
});

type JsonSchema = Record<string, unknown>;

function jsonTypeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  const t = typeof value;
  if (t === "number") return Number.isInteger(value) ? "integer" : "number";
  return t; // "string" | "boolean" | "object"
}

/** Returns a list of validation error strings; empty means valid. */
function validate(value: unknown, schema: JsonSchema, path: string): string[] {
  const errors: string[] = [];
  const at = path || "(root)";

  // type — may be a single type ("string") or a union (["string","null"]).
  // A JSON "integer" also satisfies "number".
  if (schema.type !== undefined) {
    const wanted = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!wanted.every((t) => typeof t === "string")) {
      throw new AssertionConfigError(
        `json-schema: 'type' must be a string or array of strings at ${at}`,
      );
    }
    const actual = jsonTypeOf(value);
    const ok = (wanted as string[]).some(
      (want) => actual === want || (want === "number" && actual === "integer"),
    );
    if (!ok) {
      const label = (wanted as string[]).map((w) => `'${w}'`).join(" | ");
      errors.push(`${at}: expected type ${label}, got '${actual}'`);
      return errors; // further keyword checks assume the base type
    }
  }

  // const
  if ("const" in schema && JSON.stringify(value) !== JSON.stringify(schema.const)) {
    errors.push(`${at}: expected const ${JSON.stringify(schema.const)}`);
  }

  // enum
  if (Array.isArray(schema.enum)) {
    const found = schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value));
    if (!found) errors.push(`${at}: value not in enum ${JSON.stringify(schema.enum)}`);
  }

  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength)
      errors.push(`${at}: string shorter than minLength ${schema.minLength}`);
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength)
      errors.push(`${at}: string longer than maxLength ${schema.maxLength}`);
    if (typeof schema.pattern === "string") {
      try {
        if (!new RegExp(schema.pattern).test(value))
          errors.push(`${at}: string does not match pattern /${schema.pattern}/`);
      } catch {
        throw new AssertionConfigError(`json-schema: invalid pattern /${String(schema.pattern)}/`);
      }
    }
  }

  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum)
      errors.push(`${at}: number below minimum ${schema.minimum}`);
    if (typeof schema.maximum === "number" && value > schema.maximum)
      errors.push(`${at}: number above maximum ${schema.maximum}`);
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems)
      errors.push(`${at}: array has fewer than minItems ${schema.minItems}`);
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems)
      errors.push(`${at}: array has more than maxItems ${schema.maxItems}`);
    if (schema.items && typeof schema.items === "object") {
      value.forEach((item, i) => {
        errors.push(...validate(item, schema.items as JsonSchema, `${at}[${i}]`));
      });
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;

    if (Array.isArray(schema.required)) {
      for (const key of schema.required as string[]) {
        if (!Object.prototype.hasOwnProperty.call(obj, key))
          errors.push(`${at}: missing required property '${key}'`);
      }
    }

    const props = (schema.properties as Record<string, JsonSchema> | undefined) ?? {};
    for (const [key, sub] of Object.entries(props)) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        errors.push(...validate(obj[key], sub, `${at}.${key}`));
      }
    }

    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(props));
      for (const key of Object.keys(obj)) {
        if (!allowed.has(key)) errors.push(`${at}: unexpected property '${key}'`);
      }
    }
  }

  return errors;
}

export const jsonSchemaAssertion: Assertion = {
  type: "json-schema",
  evaluate(ctx: AssertionContext, config: unknown): AssertionResult {
    const parsed = configSchema.safeParse(config);
    if (!parsed.success) {
      throw new AssertionConfigError(
        `json-schema assertion requires a 'schema' object (case '${ctx.caseName}').`,
      );
    }
    const { schema, parse } = parsed.data;

    let value: unknown = ctx.output;
    if (parse) {
      try {
        value = JSON.parse(ctx.output);
      } catch {
        return {
          pass: false,
          message: `output is not valid JSON: ${JSON.stringify(ctx.output.slice(0, 80))}`,
        };
      }
    }

    const errors = validate(value, schema, "");
    return {
      pass: errors.length === 0,
      message:
        errors.length === 0
          ? `output matches JSON schema`
          : `schema validation failed: ${errors.join("; ")}`,
    };
  },
};
