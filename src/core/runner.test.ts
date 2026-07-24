import { describe, it, expect } from "vitest";
import { runSuite } from "./runner.js";
import { Registries } from "./registry.js";
import { replayProviderFactory } from "../providers/replay.js";
import { registerFreeAssertions } from "../assertions/index.js";
import type { Provider, SuiteSpec } from "./types.js";

function freeRegistries(): Registries {
  const r = new Registries();
  r.providers.register("replay", replayProviderFactory);
  registerFreeAssertions(r);
  return r;
}

// Deterministic clock so durationMs is stable.
const fixedNow = () => 1_000;

describe("runSuite", () => {
  it("runs a passing suite end-to-end via replay", async () => {
    const suite: SuiteSpec = {
      name: "greet",
      provider: "replay",
      providers: { replay: { responses: { c1: "Hello there!" } } },
      cases: [
        {
          name: "c1",
          messages: [{ role: "user", content: "hi" }],
          assert: [{ type: "contains", value: "Hello" }],
        },
      ],
    };
    const verdict = await runSuite(suite, freeRegistries(), { now: fixedNow });
    expect(verdict.pass).toBe(true);
    expect(verdict.passed).toBe(1);
    expect(verdict.failed).toBe(0);
    expect(verdict.cases[0]!.output).toBe("Hello there!");
  });

  it("marks a case failed when an assertion fails, and keeps the rest running", async () => {
    const suite: SuiteSpec = {
      name: "mixed",
      provider: "replay",
      providers: { replay: { responses: { good: "yes", bad: "no" } } },
      cases: [
        { name: "good", messages: [{ role: "user", content: "x" }], assert: [{ type: "equals", value: "yes" }] },
        { name: "bad", messages: [{ role: "user", content: "x" }], assert: [{ type: "equals", value: "yes" }] },
      ],
    };
    const verdict = await runSuite(suite, freeRegistries(), { now: fixedNow });
    expect(verdict.pass).toBe(false);
    expect(verdict.passed).toBe(1);
    expect(verdict.failed).toBe(1);
    expect(verdict.cases.find((c) => c.name === "bad")!.pass).toBe(false);
  });

  it("isolates a provider error to a single case", async () => {
    // strict replay with a missing key throws — must fail only that case.
    const suite: SuiteSpec = {
      name: "iso",
      provider: "replay",
      providers: { replay: { responses: { present: "ok" } } },
      cases: [
        { name: "present", messages: [{ role: "user", content: "x" }], assert: [{ type: "equals", value: "ok" }] },
        { name: "absent", messages: [{ role: "user", content: "x" }], assert: [{ type: "equals", value: "ok" }] },
      ],
    };
    const verdict = await runSuite(suite, freeRegistries(), { now: fixedNow });
    expect(verdict.passed).toBe(1);
    const absent = verdict.cases.find((c) => c.name === "absent")!;
    expect(absent.pass).toBe(false);
    expect(absent.error).toMatch(/no recorded response/);
  });

  it("treats an unknown assertion type as a failed assertion, not a crash", async () => {
    const suite: SuiteSpec = {
      name: "unknown-assert",
      provider: "replay",
      providers: { replay: { responses: { c: "hi" } } },
      cases: [
        { name: "c", messages: [{ role: "user", content: "x" }], assert: [{ type: "similarity", value: "hi" }] },
      ],
    };
    const verdict = await runSuite(suite, freeRegistries(), { now: fixedNow });
    expect(verdict.cases[0]!.pass).toBe(false);
    expect(verdict.cases[0]!.assertions[0]!.message).toMatch(/Premium module/);
  });

  it("requires ALL assertions in a case to pass", async () => {
    const suite: SuiteSpec = {
      name: "multi-assert",
      provider: "replay",
      providers: { replay: { responses: { c: "hello world" } } },
      cases: [
        {
          name: "c",
          messages: [{ role: "user", content: "x" }],
          assert: [
            { type: "contains", value: "hello" },
            { type: "contains", value: "goodbye" },
          ],
        },
      ],
    };
    const verdict = await runSuite(suite, freeRegistries(), { now: fixedNow });
    expect(verdict.cases[0]!.pass).toBe(false);
    expect(verdict.cases[0]!.assertions[0]!.pass).toBe(true);
    expect(verdict.cases[0]!.assertions[1]!.pass).toBe(false);
  });

  it("fails a case whose provider hangs, instead of hanging the run (review fix)", async () => {
    const registries = freeRegistries();
    // A provider that never resolves.
    const hang: Provider = { name: "hang", complete: () => new Promise<never>(() => {}) };
    registries.providers.register("hang", () => hang);
    const suite: SuiteSpec = {
      name: "timeout",
      provider: "hang",
      cases: [
        { name: "c", messages: [{ role: "user", content: "x" }], assert: [{ type: "equals", value: "x" }] },
      ],
    };
    const verdict = await runSuite(suite, registries, { now: fixedNow, timeoutMs: 25 });
    expect(verdict.pass).toBe(false);
    expect(verdict.cases[0]!.error).toMatch(/timed out after 25ms/);
  });

  it("lets a case override the suite provider", async () => {
    const registries = freeRegistries();
    // Register a second provider that always returns a fixed string.
    const echo: Provider = { name: "echo", complete: async () => ({ output: "ECHO" }) };
    registries.providers.register("echo", () => echo);
    const suite: SuiteSpec = {
      name: "override",
      provider: "replay",
      providers: { replay: { responses: { c: "from-replay" } } },
      cases: [
        { name: "c", messages: [{ role: "user", content: "x" }], provider: "echo", assert: [{ type: "equals", value: "ECHO" }] },
      ],
    };
    const verdict = await runSuite(suite, registries, { now: fixedNow });
    expect(verdict.pass).toBe(true);
  });
});
