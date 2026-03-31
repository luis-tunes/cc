---
description: "Use when editing React frontend code: components, hooks, pages, styles, API client, TypeScript."
applyTo: "frontend/src/**"
---
# Frontend Rules

- **Stack**: React 18 + TypeScript strict + Tailwind CSS + Vite.
- **Language**: All user-facing text in Portuguese. Code in English.
- **Structure**: Hooks in `hooks/use-*.ts`. Pages in `pages/`. Shared UI in `components/ui/`.
- **API**: All backend calls go through `lib/api.ts`. Never call `fetch()` directly.
- **Types**: No `any`. Explicit types on function signatures. Interfaces over types for objects.
- **Tests**: vitest. Run `cd frontend && npx vitest run` or just `make test`.
- **Theming**: CSS custom properties in `index.css`. Dark mode via class strategy.
- **State**: React hooks for local state. No global state library. Server state via custom hooks.
- **Components**: Props interface above component. Named exports. One component per file for pages.
