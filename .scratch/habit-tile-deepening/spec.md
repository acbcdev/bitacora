# Hábitos: extraer la máquina del Cronómetro de `HabitTiles` a `useHabitTimer`

**Status:** ready (grill 2026-10-05; antes deferred 2026-10-01)
**Origen:** review `architecture-review-20260929` candidato 3
**Trigger cumplido:** `08a0fa1` (reloj congelado al pausar) tocó `habit-tile-info.tsx`, `habit-tiles.tsx`, `habit-timer.ts` por una misma regla.

## Problema (corregido)

La versión original decía "3 módulos pasándose `{startedState, shown, clock}` por props". Falso:
`startedState` y `shown` mueren en `HabitTiles`; a los hijos sólo bajan `total`, `running`, `clock`.
La fricción real: **`HabitTiles` (el componente de lista) es la máquina de estado del Cronómetro** —
`writePause`, `startedState`, `reached`, efecto de auto-finish, interval de repintado y la rama
`time` de `quick` — mezclada con layout y con check/count.

## Decisiones (grill)

- **Forma B:** un hook, no un módulo `Hábito` grande. "1 puerta para todos los writes" ya existe:
  `useSetDay` (ADR 0009). No se toca.
- **Archivo nuevo** `src/habits/use-habit-timer.ts`. `habit-timer.ts` queda intacto (seam puro, no
  conoce el store). `habits.ts` re-exportando `derive.ts` es shim correcto.
- **Interfaz mínima:** `useHabitTimer(habits, log) → { runningId, shown, clock, toggle(habit) }`.
  Recibe `habits`, no `entries` (`writePause` sólo usa `h`; `deriveHabit` lo llama el hook).
- **`Run` y `quickLabel` se quedan en `habit-tile-info.tsx`**: es derivación de vista. `paused` sale
  de `meets()` (regla de cumplimiento), meterlo en el hook mezclaría dos reglas.
- `HabitTiles.quick` queda: `metric === "time" ? timer.toggle(h) : check/count → setDay`.

## Se lleva al hook

`useTimer`, `setInterval` de repintado, `writePause`, `startedState`, `shown`, `clock`, `reached`,
efecto de auto-finish, rama `time` de `quick`.

## Cuidado

El efecto de auto-finish depende SOLO de `[reached]` (con `oxlint-disable exhaustive-deps`):
se auto-desarma porque `finishTimer` limpia localStorage. Moverlo tal cual, sin "arreglar" las deps.

## Verificación

- `habit-tiles-timer.test.tsx` y `habit-tiles.test.tsx` pasan **sin modificarse** (red de seguridad).
- Sin tests nuevos de hook: el comportamiento ya está cubierto a nivel componente.
- `pnpm test` + `pnpm tsc` verdes.

## Fuera de alcance

Timers paralelos, mover `Run`, tocar `useSetDay`, ADR nuevo (reversible, no sorprende).

## Comments
