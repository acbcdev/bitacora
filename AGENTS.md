# AGENTS.md

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

pnpm only (never npx); format with oxfmt (`pnpm format`).

UI work: read `docs/design-system.md` and `docs/ui-principles.md` first.

Reviewing a diff: apply `CODING_STANDARDS.md`.
