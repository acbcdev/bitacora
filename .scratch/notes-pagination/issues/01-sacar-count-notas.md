# Notas paginadas por API con cache local — sacar el count

Status: needs-triage

## Contexto

Intención (sesión design-system, 2026-10-13): las notas se piden por página a la API y se guardan en
local para paginar, en vez de bajar el snapshot completo. Con eso el total de notas por notebook deja
de ser gratis: hoy sale de recorrer todas las notas en `src/core/store/derive.ts:110`.

## Qué

1. Quitar de la UI el count de notas: chip `N notas` en `notebooks/notebook-card.tsx` y el número de
   "Notas sueltas" — antes del refactor de fetch, así nada visible se rompe.
2. Decidir `rounds`: sale del mismo `derive` — ¿se puede calcular sin todas las notas?
3. Diseñar el fetch paginado + cache local (grill pendiente).
