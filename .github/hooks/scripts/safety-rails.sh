#!/bin/bash
# PreToolUse safety hook — blocks destructive commands.
# Receives JSON on stdin. Checks shell commands for dangerous patterns.
set -e

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('toolName',''))" 2>/dev/null || echo "")

# Only check terminal/shell tools
case "$TOOL_NAME" in
  run_in_terminal|run_shell|execute) ;;
  *) exit 0 ;;
esac

CMD=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
inp = d.get('toolInput', {})
print(inp.get('command', ''))
" 2>/dev/null || echo "")

# Blocked patterns — these need human confirmation
BLOCKED=0
REASON=""

case "$CMD" in
  *"rm -rf"*|*"rm -r /"*)
    BLOCKED=1; REASON="Recursive delete detected" ;;
  *"DROP TABLE"*|*"DROP DATABASE"*|*"TRUNCATE"*)
    BLOCKED=1; REASON="Destructive SQL detected" ;;
  *"git push --force"*|*"git push -f"*)
    BLOCKED=1; REASON="Force push detected" ;;
  *"git reset --hard"*)
    BLOCKED=1; REASON="Hard reset detected" ;;
  *"> /dev/"*|*"mkfs"*|*"dd if="*)
    BLOCKED=1; REASON="Destructive system command detected" ;;
  *"curl"*"| bash"*|*"curl"*"| sh"*)
    BLOCKED=1; REASON="Pipe-to-shell detected" ;;
esac

if [ "$BLOCKED" -eq 1 ]; then
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "$REASON"
  }
}
EOF
else
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow"
  }
}
EOF
fi
