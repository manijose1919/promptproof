import { describe, it, expect } from "vitest";
import { equalsAssertion } from "./equals.js";
import { containsAssertion } from "./contains.js";
import { regexAssertion } from "./regex.js";
import { jsonSchemaAssertion } from "./json-schema.js";
import { AssertionConfigError } from "../core/errors.js";
import type { AssertionContext } from "../core/types.js";

const ctx = (output: string): AssertionContext => ({ output, caseName: "t" });

describe("equals", () => {
  it("passes on exact match", () => {
    expect(equalsAssertion.evaluate(ctx("hello"), { value: "hello" })).toMatchObject({ pass: true });
  });
  it("fails on mismatch", () => {
    expect(equalsAssertion.evaluate(ctx("hello"), { value: "world" })).toMatchObject({ pass: false });
  });
  it("honors trim and ignoreCase", () => {
    expect(
      equalsAssertion.evaluate(ctx("  HELLO  "), { value: "hello", trim: true, ignoreCase: true }),
    ).toMatchObject({ pass: true });
  });
  it("throws on missing value", () => {
    expect(() => equalsAssertion.evaluate(ctx("x"), {})).toThrow(AssertionConfigError);
  });
});

describe("contains", () => {
  it("passes when substring present", () => {
    expect(containsAssertion.evaluate(ctx("say hello there"), { value: "hello" })).toMatchObject({ pass: true });
  });
  it("requires all substrings by default", () => {
    expect(
      containsAssertion.evaluate(ctx("has a only"), { value: ["a", "b"] }),
    ).toMatchObject({ pass: false });
  });
  it("supports any-mode (all:false)", () => {
    expect(
      containsAssertion.evaluate(ctx("has a only"), { value: ["a", "b"], all: false }),
    ).toMatchObject({ pass: true });
  });
  it("supports negate (absence)", () => {
    expect(
      containsAssertion.evaluate(ctx("clean output"), { value: "error", negate: true }),
    ).toMatchObject({ pass: true });
  });
  it("supports ignoreCase", () => {
    expect(
      containsAssertion.evaluate(ctx("HELLO"), { value: "hello", ignoreCase: true }),
    ).toMatchObject({ pass: true });
  });
});

describe("regex", () => {
  it("passes on match", () => {
    expect(regexAssertion.evaluate(ctx("order #4212"), { pattern: "#\\d+" })).toMatchObject({ pass: true });
  });
  it("respects flags", () => {
    expect(regexAssertion.evaluate(ctx("HELLO"), { pattern: "hello", flags: "i" })).toMatchObject({ pass: true });
  });
  it("supports negate", () => {
    expect(regexAssertion.evaluate(ctx("clean"), { pattern: "error", negate: true })).toMatchObject({ pass: true });
  });
  it("throws on invalid pattern", () => {
    expect(() => regexAssertion.evaluate(ctx("x"), { pattern: "(" })).toThrow(AssertionConfigError);
  });
  it("throws on invalid flags", () => {
    expect(() => regexAssertion.evaluate(ctx("x"), { pattern: "a", flags: "zz" })).toThrow(AssertionConfigError);
  });
});

describe("json-schema", () => {
  const schema = {
    type: "object",
    required: ["name", "age"],
    properties: {
      name: { type: "string", minLength: 1 },
      age: { type: "integer", minimum: 0, maximum: 130 },
      role: { type: "string", enum: ["admin", "user"] },
    },
    additionalProperties: false,
  };

  it("passes valid structured JSON", () => {
    const out = JSON.stringify({ name: "Ada", age: 36, role: "admin" });
    expect(jsonSchemaAssertion.evaluate(ctx(out), { schema })).toMatchObject({ pass: true });
  });

  it("fails when a required field is missing", () => {
    const out = JSON.stringify({ name: "Ada" });
    const r = jsonSchemaAssertion.evaluate(ctx(out), { schema });
    expect(r.pass).toBe(false);
    expect(r.message).toContain("missing required property 'age'");
  });

  it("fails on wrong type", () => {
    const out = JSON.stringify({ name: "Ada", age: "old" });
    const r = jsonSchemaAssertion.evaluate(ctx(out), { schema });
    expect(r.pass).toBe(false);
    expect(r.message).toContain("expected type 'integer'");
  });

  it("fails on enum violation", () => {
    const out = JSON.stringify({ name: "Ada", age: 36, role: "wizard" });
    const r = jsonSchemaAssertion.evaluate(ctx(out), { schema });
    expect(r.pass).toBe(false);
    expect(r.message).toContain("not in enum");
  });

  it("fails on additionalProperties", () => {
    const out = JSON.stringify({ name: "Ada", age: 36, hacked: true });
    const r = jsonSchemaAssertion.evaluate(ctx(out), { schema });
    expect(r.pass).toBe(false);
    expect(r.message).toContain("unexpected property 'hacked'");
  });

  it("fails cleanly on non-JSON output", () => {
    const r = jsonSchemaAssertion.evaluate(ctx("not json {"), { schema });
    expect(r.pass).toBe(false);
    expect(r.message).toContain("not valid JSON");
  });

  it("supports union type arrays like ['string','null'] (review fix)", () => {
    const nullableSchema = {
      type: "object",
      properties: { nickname: { type: ["string", "null"] } },
      required: ["nickname"],
    };
    // null is allowed
    expect(
      jsonSchemaAssertion.evaluate(ctx(JSON.stringify({ nickname: null })), { schema: nullableSchema }).pass,
    ).toBe(true);
    // string is allowed
    expect(
      jsonSchemaAssertion.evaluate(ctx(JSON.stringify({ nickname: "Ada" })), { schema: nullableSchema }).pass,
    ).toBe(true);
    // number is NOT allowed — must fail, not silently pass
    const bad = jsonSchemaAssertion.evaluate(ctx(JSON.stringify({ nickname: 42 })), { schema: nullableSchema });
    expect(bad.pass).toBe(false);
    expect(bad.message).toContain("expected type 'string' | 'null'");
  });

  it("validates nested arrays with items", () => {
    const arrSchema = {
      type: "object",
      properties: { tags: { type: "array", minItems: 1, items: { type: "string" } } },
      required: ["tags"],
    };
    const good = jsonSchemaAssertion.evaluate(ctx(JSON.stringify({ tags: ["a", "b"] })), { schema: arrSchema });
    expect(good.pass).toBe(true);
    const bad = jsonSchemaAssertion.evaluate(ctx(JSON.stringify({ tags: [1, 2] })), { schema: arrSchema });
    expect(bad.pass).toBe(false);
    expect(bad.message).toContain("expected type 'string'");
  });
});
