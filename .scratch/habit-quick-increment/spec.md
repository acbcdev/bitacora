# Spec — Chips de hábito sin flash con clicks rápidos

**Status:** ready-for-agent
**Feature:** `habit-quick-increment`
**Glosario:** `CONTEXT.md` — Habit, habit_log, `target` congelado, Cumplimiento, Snapshot, Derivación, Store
**ADR:** `0009-habit-log-por-dia-y-target-congelado.md`, `0011-store-adapter-supabase-o-localstorage.md`
**Origen:** `.scratch/backlog/to-grill-backlog.md` #2 — "bug o flash raro en los chips de count clicks rapidos"

## Problem Statement

En la tira de hábitos, los chips `count` (`+1` por tap) y el stepper del panel hacen un flash con clicks rápidos: el número sube, vuelve a bajar un frame y luego sube, o se queda en 1 cuando deberían ser 2. Pasa porque el `+1` se calcula leyendo el `amount` derivado del render (`days[TODAY].amount`) y se lo pasa como `value = today+1` al `Store`. Si React no re-renderizó entre dos taps, el segundo tap lee el mismo `today` viejo, manda `value=1` otra vez y el `onMutate` optimista sobrescribe la primera escritura. El comentario en el código dice que el cache optimista hace que dos clicks sumen 2, pero el cálculo del `value` ocurre fuera del cache, sobre estado viejo. El panel repite el patrón: un upsert por tap sin debounce ni guard. No hay `isPending` ni feedback deshabilitado.

Para el usuario es ruido visual y pérdida de confianza: siente que sus taps no cuentan.

## Solution

Hacer el incremento atómico dentro del `onMutate` optimista del Store, leyendo el `amount` más fresco del cache de `Snapshot` en ese instante, no el del render. El caller deja de calcular `today+1` y pasa un `delta` o un `value` que el `onMutate` corrige a `max(value, prev.amount+1)` / `prev.amount + delta`. Además, el botón rápido muestra estado `isPending` (opacity/disable leve) sin bloquear taps en cola — los taps se encolan vía mutaciones optimistas y convergen. El panel comparte la misma corrección. El `+1` sigue siendo un solo upsert por tap sobre `habit_log` con `day = todayKey()` y `target = frozenTarget(...)`, pero ahora sin carrera entre render y cache.

## User Stories

1. As a estudiante con hábito `count` 3/día, I want hacer doble tap rápido en el chip y ver 0→1→2 sin flash intermedio, so that sienta que cada tap contó.
2. As a usuaria que hace 5 taps en 400ms, I want ver el número subir monotónicamente 0→1→2→3→4→5 sin bajar, so that el feedback sea fluido.
3. As a usuario de `check` (toggle), I want tocar rápido dos veces y que haga 0→1→0 consistente, so that el toggle no quede en estado intermedio.
4. As a usuario del panel de hábito, I want usar el stepper `+`/`−` rápido y ver el mismo comportamiento sin flash, so that no haya dos bugs distintos según dónde toco.
5. As a usuario con `time` que da play/pause rápido, I want no flash en el slot del tiempo (ya tiene `tabular-nums` y `min-w-*`), so that el reloj no haga latir la tira.
6. As a usuario con dos pestañas abiertas, I want el segundo tap desde pestaña B no sobrescriba el de A si ambos leen el mismo `amount` inicial, so that el dato no se pierda (ponytail aceptado: carrera inter-pestaña queda con eventual consistency, no lock).
7. As a usuario que toca mientras hay un `store.save` en vuelo, I want ver el botón levemente dimmed pero aún poder tocar, so that sepa que está guardando sin perder el siguiente incremento.
8. As a usuario que deshace un error (toqué 3 y eran 2), I want poder bajar con `−` sin flash, so that corregir sea tan fluido como incrementar.
9. As a usuario con hábito `bad` techo 0, I want tocar rápido `+` y ver `0→1→2` sin flash y sin que el chip parpadee el borde punteado, so that la señal de alarma sea estable.
10. As a developer, I want un solo lugar donde se decide el `amount` final (el `onMutate`), so that no haya dos implementaciones de `+1` (tiles vs panel) que diverjan.
11. As a QA, I want poder reproducir el bug con un test de doble mutación sin esperar timers, so that el fix sea verificable.

## Implementation Decisions

