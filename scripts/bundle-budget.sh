#!/usr/bin/env bash
# Gzip budget for dist/ (KB = 1000). Limits = measured with Sentry (2026-11-08) + ~15%.
set -euo pipefail
INITIAL_KB=${INITIAL_KB:-415}     # measured 360: entry + modulepreload from dist/index.html
NOTE_BODY_KB=${NOTE_BODY_KB:-405} # measured 350: note-body-* (tiptap, lazy)

fail=0
check() { # name bytes limit_kb
  local kb=$(($2 / 1000))
  echo "$1: ${kb} KB gz (limit $3 KB)"
  if [ "$kb" -gt "$3" ]; then
    echo "FAIL: $1 is ${kb} KB gz, over the $3 KB budget" >&2
    fail=1
  fi
}

gz() { # sum of per-file gzip -6 sizes
  local total=0
  for f in "$@"; do total=$((total + $(gzip -6c "$f" | wc -c))); done
  echo "$total"
}

# shellcheck disable=SC2046
check "initial load" "$(gz $(grep -oE '(src|href)="/assets/[^"]+\.js"' dist/index.html | sed -E 's|.*"/(.*)"|dist/\1|'))" "$INITIAL_KB"
check "note-body" "$(gz dist/assets/note-body-*.js)" "$NOTE_BODY_KB"
exit $fail
