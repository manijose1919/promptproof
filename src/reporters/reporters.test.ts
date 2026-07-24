import { describe, it, expect } from "vitest";
import { createConsoleReporter } from "./console.js";
import { createJUnitReporter } from "./junit.js";
import type { SuiteVerdict } from "../core/types.js";

const passingVerdict: SuiteVerdict = {
  name: "demo",
  pass: true,
  total: 2,
  passed: 2,
  failed: 0,
  durationMs: 12,
  cases: [
    { name: "c1", pass: true, output: "hi", assertions: [{ type: "contains", pass: true, message: "ok" }], latencyMs: 0 },
    { name: "c2", pass: true, output: "yo", assertions: [{ type: "equals", pass: true, message: "ok" }], latencyMs: 0 },
  ],
};

const failingVerdict: SuiteVerdict = {
  name: "demo",
  pass: false,
  total: 2,
  passed: 1,
  failed: 1,
  durationMs: 30,
  cases: [
    { name: "c1", pass: true, output: "hi", assertions: [{ type: "contains", pass: true, message: "ok" }] },
    {
      name: "c2",
      pass: false,
      output: 'weird "quoted" <xml> & stuff',
      assertions: [{ type: "equals", pass: false, message: "expected output to equal \"ok\"" }],
    },
  ],
};

const erroredVerdict: SuiteVerdict = {
  name: "demo",
  pass: false,
  total: 1,
  passed: 0,
  failed: 1,
  durationMs: 5,
  cases: [{ name: "boom", pass: false, output: "", assertions: [], error: "provider timed out after 30000ms" }],
};

describe("console reporter", () => {
  it("renders a passing summary without color by default", () => {
    const out = createConsoleReporter().render(passingVerdict);
    expect(out).toContain("PASS  2/2 cases passed");
    expect(out).toContain("✔ c1");
    // no ANSI escape codes when color is off
    expect(out).not.toMatch(/\[/);
  });

  it("shows failing assertion detail and output snippet", () => {
    const out = createConsoleReporter().render(failingVerdict);
    expect(out).toContain("✖ c2");
    expect(out).toContain("- equals:");
    expect(out).toContain("output:");
    expect(out).toContain("FAIL");
  });

  it("emits ANSI codes when color is enabled", () => {
    const out = createConsoleReporter({ color: true }).render(passingVerdict);
    expect(out).toMatch(/\[/);
  });

  it("marks errored cases distinctly", () => {
    const out = createConsoleReporter().render(erroredVerdict);
    expect(out).toContain("boom");
    expect(out).toContain("(error)");
    expect(out).toContain("timed out");
  });
});

describe("junit reporter", () => {
  it("produces well-formed XML for a passing suite", () => {
    const xml = createJUnitReporter().render(passingVerdict);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('tests="2"');
    expect(xml).toContain('failures="0"');
    expect(xml).toContain('errors="0"');
    expect((xml.match(/<testcase /g) ?? []).length).toBe(2);
  });

  it("escapes XML special characters in output/messages", () => {
    const xml = createJUnitReporter().render(failingVerdict);
    expect(xml).toContain("&quot;");
    expect(xml).toContain("&lt;xml&gt;");
    expect(xml).toContain("&amp;");
    expect(xml).toContain("<failure");
  });

  it("reports errored cases as <error>, not <failure>", () => {
    const xml = createJUnitReporter().render(erroredVerdict);
    expect(xml).toContain('errors="1"');
    expect(xml).toContain("<error ");
    expect(xml).not.toContain("<failure");
  });
});
