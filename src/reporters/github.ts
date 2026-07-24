/**
 * `github` reporter (FREE) — GitHub Actions native output.
 *
 * Emits two things in one string:
 *   1. Workflow-command annotations (`::error::`) for each failing case, which
 *      GitHub surfaces inline on the PR "Files changed" and in the checks panel.
 *   2. A Markdown summary table suitable for `$GITHUB_STEP_SUMMARY`.
 *
 * Pure: returns a string; the CLI prints it (annotations must be on stdout during
 * the step for Actions to pick them up).
 */

import type { CaseVerdict, Reporter, SuiteVerdict } from "../core/types.js";

/** Workflow commands are newline/`::`-sensitive; escape per GitHub's spec. */
function escapeData(s: string): string {
  return s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
function escapeProp(s: string): string {
  return escapeData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

function annotation(c: CaseVerdict): string {
  const reason = c.error
    ? c.error
    : c.assertions
        .filter((a) => !a.pass)
        .map((a) => `${a.type}: ${a.message}`)
        .join(" | ");
  return `::error title=${escapeProp(`PromptProof: ${c.name}`)}::${escapeData(truncate(reason) || "case failed")}`;
}

function statusEmoji(c: CaseVerdict): string {
  if (c.error) return "⚠️";
  return c.pass ? "✅" : "❌";
}

const MAX_DETAIL = 300;
function truncate(s: string): string {
  return s.length > MAX_DETAIL ? `${s.slice(0, MAX_DETAIL)}…` : s;
}

export function createGitHubReporter(): Reporter {
  return {
    name: "github",
    render(v: SuiteVerdict): string {
      const lines: string[] = [];

      // 1. Annotations for every failing/errored case.
      for (const c of v.cases) {
        if (!c.pass) lines.push(annotation(c));
      }

      // 2. Markdown job summary.
      lines.push("");
      lines.push(`## PromptProof — ${v.name}`);
      lines.push("");
      lines.push(v.pass ? `**✅ PASS** — ${v.passed}/${v.total} cases passed.` : `**❌ FAIL** — ${v.failed} of ${v.total} cases failed.`);
      lines.push("");
      lines.push("| Case | Result | Detail |");
      lines.push("| --- | :---: | --- |");
      for (const c of v.cases) {
        const detail = c.error
          ? c.error
          : c.pass
            ? "—"
            : c.assertions.filter((a) => !a.pass).map((a) => `\`${a.type}\`: ${a.message}`).join("<br>");
        // Escape pipe chars so the Markdown table isn't broken by output content,
        // and truncate to keep the job summary from ballooning on large outputs.
        const safeDetail = truncate(detail).replace(/\|/g, "\\|").replace(/\n/g, " ");
        lines.push(`| ${c.name.replace(/\|/g, "\\|")} | ${statusEmoji(c)} | ${safeDetail} |`);
      }
      lines.push("");
      lines.push(`_Ran in ${v.durationMs}ms._`);
      return lines.join("\n");
    },
  };
}

export const githubReporter = createGitHubReporter();
