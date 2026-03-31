---
description: "Pre-deploy audit: run tests, check types, review recent changes for security issues."
agent: "agent"
argument-hint: "Optional: specific area to focus on"
tools: [read, search, execute, agent]
---
Run the full pre-deploy checklist:

1. **Tests**: Run `make test` and capture output. All must pass.
2. **Type check**: Run `python3 -m mypy app/ --ignore-missing-imports`
3. **Recent changes**: Run `git log --oneline -10` and `git diff HEAD~3 --stat`
4. **Security audit**: Delegate to `@reviewer` to audit any changed Python files
5. **Report**: Summarize results — pass/fail for each step, any findings from reviewer

Stop and report if any step fails. Do not proceed to deploy.
