---
description: "Use when editing React frontend code: components, hooks, pages, styles, API client."
applyTo: "frontend/src/**"
---
# Frontend Rules

- React 18 + TypeScript strict mode + Tailwind CSS.
- All user-facing text in Portuguese.
- Hooks in `hooks/`, pages in `pages/`, shared UI in `components/ui/`.
- API client in `lib/api.ts` — all backend calls go through it.
- Use `vitest` for tests. Run with `make test` or `cd frontend && npx vitest run`.
- No `any`. Prefer explicit types over inference for function signatures.
- CSS custom properties for theming — defined in `index.css`.
