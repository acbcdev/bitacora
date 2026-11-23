#!/usr/bin/env bash
# Reglas mecánicas del repo. Juicio → CODING_STANDARDS.md.
set -euo pipefail
if git grep --untracked -nE 'text-\[[0-9.]+(px|rem)\]' src; then
  echo "✗ text-[Npx]: usá la escala Tailwind (text-sm, text-lg…)" >&2
  exit 1
fi
