import { describe, it, expect } from "vitest";
import { createGitHubReporter } from "./github.js";
import { createFreeRegistries } from "../index.js";
import type { SuiteVerdict } from "../core/types.js";

const failing: SuiteVerdict = {
  name: "bot suite",
  pass: false,
  total: 3,
  passed: 1,
  failed: 2,
  durationMs: 20,
  cases: [
    { name: "ok", pass: true, output: "fine", assertions: [{ type: "contains", pass: true, message: "ok" }] },
    {
      name: "leaks | pipe",
      pass: false,
      output: "bad",
      assertions: [{ type: "regex", pass: false, message: "expected output to not match /x/" }],
    },
    { name: "boom", pass: false, output: "", assertions: [], error: "provider timed out after 30000ms" },
  ],
};

describe("github reporter", () => {
  it("is registered in the Free tier", () => {
    expect(createFreeRegistries().reporters.has("github")).toBe(true);
  });

  it("emits ::error annotations only for failing/errored cases", () => {
    const out = createGitHubReporter().render(failing);
    const annotations = out.split("\n").filter((l) => l.startsWith("::error"));
    expect(annotations).toHaveLength(2); // 'leaks' + 'boom', not 'ok'
    // Title colon is escaped to %3A per the GitHub workflow-command spec.
    expect(annotations[0]).toContain("PromptProof%3A leaks");
    expect(annotations[1]).toContain("timed out");
  });

  it("escapes newlines/colons in annotation properties per GitHub spec", () => {
    const v: SuiteVerdict = {
      name: "s",
      pass: false,
      total: 1,
      passed: 0,
      failed: 1,
      durationMs: 1,
      cases: [{ name: "multi\nline", pass: false, output: "", assertions: [], error: "a: b\nc" }],
    };
    const out = createGitHubReporter().render(v);
    const ann = out.split("\n").find((l) => l.startsWith("::error"))!;
    expect(ann).toContain("%0A"); // newline encoded
    expect(ann).not.toMatch(/title=[^:]*\n/); // no raw newline in the command
  });

  it("renders a Markdown summary table with pipe-escaped content", () => {
    const out = createGitHubReporter().render(failing);
    expect(out).toContain("## PromptProof — bot suite");
    expect(out).toContain("| Case | Result | Detail |");
    // the case name 'leaks | pipe' must have its pipe escaped in the table
    expect(out).toContain("leaks \\| pipe");
    expect(out).toContain("**❌ FAIL**");
  });

  it("truncates very long detail cells (review fix)", () => {
    const long = "x".repeat(1000);
    const v: SuiteVerdict = {
      name: "s",
      pass: false,
      total: 1,
      passed: 0,
      failed: 1,
      durationMs: 1,
      cases: [{ name: "big", pass: false, output: long, assertions: [{ type: "equals", pass: false, message: long }] }],
    };
    const out = createGitHubReporter().render(v);
    expect(out).toContain("…");
    // the raw 1000-char run must not appear intact in the summary
    expect(out).not.toContain("x".repeat(400));
  });

  it("renders a clean pass summary", () => {
    const passing: SuiteVerdict = { ...failing, pass: true, passed: 3, failed: 0, cases: [failing.cases[0]!] };
    const out = createGitHubReporter().render(passing);
    expect(out).not.toContain("::error");
    expect(out).toContain("**✅ PASS**");
  });
});
