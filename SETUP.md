# SETUP — PromptProof (Free)

This guide gets you from a fresh clone to a green test run.

## Prerequisites

- **Node.js ≥ 18** (uses native `fetch` and ESM). Check with `node --version`.
- npm (bundled with Node).

## 1. Install dependencies

```bash
npm install
```

## 2. Build

```bash
npm run build
```

This bundles `src/` into `dist/` (ESM + type declarations) via `tsup`:

- `dist/cli.js` — the `promptproof` command
- `dist/index.js` — the programmatic API

## 3. Run the test suite (the tool's own tests)

```bash
npm test
```

You should see **68 passing** tests.

## 4. Try the CLI

```bash
# List registered capabilities
node dist/cli.js list

# Run the bundled example suite (fully offline)
node dist/cli.js run examples/greeting.suite.yaml
```

Or during development, without building:

```bash
npm run dev -- run examples/greeting.suite.yaml
```

## 5. Use it in your project

```bash
npm install --save-dev promptproof
npx promptproof run path/to/your-suite.yaml
```

## CLI reference

```
promptproof run <suite> [options]
  -r, --reporter <name>   console | junit | github  (default: console)
  -o, --output <file>     write report to a file
      --color / --no-color  colour (default: auto-detect TTY)
  -p, --provider <name>   default provider          (default: replay)
  -t, --timeout <ms>      per-case timeout          (default: 30000)

promptproof list          Show registered providers, assertions, reporters
```

### GitHub Action

This package ships a reusable Action (`action.yml`). In a workflow:

```yaml
- uses: promptproof/promptproof-action@v1
  with:
    suite: prompts/suite.yaml
    reporter: github   # console | junit | github
```

**Exit codes:** `0` all passed · `1` one or more failed · `2` usage/config error.

## Environment variables

The Free tier needs **none** — everything runs offline via the `replay` provider.
(`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` are only used by the Premium build.)

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Unknown provider 'openai'` | That's a Premium provider. The Free build only ships `replay`. |
| `Replay provider has no recorded response for case '<x>'` | Add `<x>` under `providers.replay.responses`, or set `providers.replay.strict: false`. |
| `Cannot parse YAML in '<file>'` | Your suite file has a YAML syntax error — check indentation. |
| Suite "is a top-level list" | Wrap your cases under a `cases:` key. |
