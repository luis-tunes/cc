#!/bin/bash
# SessionStart hook — injects current project state as context.
# The agent starts every session knowing: git status, recent changes, test health.
set -e

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
cd "$ROOT"

# Gather context
GIT_STATUS=$(git status --short 2>/dev/null | head -20 || echo "no git")
GIT_LOG=$(git log --oneline -5 2>/dev/null || echo "no log")
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
DIRTY_COUNT=$(git status --short 2>/dev/null | wc -l || echo "0")

# Build system message
MSG="## Session Context (auto-injected)
**Branch:** $BRANCH | **Uncommitted files:** $DIRTY_COUNT
**Recent commits:**
$GIT_LOG"

if [ "$DIRTY_COUNT" -gt 0 ]; then
  MSG="$MSG

**Uncommitted changes:**
$GIT_STATUS"
fi

# Output as JSON with systemMessage
cat <<EOF
{
  "systemMessage": "$( echo "$MSG" | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g' )"
}
EOF
