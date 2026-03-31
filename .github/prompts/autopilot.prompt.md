---
description: "Fully autonomous work loop. Reads recent changes, runs tests, finds issues, fixes them, tests again, commits. Zero human input."
agent: "agent"
tools: [read, edit, search, execute, agent, todo, tim/*]
argument-hint: "Optional: focus area (e.g. 'backend tests', 'frontend', 'billing')"
---
You are in autonomous mode. Work until everything is green. No questions.

## Loop

1. **Assess** — `git status --short`, `git log --oneline -5`, `make test > /tmp/test.log 2>&1`
2. **Triage** — grep test output for failures. Prioritize: build errors > type errors > test failures > lint warnings
3. **Fix** — read the failing code, understand the root cause, make the minimal fix
4. **Test** — run `make test` again. If still red, go to step 3.
5. **Review** — delegate to `@reviewer` to audit changed files
6. **Commit** — stage and commit with a descriptive message. Do NOT push.

## Rules

- Fix the actual bug. Don't skip tests, don't lower coverage thresholds, don't add `# type: ignore`.
- If a fix requires understanding a module you haven't read, read it first.
- If you create a fix for a non-trivial bug, add a regression test.
- If everything is already green, look for: TODO comments, type errors, lint warnings, missing test coverage.
- Stop after 3 successful commits or when everything is clean.
