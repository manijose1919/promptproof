import { describe, it, expect } from "vitest";
import { writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseSuite, loadSuiteFromFile } from "./config.js";
import { ConfigError } from "./errors.js";

const validSuite = {
  name: "greeting suite",
  provider: "replay",
  cases: [
    {
      name: "greets politely",
      messages: [{ role: "user", content: "hi" }],
      assert: [{ type: "contains", value: "hello" }],
    },
  ],
};

describe("parseSuite", () => {
  it("accepts a valid suite and preserves assertion-specific keys", () => {
    const suite = parseSuite(validSuite);
    expect(suite.name).toBe("greeting suite");
    expect(suite.cases).toHaveLength(1);
    // passthrough must retain the assertion's `value` field
    expect(suite.cases[0]!.assert[0]).toMatchObject({ type: "contains", value: "hello" });
  });

  it("defaults the suite name when omitted", () => {
    const { name, ...rest } = validSuite;
    void name;
    const suite = parseSuite(rest);
    expect(suite.name).toBe("promptproof suite");
  });

  it("rejects a suite with no cases", () => {
    expect(() => parseSuite({ cases: [] })).toThrow(ConfigError);
  });

  it("rejects a case with no messages", () => {
    const bad = {
      cases: [{ name: "x", messages: [], assert: [{ type: "contains" }] }],
    };
    expect(() => parseSuite(bad)).toThrow(/at least one message/);
  });

  it("rejects a case with no assertions", () => {
    const bad = {
      cases: [{ name: "x", messages: [{ role: "user", content: "hi" }], assert: [] }],
    };
    expect(() => parseSuite(bad)).toThrow(/at least one assertion/);
  });

  it("rejects an invalid message role", () => {
    const bad = {
      cases: [
        {
          name: "x",
          messages: [{ role: "wizard", content: "hi" }],
          assert: [{ type: "contains" }],
        },
      ],
    };
    expect(() => parseSuite(bad)).toThrow(ConfigError);
  });

  it("rejects an assertion without a type", () => {
    const bad = {
      cases: [
        {
          name: "x",
          messages: [{ role: "user", content: "hi" }],
          assert: [{ value: "hello" }],
        },
      ],
    };
    expect(() => parseSuite(bad)).toThrow(ConfigError);
  });

  it("rejects duplicate case names (they are the replay key)", () => {
    const bad = {
      cases: [
        { name: "dup", messages: [{ role: "user", content: "a" }], assert: [{ type: "contains" }] },
        { name: "dup", messages: [{ role: "user", content: "b" }], assert: [{ type: "contains" }] },
      ],
    };
    expect(() => parseSuite(bad)).toThrow(/duplicate case name 'dup'/);
  });

  it("rejects an out-of-range temperature (review fix #1)", () => {
    const bad = {
      cases: [
        {
          name: "x",
          messages: [{ role: "user", content: "hi" }],
          temperature: 50,
          assert: [{ type: "contains" }],
        },
      ],
    };
    expect(() => parseSuite(bad)).toThrow(/temperature must be <= 2/);
  });

  it("accepts a temperature at the boundary", () => {
    const ok = {
      cases: [
        {
          name: "x",
          messages: [{ role: "user", content: "hi" }],
          temperature: 2,
          assert: [{ type: "contains" }],
        },
      ],
    };
    expect(() => parseSuite(ok)).not.toThrow();
  });

  it("includes the field path in the error message", () => {
    try {
      parseSuite({ cases: [{ name: "", messages: [], assert: [] }] });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as Error).message).toContain("cases.0");
    }
  });
});

describe("loadSuiteFromFile", () => {
  it("throws a ConfigError for a missing file", () => {
    expect(() => loadSuiteFromFile("does-not-exist-42.yaml")).toThrow(ConfigError);
  });

  it("loads and validates a real YAML file", () => {
    const path = join(tmpdir(), `pp-valid-${process.pid}.yaml`);
    writeFileSync(
      path,
      "name: file suite\ncases:\n  - name: c1\n    messages:\n      - role: user\n        content: hi\n    assert:\n      - type: contains\n        value: hello\n",
    );
    try {
      const suite = loadSuiteFromFile(path);
      expect(suite.name).toBe("file suite");
      expect(suite.cases[0]!.name).toBe("c1");
    } finally {
      rmSync(path, { force: true });
    }
  });

  it("gives a targeted error when the root is a list (review fix #2)", () => {
    const path = join(tmpdir(), `pp-array-${process.pid}.yaml`);
    writeFileSync(path, "- name: c1\n  messages: []\n");
    try {
      expect(() => loadSuiteFromFile(path)).toThrow(/top-level list/);
    } finally {
      rmSync(path, { force: true });
    }
  });
});
