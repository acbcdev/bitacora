# Repaso: J/K bare → ←/→

**Status:** to-do
**Origen:** grill `note-draft-unify` 2026-10-05
**Decisión a escribir:** ADR nuevo que enmienda 0017 (las letras escriben; J/K eran resto de v1)

## Problema

`review.tsx:116-117` registra `j` (prev) y `k` (next) como letras bare, contra ADR 0017.
Bloquea type-to-focus en el diálogo de Repaso.

## Tareas

- [ ] `j`/`k` → `left`/`right` en `review.tsx` (solo lista, sin editor enfocado: no pisan el caret)
- [ ] Actualizar tests de `review.test.tsx` y cualquier hint de UI que nombre J/K
- [ ] ADR enmendando 0017

## Comments