- **Incremento atómico en `onMutate`:** El `SetDay` deja de confiar en el `value` calculado en el render. Dentro de `onMutate`, lee `qc.getQueryData(Snapshot).habitLog`, busca `prev` por `(habitId, day)`, y calcula `nextAmount = prev ? prev.amount + delta : delta` (o `Math.max(value, (prev?.amount ?? 0)+1)` si se mantiene forma `value`). Escribe `HabitLogRow { habit_id, day, amount: nextAmount, target: prev?.target ?? frozenTarget(...) }`. Esto serializa taps optimistas aunque el render esté viejo.
- **Forma del Input:** Cambiar `SetDayInput` de `{habit, day, value}` a `{habit, day, delta}` o mantener `value` pero documentar que es hint y el cache manda. Decisión: soportar ambas vía `value ?? delta`. Preferencia `delta: +1 / -1` para `count` y `0/1` para `check` como toggles explícitos. `time` no usa `SetDay` para incrementar (usa timer), así que no toca.
- **UI feedback, no bloqueo:** El botón rápido no se `disabled` duro; usa `isPending` del `useSnapshotMutation` para `opacity-60` o `pointer-events` leve. Los taps siguientes se encolan como mutaciones; el `onMutate` ya es atómico, así que no se pierde ninguno. No se introduce `debounce` ni `throttle` ni batch de 400ms.
- **Panel unificado:** El stepper del panel llama al mismo `useSetDay` con `delta` en vez de recalcular `value` local. Se elimina lógica duplicada de `+1` en dos call sites.
- **Target congelado intacto:** El `target` del `next` sigue siendo `prev?.target ?? liveTarget` y no se pisa si ya existe (ADR 0009). El `onMutate` no recalcula `frozenTarget` más que para filas nuevas.
- **No se toca `deriveHabit`:** La racha y `total` siguen derivando de `Snapshot.habitLog`; el fix es solo en escritura optimista. `deriveHabit` no necesita guardas de medianoche para este bug.
- **Seam elegido:** Uno solo — **Store** (`Snapshot` + `save habit_log`) y su `onMutate` optimista. Es el seam más alto: tiles y panel son solo call sites finos. No se crea seam nuevo.
- **Concurrent tabs ponytail:** Documentar que dos pestañas pueden mandar dos `delta +1` basados en mismo `prev` y uno sobrescribe si llegan a la red en paralelo. Fix real sería `amount = habit_log.amount + 1` en SQL (upsert con incremento server-side). Se deja `ponytail:` en código y se resuelve solo si se reporta en uso real (mismo criterio que ADR 0009 rechazó RPC de incremento).

## Testing Decisions

- **Qué hace un buen test:** Comportamiento externo: tras N mutaciones rápidas, el `Snapshot` tiene `amount = N` y no hay frame intermedio con valor menor. No testear internals de `queryClient` ni que el botón esté disabled. Tests determinísticos sin timers reales.
- **Qué se testea:**
  - Unit del seam Store: `habits.api` — mock `queryClient` con `Snapshot` inicial `amount=0`, disparar `setDay.mutate({delta:+1})` dos veces sin `await` intermedio, verificar `habitLog` del cache queda `2` sin flash a `1`. Prior art: `habits.test.ts` para `deriveHabit` + `local-store.test.ts` para Store.
  - Unit `deriveHabit` no necesita nuevo, pero añadir caso `amount` monotónico.
  - Integración `HabitTiles` / `HabitPanel` con `renderApp` harness: simular doble click con `userEvent.click` rápido, verificar DOM muestra `2/3` sin `1` intermedio. Prior art: `review.test.tsx`, `habit-tiles` estados HTML, `drialog.test.tsx`.
  - Opcional: test de `isPending` opacity.
- **Seam de test:** `Store` snapshot mockeado + `renderApp` con `localStore` (sin Supabase). No se necesita `msw` ni DB.
- **Out of test:** Animación `transition-[width,background-color]` del tile, `tabular-nums` layout, debounce no implementado.

## Out of Scope

- Batch/debounce que colapsa 5 taps en 1 upsert con `amount = 5`. Se mantiene 1 upsert por tap (simple, consistente con `habit_log` upsert).
- Cambiar `habit_log` a `amount = excluded.amount + 1` en SQL. Solo si se reporta race inter-pestaña.
- Disabling duro del botón mientras `isPending` (bloquearía taps rápidos — justo lo que se quiere evitar).
- Fix para `habit-timer` (attribution cross-midnight) — es spec aparte.
- Cambiar `SLOT` widths o `tabular-nums` (ya está para evitar latido).

## Further Notes

- Hoy el `todayKey()` sigue usándose; el bug no es de fecha sino de valor. El spec de timer (`habit-timer-attribution`) cambia `day` a `startedDay` solo para `time`.
- Si el usuario mantiene presionado el chip (long-press), no se implementa auto-repeat; es un tap por gesto.
- El fix no introduce `isPending` como guard de escritura — solo como hint visual. La corrección real es atómica en `onMutate`.
