# HOW-TO — Writing PromptProof suites (Free)

A practical, task-oriented guide. For install/build see [`SETUP.md`](./SETUP.md).

## The mental model

A **suite** is a YAML file with **cases**. Each case sends `messages` to a **provider**
and checks the output with one or more **assertions**. A case passes when **every**
assertion passes. The suite passes when **every** case passes.

```
suite → cases → (messages → provider → output) → assertions → verdict
```

## Recipe 1 — A deterministic offline regression gate (recommended)

The Free `replay` provider returns a pre-recorded output per case, keyed by the
**case name**. This makes your suite reproducible and free to run in CI.

```yaml
name: support-bot regression
provider: replay
providers:
  replay:
    responses:
      "apologizes for a late order": "I'm so sorry your order is late — let me help fix that."
cases:
  - name: apologizes for a late order
    messages:
      - role: user
        content: "My order is 3 days late!"
    assert:
      - type: contains
        value: ["sorry", "apolog"]
        all: false
        ignoreCase: true
```

> **How do I get the recorded responses?** Run your prompts against your real LLM
> once (via the Premium build or your own script), paste the outputs into
> `responses`, and commit them. From then on, CI replays them for free. When you
> intentionally change a prompt, update the recording — the diff is your review.

## Recipe 2 — Validate structured (JSON) output

The `json-schema` assertion parses the output as JSON and validates its shape —
the workhorse for testing tool-calling / structured-output prompts.

```yaml
- type: json-schema
  schema:
    type: object
    required: ["intent", "confidence"]
    additionalProperties: false
    properties:
      intent: { type: string, enum: ["refund", "status", "cancel"] }
      confidence: { type: number, minimum: 0, maximum: 1 }
      notes: { type: ["string", "null"] }   # union types supported
```

If the model returns invalid JSON, or the shape is wrong, the case fails with a
precise message (e.g. `missing required property 'confidence'`).

## Recipe 3 — Guard against prompt-injection / leaks

Use `regex` or `contains` with `negate` to assert something is **absent**:

```yaml
- type: regex
  pattern: "system prompt|api[_-]?key|BEGIN PRIVATE KEY"
  flags: "i"
  negate: true       # FAIL if any of these appear in the output
```

## Assertion cheat-sheet

| Type | Key options | Passes when |
|---|---|---|
| `equals` | `value`, `trim`, `ignoreCase` | output equals `value` |
| `contains` | `value` (string/array), `all`, `ignoreCase`, `negate` | substring(s) present (or absent if `negate`) |
| `regex` | `pattern`, `flags`, `negate` | pattern matches (or not) |
| `json-schema` | `schema`, `parse` | parsed JSON matches the schema |

## Reporters

```bash
promptproof run suite.yaml                       # console (default)
promptproof run suite.yaml -r junit -o out.xml   # JUnit XML for CI
promptproof run suite.yaml -r github             # GitHub Actions annotations + summary
```

### The `github` reporter

Designed for GitHub Actions. It prints two things:

1. `::error title=…::…` **annotations** for each failing case — GitHub shows
   these inline on the PR's "Files changed" tab and in the checks panel.
2. A **Markdown summary table** you can pipe into the job summary:

```yaml
- run: npx promptproof run suite.yaml --reporter github | tee -a "$GITHUB_STEP_SUMMARY"
```

Or just use the bundled Action, which wires this up for you (see `action.yml`).

## Handling failures

A failing run shows exactly which assertion failed and the actual output:

```
  ✖ apologizes for a late order
      - contains: expected output to contain "sorry" OR "apolog"
      output: "Your order will arrive soon."

FAIL  0/1 cases passed, 1 failed
```

Exit code `1` fails your CI job.

## Timeouts

Every case has a 30s provider timeout by default (so a hung provider can't hang
CI). Tune with `--timeout <ms>`; set `--timeout 0` to disable (not recommended).

## When to reach for Premium

- Output varies too much for exact/substring checks → **`similarity`** (Premium).
- You need to grade tone/helpfulness/correctness → **`llm-judge`** (Premium).
- You want to run against real OpenAI/Anthropic in the loop → **Premium providers**.
- You want shareable HTML dashboards → **Pro**.

See **promptproof.dev** to upgrade.
