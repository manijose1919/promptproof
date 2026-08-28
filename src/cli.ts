#!/usr/bin/env node
/**
 * PromptProof CLI (Free tier).
 *
 * Commands:
 *   promptproof run <suite.yaml> [--reporter console|junit|github] [--output file]
 *                                [--color] [--timeout ms] [--provider name]
 *   promptproof list                     # show registered capabilities
 *
 * Exit codes: 0 = all cases passed, 1 = one or more failed, 2 = usage/config error.
 * The non-zero exit on failure is what turns PromptProof into a CI gate.
 */

import { writeFileSync } from "node:fs";
import { Command } from "commander";
import { createFreeRegistries } from "./index.js";
import { loadSuiteFromFile } from "./core/config.js";
import { runSuite } from "./core/runner.js";
import { PromptProofError } from "./core/errors.js";
import { createConsoleReporter } from "./reporters/console.js";

const program = new Command();

program
  .name("promptproof")
  .description("Jest for prompts — regression-test and evaluate your LLM features.")
  .version("1.0.0");

program
  .command("run")
  .description("Run a prompt test suite")
  .argument("<suite>", "path to a suite YAML/JSON file")
  .option("-r, --reporter <name>", "reporter: console | junit | github", "console")
  .option("-o, --output <file>", "write the report to a file instead of stdout")
  .option("--color", "force colorized console output (default: auto-detect TTY)")
  .option("--no-color", "disable console color")
  .option("-p, --provider <name>", "default provider when the suite omits one", "replay")
  .option("-t, --timeout <ms>", "per-case provider timeout in ms", "30000")
  .action(async (suitePath: string, opts: RunOpts) => {
    const registries = createFreeRegistries();

    let suite;
    try {
      suite = loadSuiteFromFile(suitePath);
    } catch (err) {
      fail(err, 2);
      return;
    }

    const timeoutMs = Number.parseInt(opts.timeout, 10);
    if (Number.isNaN(timeoutMs) || timeoutMs < 0) {
      fail(new PromptProofError(`--timeout must be a non-negative integer, got '${opts.timeout}'`), 2);
      return;
    }

    let verdict;
    try {
      verdict = await runSuite(suite, registries, {
        defaultProvider: opts.provider,
        timeoutMs,
      });
    } catch (err) {
      fail(err, 2);
      return;
    }

    // Color policy: never colorize a file; otherwise honor an explicit flag,
    // and fall back to auto-detecting an interactive terminal.
    const explicitColor = opts.color; // true (--color), false (--no-color), or undefined
    const useColor = opts.output
      ? false
      : explicitColor !== undefined
        ? explicitColor
        : Boolean(process.stdout.isTTY);

    // Resolve reporter. The console reporter honors color; others are registry-based.
    let rendered: string;
    if (opts.reporter === "console") {
      rendered = createConsoleReporter({ color: useColor }).render(verdict);
    } else {
      const reporter = registries.reporters.get(opts.reporter);
      if (!reporter) {
        fail(
          new PromptProofError(
            `Unknown reporter '${opts.reporter}'. Available: ${registries.listReporters().join(", ")}.`,
          ),
          2,
        );
        return;
      }
      rendered = reporter.render(verdict);
    }

    if (opts.output) {
      writeFileSync(opts.output, rendered.endsWith("\n") ? rendered : `${rendered}\n`);
      process.stdout.write(
        `${verdict.pass ? "PASS" : "FAIL"} — ${verdict.passed}/${verdict.total} cases. Report written to ${opts.output}\n`,
      );
    } else {
      process.stdout.write(`${rendered}\n`);
    }

    // The CI gate: non-zero exit when any case failed.
    process.exitCode = verdict.pass ? 0 : 1;
  });

program
  .command("list")
  .description("List registered providers, assertions, and reporters")
  .action(() => {
    const r = createFreeRegistries();
    process.stdout.write("Providers:  " + r.listProviders().join(", ") + "\n");
    process.stdout.write("Assertions: " + r.listAssertions().join(", ") + "\n");
    process.stdout.write("Reporters:  " + r.listReporters().join(", ") + "\n");
    process.stdout.write(
      "\nPremium unlocks: openai/anthropic providers, similarity & llm-judge assertions.\n",
    );
  });

interface RunOpts {
  reporter: string;
  output?: string;
  /** undefined = auto (TTY-detect); true = --color; false = --no-color. */
  color?: boolean;
  provider: string;
  timeout: string;
}

function fail(err: unknown, code: number): void {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`promptproof: ${message}\n`);
  process.exitCode = code;
}

program.parseAsync(process.argv).catch((err: unknown) => {
  fail(err, 2);
});
