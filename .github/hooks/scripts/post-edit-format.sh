#!/bin/bash
# Post-edit auto-format for Python files.
# Receives JSON on stdin with tool details, runs ruff format on edited Python files.
set -e

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('toolName',''))" 2>/dev/null || echo "")

# Only run after file edit tools
case "$TOOL_NAME" in
  replace_string_in_file|create_file|multi_replace_string_in_file) ;;
  *) exit 0 ;;
esac

# Extract file path from tool input
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
inp = d.get('toolInput', {})
print(inp.get('filePath', inp.get('path', '')))
" 2>/dev/null || echo "")

# Only format Python files
case "$FILE_PATH" in
  *.py)
    if [ -f "$FILE_PATH" ]; then
      ruff format "$FILE_PATH" 2>/dev/null || true
      ruff check --fix "$FILE_PATH" 2>/dev/null || true
    fi
    ;;
esac

exit 0
