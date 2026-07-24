import { describe, it, expect } from "vitest";
import { Registries } from "./registry.js";
import { ProviderError, AssertionConfigError, PromptProofError } from "./errors.js";
import { replayProviderFactory, REPLAY_PROVIDER_NAME } from "../providers/replay.js";
import type { Assertion } from "./types.js";

const dummyAssertion: Assertion = {
  type: "dummy",
  evaluate: () => ({ pass: true, message: "ok" }),
};

describe("Registries", () => {
  it("registers and retrieves a provider factory (case-insensitive)", () => {
    const r = new Registries();
    r.providers.register(REPLAY_PROVIDER_NAME, replayProviderFactory);
    expect(r.providers.has("REPLAY")).toBe(true);
    const provider = r.createProvider("Replay", { responses: {} });
    expect(provider.name).toBe("replay");
  });

  it("throws a helpful error for an unknown provider", () => {
    const r = new Registries();
    expect(() => r.createProvider("openai", {})).toThrow(ProviderError);
    expect(() => r.createProvider("openai", {})).toThrow(/Premium module/);
  });

  it("throws a helpful error for an unknown assertion", () => {
    const r = new Registries();
    expect(() => r.getAssertion("similarity")).toThrow(AssertionConfigError);
    expect(() => r.getAssertion("similarity")).toThrow(/Premium module/);
  });

  it("prevents accidental double-registration", () => {
    const r = new Registries();
    r.assertions.register("dummy", dummyAssertion);
    expect(() => r.assertions.register("dummy", dummyAssertion)).toThrow(PromptProofError);
  });

  it("allows explicit override", () => {
    const r = new Registries();
    r.assertions.register("dummy", dummyAssertion);
    expect(() =>
      r.assertions.register("dummy", dummyAssertion, { override: true }),
    ).not.toThrow();
  });

  it("exposes sorted capability listings (review fix)", () => {
    const r = new Registries();
    r.assertions.register("zeta", dummyAssertion);
    r.assertions.register("alpha", dummyAssertion);
    r.providers.register("replay", replayProviderFactory);
    expect(r.listAssertions()).toEqual(["alpha", "zeta"]);
    expect(r.listProviders()).toEqual(["replay"]);
    expect(r.listReporters()).toEqual([]);
  });
});

describe("replay provider", () => {
  it("returns the recorded response for a matching key", async () => {
    const provider = replayProviderFactory({ responses: { greet: "Hello!" } });
    const res = await provider.complete({ key: "greet", messages: [] });
    expect(res.output).toBe("Hello!");
    expect(res.model).toBe("replay");
  });

  it("is deterministic across repeated calls", async () => {
    const provider = replayProviderFactory({ responses: { greet: "Hello!" } });
    const a = await provider.complete({ key: "greet", messages: [] });
    const b = await provider.complete({ key: "greet", messages: [] });
    expect(a.output).toBe(b.output);
  });

  it("throws in strict mode (default) when key is missing", async () => {
    const provider = replayProviderFactory({ responses: { greet: "Hello!" } });
    await expect(provider.complete({ key: "missing", messages: [] })).rejects.toThrow(
      ProviderError,
    );
  });

  it("uses fallback in non-strict mode", async () => {
    const provider = replayProviderFactory({
      responses: {},
      strict: false,
      fallback: "N/A",
    });
    const res = await provider.complete({ key: "anything", messages: [] });
    expect(res.output).toBe("N/A");
  });

  it("returns empty string in non-strict mode with no fallback", async () => {
    const provider = replayProviderFactory({ responses: {}, strict: false });
    const res = await provider.complete({ key: "anything", messages: [] });
    expect(res.output).toBe("");
  });

  it("rejects malformed config", () => {
    expect(() => replayProviderFactory({ responses: "not-an-object" })).toThrow(ProviderError);
  });
});
