# web-tools

Small client-side developer tools (timestamp converter, JWT decoder, JSON utilities, etc.). Vite + React + TypeScript + Mantine, pnpm. No backend; user input must never leave the browser.

## Commands

- `pnpm dev` — dev server
- `pnpm lint` — ESLint (flat config) with auto-fix; also owns formatting via `@stylistic`, so there is no Prettier
- `pnpm test` — Vitest
- `pnpm test:e2e` — Playwright smoke tests against the production build (needs `pnpm exec playwright install chromium` once)
- `pnpm build` — typecheck + production build

## Conventions

- Strict TypeScript; avoid `any`, use `unknown` when a type is uncertain
- Function components and hooks only
- Every new tool needs a render check and a core-interaction test in `e2e/tools.spec.ts`; the render check iterates `src/tools.ts` automatically
- Each tool lives in `src/tools/<name>/`, keeps its logic in pure functions (unit-tested) separate from the component, and is registered in `src/tools.ts`
- Prefer Mantine components and hooks over hand-rolled equivalents
- Lazy-load heavy dependencies (e.g. a code editor) so the home page stays small
- Meet WCAG AA: labels on inputs, keyboard access, sufficient contrast
