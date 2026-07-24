# Changelog

All notable changes to **PromptProof** (Free tier) are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-07-24

First stable release.

### Added
- **`replay` provider** — deterministic, offline record-replay (zero API cost in CI).
- **Assertions** — `equals`, `contains` (arrays + all/any + negate), `regex`
  (flags + negate), `json-schema` (subset validator with union-type support).
- **Reporters** — `console` (TTY-aware color), `junit` (CI-native XML with actual
  output in failure bodies), `github` (PR `::error` annotations + Markdown job summary).
- **CLI** — `run` and `list` commands, non-zero exit on failure (CI gate),
  per-case provider timeout (default 30s), `--reporter`/`--output`/`--provider`/`--timeout`.
- **GitHub Action** — reusable `action.yml` plus an example workflow.
- **Docs** — `README`, `SETUP`, `HOW-TO`, `SECURITY`.

### Engineering
- Strict TypeScript (`noUncheckedIndexedAccess`), ESM, Node ≥ 18.
- 68 tests passing · `tsup` build · 3 runtime dependencies.

[1.0.0]: https://github.com/manijose1919/promptproof/releases/tag/v1.0.0
