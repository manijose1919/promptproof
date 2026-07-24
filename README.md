# PromptProof — Jest for prompts

[![tests](https://img.shields.io/badge/tests-68%20passing-brightgreen)](#) [![version](https://img.shields.io/badge/version-1.0.0-blue)](#) [![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE) [![node](https://img.shields.io/badge/node-%3E%3D18-informational)](#)

**Regression-test your LLM features the way you test everything else.** PromptProof runs prompt test suites, checks the output against assertions, and **fails your CI build** when a prompt regresses — all **fully offline** and **free**.

> A prompt tweak that improves one case silently breaks ten others. PromptProof catches that before your customers do.

## Why the Free tier is genuinely useful

The Free tier ships a **record-replay provider**: record your real LLM outputs once, commit them, and every CI run replays them deterministically with **zero API cost and zero flakiness**. You get a real regression gate without paying per-token to run your test suite.

## Install

```bash
npm install --save-dev promptproof
# or run without installing:
npx promptproof run suite.yaml
```

## 60-second example

Create `suite.yaml`:

```yaml
name: customer greeting bot
provider: replay

providers:
  replay:
    responses:
      "greets the customer by name": "Hi Dana! How can I help you today?"

cases:
  - name: greets the customer by name
    messages:
      - role: system
        content: You are a friendly agent. Greet the customer by name.
      - role: user
        content: "Hi, this is Dana."
    assert:
      - type: contains
        value: "Dana"
      - type: regex
        pattern: "system prompt|internal instructions"
        negate: true
```

Run it:

```bash
npx promptproof run suite.yaml
```

```
PromptProof — customer greeting bot

  ✔ greets the customer by name

PASS  1/1 cases passed  (1ms)
```

Exit code is **0** on pass, **1** on any failure — so it gates CI out of the box.

## Free-tier capabilities

| Category | Included (Free) |
|---|---|
| **Provider** | `replay` (deterministic, offline record-replay) |
| **Assertions** | `equals`, `contains`, `regex`, `json-schema` |
| **Reporters** | `console`, `junit` (CI-native XML), `github` (PR annotations + job summary) |
| **CLI** | `run`, `list`, exit-code gating, per-case timeout, TTY-aware color |
| **Integration** | reusable **GitHub Action** (`action.yml`) |

Run `promptproof list` to see everything registered.

## Assertions at a glance

```yaml
assert:
  - type: equals            # exact match (with trim / ignoreCase)
    value: "OK"
  - type: contains          # substring(s); arrays + all/any + negate
    value: ["hello", "hi"]
    all: false
    ignoreCase: true
  - type: regex             # pattern match (+ flags, negate)
    pattern: "^\\{.*\\}$"
  - type: json-schema       # validate STRUCTURED output (the workhorse)
    schema:
      type: object
      required: ["orderId", "status"]
      properties:
        status: { type: string, enum: ["pending", "shipped", "delivered"] }
```

## CI integration (GitHub Actions)

**Option A — the reusable Action** (annotates the PR and writes a job summary):

```yaml
- uses: promptproof/promptproof-action@v1
  with:
    suite: prompts/suite.yaml
    reporter: github
```

**Option B — the CLI directly:**

```yaml
- run: npx promptproof run suite.yaml --reporter junit --output results.xml
```

The `github` reporter emits `::error` annotations that appear inline on the PR's
changed files, plus a Markdown table in the job summary. Either way, the non-zero
exit on failure fails the job. See [`examples/github-workflow.yml`](./examples/github-workflow.yml).

## Upgrade to Premium / Pro

Hitting the limits of exact-string checks or want real providers in the loop?

| | **Free** | **Premium** | **Pro** |
|---|:--:|:--:|:--:|
| Replay provider, 4 assertions, console/junit | ✅ | ✅ | ✅ |
| Real providers (OpenAI, Anthropic) | — | ✅ | ✅ |
| `similarity` (semantic-ish) & `llm-judge` assertions | — | ✅ | ✅ |
| HTML dashboard reporter | — | — | ✅ |
| Hosted history, trends, A/B experiments | — | — | ✅ |

Learn more at **promptproof.dev** — or see [`HOW-TO.md`](./HOW-TO.md) for a deeper guide.

## License

MIT — see [`LICENSE`](./LICENSE). Use it freely, forever.
