# web-tools

A collection of small, single-purpose developer tools for the one-off tasks that come up while programming. Each tool does one thing, runs in the browser, and works without an account or a server round-trip.

## Tools

| Tool | Description |
| --- | --- |
| Timestamp converter | Unix epoch (seconds to nanoseconds), ISO 8601 and free-form dates in any timezone |
| Cron explainer | Plain-English description of a 5-field cron expression, with its next runs |
| JWT decoder | Decode header and payload, check expiry, verify HS/RS/PS/ES signatures |
| Base64 encode / decode | Standard and URL-safe, UTF-8 safe |
| URI encode / decode | Component and full-URI modes |
| UUID / ULID | Generate v4, v7 and ULIDs; inspect any ID for its version and timestamp |
| Hash / HMAC generator | MD5, SHA-1, SHA-256, SHA-384, SHA-512 of text or a file, with optional HMAC |
| JSON prettify / minify | Format, minify and sort JSON with folding and inline errors |
| JSON Schema editor | Write a schema with keyword hints and test it against sample data |
| JSON Schema validator | Validate data against a schema (Draft 2020-12, 2019-09 or draft-07) |

## Principles

- **Local only.** Input never leaves the browser.
- **One tool, one page.** Each tool is self-contained and fast to open.
- **Paste in, copy out.** Minimal UI, sensible defaults, easy copying of results.

## Stack

Vite, React, TypeScript, [Mantine](https://mantine.dev), Vitest. Linting and formatting are handled by ESLint (flat config with `@stylistic`). The site is static and deploys to GitHub Pages.

## Getting started

Requires Node 22+ and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev        # start the dev server
pnpm lint       # lint and auto-fix
pnpm test       # run unit tests
pnpm test:e2e   # run browser tests (first: pnpm exec playwright install chromium)
pnpm build      # typecheck and build to dist/
```

## Adding a tool

Create `src/tools/<name>/`, keep the logic in pure, tested functions separate from the React component, and register it in `src/tools.ts`.

## Contributing

New tool ideas are welcome. Add the tool to `src/tools.ts` and the table above, with unit tests for its logic and an end-to-end test in `e2e/`.

## License

TBD
