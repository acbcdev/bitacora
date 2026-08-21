# 02 — Derivación pura + `habits.api.ts`

**Status:** ready-for-agent
**Spec:** `.scratch/habits/spec.md`
**ADR:** `docs/adr/0009-habit-log-por-dia-y-target-congelado.md`
**Blocked by:** 01

## `src/habits/habits.ts` (puro, sin React)

```ts
type DayCell = { amount: number; target: number }
type HabitState = { total: number; met: boolean; streak: number; days: DayCell[] }

export function periodKey(d: Date, period: Period): string
export function deriveHabit(habit: Habit, rows: HabitLogRow[], now?: Date): HabitState
```

- `total` = **suma de `amount`** del período actual, no `count(*)` — en `metric: 'time'` son
  minutos. Las 3 métricas comparten esta función: `check` es `target = 1`, y no hay rama por métrica
  en la derivación.
- `periodKey` reusa/extrae el `dayKey` que ya vive en `core/lib/stats.ts`. `week` = `dayKey` del
  lunes de esa semana; `month` = `YYYY-MM`. Como `habit_log.day` ya es fecha local (issue 01), acá
  **no hay ninguna conversión de zona horaria** — si aparece un `new Date(iso)` sobre `day`, está
  de más.
- `met` = `kind === 'good' ? total >= target : total <= target`. **Qué `target` se usa:**
  - período **actual** → `habits.target` (el vivo). Subir la meta hoy re-puntúa hoy, que es lo
    esperado.
  - períodos **cerrados** → el `target` de las filas de ese período. Es lo que hace que la racha
    vieja sobreviva a un cambio de meta (ADR 0009). Con varias filas y targets distintos en el mismo
    período, gana el de la fila más nueva.
- `streak` = períodos consecutivos con `met` hacia atrás desde el actual. Para `good`, el período
  actual sin cumplir **no corta** la racha (misma regla que `deriveReadStats`). Para `bad`, un
  período sin filas cumple.
- `days` = serie de **14 posiciones** (0 = hace 13 días, 13 = hoy), cada una con `amount` y el
  `target` congelado de esa fila — el issue 04 necesita los dos para pintar la intensidad. Sale del
  mismo array de filas, sin query extra.
- **`habit.days` (el schedule) no se toca acá.** No entra en `met`, ni en `streak`, ni en la serie.
  Si el código lo lee, está mal (ADR 0009).

## `src/habits/habits.api.ts`

Mismo estilo que `courses.api.ts` / `review.api.ts`, sin abstracción nueva:

- `useHabits()` — `select *`, `.is("deleted_at", null)`, orden `created_at`.
- `useHabitLog()` — `select habit_id, day, amount, target`, agrega en JS.
  `ponytail:` comment con el techo (una fila por hábito por día: ~3.6k/año con 10 hábitos; si pesa,
  filtrar por `day >= hoy - 400`).
- **`useSetDay({ habit, day, value })` — un upsert, no un diff.** Es el único camino de escritura:

  ```ts
  supabase.from("habit_log").upsert(
    { habit_id, day, amount: value, target },
    { onConflict: "habit_id,day" },
  )
  ```

  - `target`: si la fila **no existía**, el `habits.target` actual. Si ya existía, **el que tenía**
    — el día se congela con la meta que regía cuando lo empezaste. Se resuelve leyendo el cache de
    `useHabitLog()`, que ya está en memoria.
  - Un día pasado sin fila se congela con el `target` actual. Es una aproximación consciente (nadie
    sabe qué meta regía ese día); dejarlo en un comentario, no borrarlo.
  - `value = 0` deja la fila en cero. **No se borra nada.**
  - El `+1` del tile es `value = hoy + 1`; el toggle de un `check` es `value = hoy ? 0 : 1`. No son
    mecanismos aparte.
  - `ponytail:` el `+1` lee el cache, no la DB. Con dos pestañas abiertas del mismo usuario hay
    carrera; el día que pase, el incremento se mueve a SQL.
- `useSaveHabit()` / `useArchiveHabit()` — insert/update y update de `deleted_at`.
- Invalida `["habit_log"]` y nada más. Sin `onError` propio: el `MutationCache` global de
  `main.tsx` ya avisa.

## Test — `src/habits/habits.test.ts` (Seam 1)

`now` fijo, sin mocks de Supabase (todo puro). Casos:

- good `3/week` a mitad de semana → `met: false` sin cortar racha.
- good que llega al target → `met: true`.
- bad `target: 0` sin filas → cumple y suma racha; con una fila → corta.
- una recaída del período anterior no borra los períodos limpios previos.
- `time` con filas de 30 y 45 da `total: 75` (no 2).
- **el caso del ADR 0009**: 15 días con `amount 10, target 10` siguen cumplidos y la racha sigue en
  15 después de que `habits.target` pase a 20; el período **actual** sí se mide contra 20.
- **`habit.days` no cambia nada**: el mismo log con `days: null` y con `days: [1,3,5]` da idéntico
  `met`, `streak` y serie de 14.
- `days` tiene 14 posiciones y cada una trae `amount` y `target`.
