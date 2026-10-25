# web-tools

A collection of small, single-purpose developer tools for the one-off tasks that come up while programming. Each tool does one thing, runs in the browser, and works without an account or a server round-trip.

## Planned tools

| Tool | Description |
| --- | --- |
| Timestamp converter | Convert between Unix epoch, ISO 8601, and human-readable dates, with timezone support |
| URI encode / decode | Percent-encode and decode URI components and full URIs |
| JSON prettify | Format, minify, and validate JSON |
| JSON Schema editor | Author and edit JSON Schemas |
| JSON Schema validator | Validate a JSON document against a schema and show errors |
| Base64 encode / decode | Encode and decode Base64 (standard and URL-safe) |
| JWT decoder | Inspect JWT header and payload, and check expiry claims |

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

New tool ideas are welcome. Add them to the table above, then open a PR with the implementation.

## License

TBD
