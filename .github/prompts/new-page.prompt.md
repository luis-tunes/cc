---
description: "Scaffold a new React page with hook, API call, and Portuguese UI text."
agent: "agent"
argument-hint: "Page name and what it displays"
tools: [read, edit, search, tim/*]
---
Create a new frontend page following TIM conventions:

1. Read an existing page in `frontend/src/pages/` for the pattern
2. Read `frontend/src/lib/api.ts` for the API client pattern
3. Create:
   - `frontend/src/pages/{PageName}.tsx` — the page component
   - `frontend/src/hooks/use-{feature}.ts` — data fetching hook (if needed)
   - Add route to `frontend/src/App.tsx`

Pattern for pages:
```tsx
interface Props {}

export default function PageName() {
  const { data, loading } = useFeature();
  if (loading) return <div>A carregar...</div>;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Título em Português</h1>
      {/* content */}
    </div>
  );
}
```

Rules:
- All visible text in Portuguese
- Use Tailwind classes, no inline styles
- Use custom hooks for data fetching, not raw useEffect
- API calls go through `lib/api.ts`
