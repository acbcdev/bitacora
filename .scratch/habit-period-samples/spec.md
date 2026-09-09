# Spec: muestras de hábito por período (dots, serie, racha con unidad)

**Status:** grillado 2026-02 (sesión `/grill-with-docs`), sin implementar.
**ADR:** `docs/adr/0013-muestras-de-habito-por-periodo.md`
**Blocked by:** ninguna.

## Problema

El tile de hábito mezcla dos escalas cuando `period ≠ day`: los 7 dots son siempre los últimos
7 **días** (`state.days.slice(-7)`, `habit-tiles.tsx`) mientras el 🔥 cuenta **períodos**
(`deriveHabit` via `periodKey`). En "gym 3/semana", el dot se prende por día con `amount > 0`
(digamos o no la meta) y el 🔥5 no dice si son 5 días o 5 semanas. El usuario pidió "muestras
diferentes" para hábitos semanales y mensuales.

## Decisiones del grill (todas confirmadas por el usuario)

1. **Serie única por período.** `deriveHabit` devuelve la serie en el período del hábito:
   14 días / 7 semanas / 6 meses (`SERIES = { day: 14, week: 7, month: 6 }`, reemplaza
   `TRACKED_DAYS`). La DB sigue guardando **una fila por día** (ADR 0009) — agregar por período
   es derivación pura sobre el mapa `periods` que ya existe. Cero schema, cero escritura nueva.
2. **Dot proporcional, no binario.** Color = `barColor(kind, pct)` (ya existe en
   `habit-tiles.tsx:86`, `color-mix(in oklab, brand↔destructive)`, invertido para `bad`) con
   `pct = min(100, amount / max(target,1) * 100)` del período. Muere el `on = amount > 0`.
   El caso `bad` con techo `0` ya lo cubre el `max(target, 1)`.
3. **Cero = rojo pleno, sin excepciones.** Ni "pre-creación": el pct manda siempre. (El usuario
   eligió rojo parejo sobre la propuesta de muted para períodos anteriores a `created_at`.)
4. **Racha estricta.** Un período cerrado parcial rompe la racha; sólo el período en curso de un
   `good` no corta (regla vigente, sin cambios). Rechazada la variante "parcial no rompe" —
   contradeciría el glosario y el sentido de congelar `target` (ADR 0009).
5. **🔥 con unidad.** Diario: número solo. Semanal: `sem`. Mensual: `mes`. Corte en `>= 2` igual.
   Tres consumidores: `habit-tiles.tsx`, `habits-dialog.tsx:122` → un helper compartido.
6. **Corrección a nivel día; vista de períodos read-only.** El gesto de corregir días pasados
   (panel `⌄`) queda sólo para hábitos diarios — la escritura es una fila por día y repartir un
   total semanal en días es el algoritmo que ADR 0009 mató a propósito. El hover de períodos en
   semana/mes es sólo lectura; la corrección real es el botón `+` de hoy.

## Qué toca

| Archivo                        | Cambio                                                                                                                                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/store/derive.ts`     | `TRACKED_DAYS` → `SERIES` por período. Loop de la serie: caminar períodos con `periodKey` + `stepBack`, celdas desde el mapa `periods` (target congelado en cerrados, vivo en el actual). `dayAt` sólo sobrevive para `day`. |
| `src/habits/habit-tiles.tsx`   | `TODAY = SERIES[h.period] - 1`. Dots con `barColor` + pct de celda. 🔥 con unidad vía helper.                                                                                                                                |
| `src/habits/habit-panel.tsx`   | `dayColor` simplificado (muere `perDay = target/7` y `/30`: `cell.target` ya es el target del período). Labels por período; edición de días pasados sólo en `day`.                                                           |
| `src/habits/habits-dialog.tsx` | 🔥 con unidad (mismo helper).                                                                                                                                                                                                |
| `src/habits/habits.test.ts`    | Expectativas de la serie por período.                                                                                                                                                                                        |

## Out of scope

- Calendarios semanales/mensuales (otra UI, Out of Scope del spec de hábitos).
- Cambiar el schema, la RPC, o cualquier escritura.
- Pausar/repintar la racha de `read_log` — no se toca.
