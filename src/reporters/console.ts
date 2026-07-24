/**
 * Console reporter — human-readable, CI-log-friendly summary.
 *
 * Pure: returns a string. Colour is applied only when the caller opts in, so the
 * output is clean when piped to a file or a CI log that strips ANSI.
 */

import type { CaseVerdict, Reporter, SuiteVerdict } from "../core/types.js";

const ANSI = {
  reset: "[0m",
  red: "[31m",
  green: "[32m",
  yellow: "[33m",
  dim: "[2m",
  bold: "[1m",
};

export interface ConsoleReporterOptions {
  color?: boolean;
  /** Show provider output for failing cases (default true). */
  showOutputOnFail?: boolean;
}

function makePaint(color: boolean) {
  return (code: string, text: string): string => (color ? `${code}${text}${ANSI.reset}` : text);
}

function renderCase(c: CaseVerdict, paint: (code: string, text: string) => string, showOutput: boolean): string {
  const lines: string[] = [];
  if (c.error) {
    lines.push(`  ${paint(ANSI.red, "✖")} ${c.name} ${paint(ANSI.dim, "(error)")}`);
    lines.push(`      ${paint(ANSI.red, c.error)}`);
    return lines.join("\n");
  }

  const mark = c.pass ? paint(ANSI.green, "✔") : paint(ANSI.red, "✖");
  lines.push(`  ${mark} ${c.name}`);
  for (const a of c.assertions) {
    if (!a.pass) {
      const score = a.score !== undefined ? paint(ANSI.dim, ` [score ${a.score.toFixed(2)}]`) : "";
      lines.push(`      ${paint(ANSI.red, `- ${a.type}: ${a.message}`)}${score}`);
    }
  }
  if (!c.pass && showOutput) {
    const snippet = c.output.length > 200 ? `${c.output.slice(0, 200)}…` : c.output;
    lines.push(`      ${paint(ANSI.dim, `output: ${JSON.stringify(snippet)}`)}`);
  }
  return lines.join("\n");
}

export function createConsoleReporter(options: ConsoleReporterOptions = {}): Reporter {
  const color = options.color ?? false;
  const showOutput = options.showOutputOnFail ?? true;
  const paint = makePaint(color);

  return {
    name: "console",
    render(verdict: SuiteVerdict): string {
      const lines: string[] = [];
      lines.push(paint(ANSI.bold, `PromptProof — ${verdict.name}`));
      lines.push("");
      for (const c of verdict.cases) {
        lines.push(renderCase(c, paint, showOutput));
      }
      lines.push("");
      const summaryColor = verdict.pass ? ANSI.green : ANSI.red;
      const status = verdict.pass ? "PASS" : "FAIL";
      lines.push(
        paint(
          summaryColor,
          `${status}  ${verdict.passed}/${verdict.total} cases passed` +
            (verdict.failed ? `, ${verdict.failed} failed` : "") +
            paint(ANSI.dim, `  (${verdict.durationMs}ms)`),
        ),
      );
      return lines.join("\n");
    },
  };
}

/** Default color-less console reporter registered into the registry. */
export const consoleReporter = createConsoleReporter();
