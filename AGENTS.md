# TIM

Portuguese accounting SaaS. FastAPI + React. PostgreSQL. Docker.

```
make dev     # run
make test    # test
make deploy  # ship
```

`app/` is backend. `frontend/src/` is frontend. `bin/` is scripts. Read them.

## Hard Rules

### How You Work

- Use every tool available. Read files before editing. Search before guessing.
- When something fails, debug it. Read the traceback. Read the code. Fix the root cause.
- Never give up. Iterate until it works. Run tests, fix failures, run again.
- When a fix is non-trivial, add a test that would have caught it. Run the full suite.
- Run `make test` before declaring anything done. All tests must pass.
- Use subagents for exploration. Don't clutter the main thread with 20 search calls.
- Don't ask permission for reversible actions. Edit files, run commands, read code.
- If blocked, try a different approach. Two failures on the same path = step back and rethink.

### How You Code

- No new dependencies without asking.
- No new files when editing an existing one works.
- No comments on obvious things. No docstrings on private functions.
- No over-engineering. No abstractions for one-time operations.
- No ORM. SQL strings in the module that uses them.
- Errors raise. Don't return None.
- One function, one job. Extract on third repeat.
- Type hints on signatures. mypy must pass.
- Pydantic at API boundaries only.
- Decimal for money. Never float.
- UTC storage. Europe/Lisbon display.
- Test with pytest. `thing_test.py`, not `test_thing.py`.
- Batch DB queries. Never N+1.
- UI text in Portuguese. Code, comments, commits in English.
- `bin/` scripts are source of truth. Makefile calls `bin/`. CI calls `make`.
