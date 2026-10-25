# web-tools

Small client-side developer tools (timestamp converter, JWT decoder, JSON utilities, etc.). Vite + React + TypeScript + Mantine, pnpm. No backend; user input must never leave the browser.

## Commands

- `pnpm dev` — dev server
- `pnpm lint` — ESLint (flat config) with auto-fix; also owns formatting via `@stylistic`, so there is no Prettier
- `pnpm test` — Vitest
- `pnpm build` — typecheck + production build

## Conventions

- Strict TypeScript; avoid `any`, use `unknown` when a type is uncertain
- Function components and hooks only
- Each tool lives in `src/tools/<name>/`, keeps its logic in pure functions (unit-tested) separate from the component, and is registered in `src/tools.ts`
- Prefer Mantine components and hooks over hand-rolled equivalents
- Lazy-load heavy dependencies (e.g. a code editor) so the home page stays small
- Meet WCAG AA: labels on inputs, keyboard access, sufficient contrast
