#!/usr/bin/env bash
# Grep user-facing strings for banned internals. Exit 0 when clean.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TERMS_FILE="${ROOT}/.ui-copy-terms"
if [[ ! -f "$TERMS_FILE" ]]; then
  TERMS_FILE="${HOME}/.config/chigozie-rules/ui-copy-terms.txt"
fi
if [[ ! -f "$TERMS_FILE" ]]; then
  TERMS_FILE="${ROOT}/scripts/ui-copy-terms.txt"
fi

TARGETS=("$@")
if [[ ${#TARGETS[@]} -eq 0 ]]; then
  TARGETS=("apps/admin")
fi

PATTERN="$(grep -vE '^\s*(#|$)' "$TERMS_FILE" | paste -sd'|' -)"
if [[ -z "$PATTERN" ]]; then
  echo "copy-lint: no terms"
  exit 0
fi

hits=0
while IFS= read -r -d '' file; do
  if grep -nEi "$PATTERN" "$file" | grep -v 'ui-copy-ignore' | grep -v '^\s*//' | grep -v '^\s*\*'; then
    echo "::error::copy-lint hit in $file"
    grep -nEi "$PATTERN" "$file" | grep -v 'ui-copy-ignore' || true
    hits=$((hits + 1))
  fi
done < <(find "${TARGETS[@]}" -type f \( -name '*.tsx' -o -name '*.jsx' -o -name '*.html' -o -name '*.json' \) \
  ! -path '*/node_modules/*' ! -path '*/dist/*' ! -path '*/.wrangler/*' -print0 2>/dev/null)

if [[ $hits -gt 0 ]]; then
  echo "copy-lint: FAILED ($hits file(s))"
  exit 1
fi
echo "copy-lint: clean"
exit 0
