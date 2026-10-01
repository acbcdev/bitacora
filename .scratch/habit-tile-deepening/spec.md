# Hábitos: concentrar el wiring de tiles/acciones en un módulo `Hábito`

**Status:** deferred (grill 2026-10-01)
**Origen:** review `architecture-review-20260929` candidato 3 (marcado _Worth exploring_)

## Problema

La regla del ciclo del Cronómetro (pausar → fila del `startedDay` → auto-finish → play de otro)
está partida entre `habit-tiles.tsx`, `habit-tile-info.tsx` y `habit-tile-actions.tsx` —
3 módulos pasándose `{startedState, shown, clock, tiles running}` por props. Commit `853d545`:
cambiar el total del período tocó 6 archivos, sin contar el panel. El quick-label se deriva
en el caller.

## Forma propuesta (por decidir cuando se retome)

Deepen alrededor del hook de tile que ya casi existe: quick + máquina del cronómetro
concentrados al nivel `Hábitos` — tipo ADR 0009, 1 puerta para todos los writes (hoy 5).
`habit-timer.ts` (seam) no se destruye. `habits.ts` re-exportando `derive.ts` es shim
correcto, no fricción.

## Trigger de retome

El próximo commit que toque **≥3 archivos de `src/habits/`** por una misma regla de negocio.

## Contexto del diferido

El hot-spot activo del repo es `src/core/components/` (editor Notion-UX, en construcción);
los candidatos 1 y 2 (Strong, con duplicación viva) van primero. Ver
`.scratch/review-session-advance/` y `.scratch/note-draft-unify/`.

## Comments
