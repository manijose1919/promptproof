# Security Policy — PromptProof

## Runtime dependency posture

The shipped package depends on exactly three runtime libraries — `commander`,
`yaml`, and `zod` — all widely used and actively maintained. **No runtime
vulnerabilities** are known against the shipped `dist/`.

## Known, accepted dev-only advisory

`npm audit` reports **one low-severity advisory** in `esbuild` (GHSA-g7r4-m6w7-qqqr:
"arbitrary file read when running the esbuild dev server on Windows"), reached
transitively through our build tool `tsup`.

**Assessment — accepted, not shipped:**

- `esbuild` is a **build-time-only** dependency (`devDependencies`), never bundled
  into `dist/` and never present in a consumer's runtime.
- The advisory affects **`esbuild`'s dev server**, which `tsup`'s bundle command
  **does not start**. There is no dev server running during our build.
- Remediation requires a `tsup` release pinning a newer `esbuild`; forcing an
  incompatible downgrade would break the build for no runtime benefit.

We track this for an upstream `tsup` bump and will update when available.

## Handling of secrets

- The Free tier requires **no** credentials and makes **no** network calls.
- Premium providers read API keys from environment variables
  (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) or per-suite config. **Do not commit
  keys**; prefer environment variables and reference them from CI secrets.
- Provider error messages truncate response bodies and never echo your API key.

## Handling of untrusted model output

- The `json-schema` assertion uses `JSON.parse` (no code execution) and guards
  object-key handling against prototype-pollution keys via `hasOwnProperty`.
- The `html` reporter HTML-escapes **all** case names and model output, so a
  malicious/model-generated `<script>` cannot execute in a hosted report.
- The `junit` reporter XML-escapes output and strips XML-illegal control chars.

## Reporting a vulnerability

Email **security@promptproof.dev** with details and reproduction steps. Please do
not open public issues for security reports. We aim to acknowledge within 3
business days.
