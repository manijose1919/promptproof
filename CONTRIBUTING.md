# Contributing to PromptProof

Thanks for your interest! PromptProof (Free tier) is MIT-licensed and welcomes
contributions — bug fixes, new assertions/reporters, docs, and tests.

## Development setup

```bash
npm install
npm test          # 68 tests (requires Node >= 20; Vitest 4)
npm run build     # tsup -> dist/
npx tsc --noEmit  # strict typecheck
```

> Runtime supports Node ≥ 18, but the test tooling (Vitest 4) needs Node ≥ 20.

## Project shape

```
src/
  core/         types, config loader, registry, runner   (the stable contract)
  providers/    replay (deterministic, offline)
  assertions/   equals, contains, regex, json-schema
  reporters/    console, junit, github
  index.ts      createFreeRegistries() + public API
  cli.ts        the `promptproof` command
```

New capabilities plug into the **registries** — you rarely touch the core.

## Adding an assertion (example)

1. Create `src/assertions/<name>.ts` exporting an `Assertion` (`type` + `evaluate`).
   Validate your own config with `zod`; throw `AssertionConfigError` on bad input.
2. Register it in `src/assertions/index.ts`.
3. Add tests in `src/assertions/assertions.test.ts` covering pass, fail, and edge cases.
4. Document it in `HOW-TO.md`.

## Tier boundary (important)

This is the **Free** repository. Its source must **never import** `premium` or
`pro` modules — that separation is what keeps the Free build shippable standalone,
and CI enforces it. Premium/Pro features live in the commercial product.

## Pull requests

- Keep PRs focused. One capability or fix per PR.
- Include tests. CI runs `tsc`, `vitest`, and `build` on Node 20/22 (plus a Node 18
  runtime smoke test).
- Match the surrounding code style (strict TS, small pure functions, clear errors).

## Reporting bugs / security

- Bugs: open an issue using the **Bug report** form.
- Security: please use private advisories — see [`SECURITY.md`](./SECURITY.md).

By contributing, you agree your contributions are licensed under the MIT License.
