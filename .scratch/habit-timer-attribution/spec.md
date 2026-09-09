# Spec — Cronómetro atribuye al día que empezó

**Status:** ready-for-agent
**Feature:** `habit-timer-attribution`
**Glosario:** `CONTEXT.md` — Cronómetro (Timer), Día de atribución, habit_log, `target` congelado, Cumplimiento, Racha de hábito, Snapshot, Derivación, Store
**ADR:** `0009-habit-log-por-dia-y-target-congelado.md` (sin ADR nuevo — glosario basta, decisión 2026-08-30 grill #5)
**Origen:** `.scratch/backlog/to-grill-backlog.md` #5 — verbatim usuario "que el timer se guarde para el dia que empezo no cuando terminis como rachas is empieza alas 11:59 y acaa 12:19"

## Problem Statement

El Cronómetro de hábitos `time` guarda el tiempo para el día en que se pausa, no para el día en que empezó. Si arranco 23:59 y pauso 00:19, hoy el sistema hace `habit_log` día2 += 20 min y día1 queda 0. La Racha y el Cumplimiento del período se calculan mal: el día que realmente trabajaste queda vacío y el siguiente parece trabajado. Es el mismo bug de medianoche que `read_log` ya resuelve con fecha local, pero el timer lo reintroduce porque escribe con "hoy" al pausar.

Para el usuario, la expectativa es la misma que con las rachas: lo que empieza un día, cuenta para ese día, aunque termine pasada la medianoche.

## Solution

Al pausar (manual o auto-finish al alcanzar `target`), todo el `elapsed` del Cronómetro se acredita al **Día de atribución** — el `startedDay` derivado de `startedAt` en fecha LOCAL — no al día del wall-clock al momento de pausar. No se parte a medianoche. El `amount` base para el cálculo viene del `habit_log` de `startedDay` (no de hoy), se suma el `elapsed` exacto en segundos, y se hace un único upsert sobre `startedDay`. El auto-finish (`reached`) también se evalúa contra el período que contiene `startedDay`, no contra hoy. El `Timer` persiste `startedDay` explícito en `localStorage` con fallback derivado para timers viejos.

## User Stories

1. As a estudiante con hábito `time` 20 min/día, I want si arranco 23:59 y pauso 00:19 que los 20 min cuenten para el día que empecé, so that mi racha de ayer no se rompa y hoy siga en 0.
2. As a usuaria que dejó un timer corriendo, I want pausar al día siguiente y ver que el tiempo se sumó al día original, so that no pierdo minutos por cruzar medianoche.
3. As a usuario con hábito `time` ya con 12 min hoy, I want arrancar 23:59 y pausar 00:11 (12 min) y que el día original quede 24 (12+12) y el nuevo 0, so that el acumulado sea siempre `amount_prev + elapsed`.
4. As a usuario con hábito `time` good 20/día y 18 ya registrados ayer, I want arrancar 23:59 ayer y que a los 2 min (21 total) el cronómetro haga auto-finish y acredite 21 a ayer, so that no tenga que esperar a que hoy llegue a 20.
5. As a usuario con hábito `time` bad techo 0, I want que el timer nunca haga auto-finish aunque cruce la meta, so that pasar el techo no se confunda con "listo".
6. As a usuario que ya tenía un timer viejo sin `startedDay` en `localStorage`, I want que al pausar siga funcionando derivando `startedDay` de `startedAt`, so that no se rompa al actualizar.
7. As a usuario que pausa antes de 1s, I want que no se escriba nada en `habit_log`, so that toques accidentales no generen filas de 0.
8. As a usuario con hábito week 3/semana, I want que un timer cruzando de domingo a lunes acredite todo al domingo pero el `total` semanal siga sumando ambos días (porque el período es la misma semana), so that el Cumplimiento semanal no se parta artificialmente.
9. As a usuario que deja un timer 3h corriendo cruzando medianoche, I want que todo vaya al día de inicio sin cap de 24h, so that la regla sea simple y predecible (si me olvido, es mi culpa, no magia).
10. As a usuario con hábito `time` 20/día que ya cumplió hoy y vuelve a dar play, I want que no haga auto-finish inmediato en el primer tick, so that pueda hacer de más sin que se corte solo.
11. As a usuario que arranca un timer y luego arranca otro hábito sin pausar el primero, I want que el primero se pausé automático y acredite a su `startedDay` antes de empezar el segundo, so that no se pierda tiempo al cambiar de hábito.
12. As a developer, I want ver en el glosario qué significa Día de atribución y Cronómetro, so that no reintroduzca `todayKey()` en el próximo fix.

## Implementation Decisions

- **Regla de atribución:** Todo el `elapsed` de un Cronómetro va a `startedDay = dayKey(new Date(startedAt))` en fecha LOCAL. No se parte el intervalo a medianoche. Un solo upsert por pausa. Decidido en grill 2026-08-30 Q1=A (todo al inicio). Alternativa partido (dos upserts) descartada por costo y rareza (sessions >30 min cruzando medianoche son edge).
- **Timer shape explícito:** El estado efímero en `localStorage` es `{ habitId, startedAt, startedDay }`. `startedDay` se guarda al hacer `startTimer`. El parser tolera timers viejos sin `startedDay` y lo deriva de `startedAt` como fallback. Trade-off: duplica fuente de verdad (`startedAt` vs `startedDay` pueden divergir si bug), pero es auto-documentado y no depende de recalcular con reloj movido. Grill Q2=B.
- **Base acumulativa por día, no por índice:** Al pausar, el `amount` base se lee del `habit_log` de `startedDay` vía `Map(day -> row)` (no vía `days[TODAY]` ni índice `TODAY - diff`). Si no hay fila, base 0 y `target` congelado es el vivo. Si hay fila, base es `amount` y `target` es el congelado. Esto requiere cambiar `writePause` para tomar `startedDay` y no `todayKey()`. Grill Q3A.
- **Unidad en segundos exactos:** El habit_log para `time` ya guarda segundos (migración 0011). `elapsedSeconds = floor((now - startedAt)/1000)`, `pausedValue = amountSec + elapsedSec` si `elapsedSec >=1` si no `null` (no escribe). Sin `round` a minutos. `shownSeconds = amountSec + elapsedSec` para display y `shownClock`.
- **Auto-finish contra `startedDay`:** La condición `reached` se evalúa contra el período que contiene `startedDay`, no contra `now`. Implementación: derivar `HabitState` para la fecha de `startedDay` (o `getAmountForDay` + `periodKey`) y comparar `amount_startedDay < target && amount_startedDay + elapsed >= target`. Solo `good`; `bad` nunca auto-termina. Si el período es week/month y ambos días caen en mismo período, el `total` incluye ambos, pero la regla sigue siendo "período de startedDay". Grill Q4A.
- **Seam y no-migración:** Sin cambio de schema. `habit_log.day` sigue `date` local con `unique (habit_id, day)`. El adapter sigue recibiendo `HabitDayInput` completa con `target = frozenTarget(log, habitId, startedDay, liveTarget)`. El `target` congelado se resuelve contra la fila de `startedDay`, no la de hoy.
- **Interacción con cambio de timer:** Si hay un timer corriendo y se da play en otro hábito, se pausa el anterior primero (con su `startedDay` y su base) y luego se inicia el nuevo.
- **Sonido y toast en auto-finish:** `finishTimer` sigue limpiando `localStorage`, sonando y toast, pero recibe el valor ya atribuido (minutos derivados de segundos).
- **Glosario:** Actualizar `CONTEXT.md` con **Cronómetro (Timer)** y **Día de atribución** (ya hecho en grill).

## Testing Decisions

- **Qué hace un buen test:** Solo comportamiento externo observable (qué queda en `Snapshot.habitLog` tras pausar, si el toast suena, si la racha cambia), no detalles de implementación (`localStorage` key interna, `setInterval` ticks). Los timers son determinísticos con `Date.now` mockeado.
- **Qué se testea:**
  - Módulo puro del Cronómetro: `pausedValue`, `elapsedSeconds`, `shownSeconds`, `shownClock`, `readTimer`/`startTimer`/`clearTimer` con `startedDay` explícito y fallback viejo, `finishTimer` side-effects mockeados. Prior art: `habit-timer.test.ts` (6 tests, mock `Date.now`, `localStorage`, `sonner`).
  - Derivación de hábito: `deriveHabit` con `habit_log` mixto y `now = startedDay` vs `now = today`. Prior art: `habits.test.ts` (fija `NOW` 2026-08-20, helper `row(day, amount, target)`, cases good/bad, week, streak). Añadir cases cross-midnight: period day con timer 23:59→00:19, period week domingo→lunes.
  - Integración Store snapshot: `useSetDay` optimista con `startedDay` (verificar que el `habitLog` del Snapshot queda con la fila correcta antes del round-trip). Prior art: `local-store.test.ts` + `derive.test.ts`.
  - UI `HabitTiles`: pausar manual cross-midnight realiza un solo `store.save("habit_log", {day: startedDay})` y resetea timer; auto-finish dispara `finishTimer` con `amount_startedDay+elapsed`. Prior art: `habit-tiles` sin test aún — usar `renderApp` harness como `review.test.tsx`.
- **Seam elegido:** Uno solo: **Store** (`snapshot` + `save habit_log`) + **Snapshot Derivación** + **Timer localStorage**. Es el seam más alto: todas las pantallas leen `Snapshot`, el cronómetro solo escribe vía `Store.save`. No se añade seam nuevo.
- **Out of test:** `AudioContext`/`Notification` reales, `store` supabase network.

## Out of Scope

- Partir el `elapsed` a medianoche en dos filas (10 min día1 + 10 min día2). Descartado explícitamente.
- Cap de 24h o límite de duración del timer.
- Editar `startedDay` manualmente; el campo es write-once al iniciar.
- Migración de `habit_log` históricos mal atribuidos (solo hacia adelante).
- Cambiar la unidad de `habit_log` (sigue segundos exactos, sin volver a minutos).
- Notificaciones push con app cerrada (sigue out of scope, solo toast+Notification con tab abierto).

## Further Notes

- Caso edge: timer dejado 3 días. Con regla "todo al inicio", un timer iniciado lunes 23:59 y pausado jueves acredita todo al lunes. Es sorpresivo pero consistente y raro; alternativa sería descartar o cap, más compleja sin beneficio.
- Si en el futuro se quiere `read_log` con misma regla (repaso cruzando medianoche), reutilizar el patrón `startedDay` — hoy `read_log.read_at` es `timestamptz` append-only y no tiene este bug porque se deriva por `dayKey(read_at)` local.
- No se crea ADR nuevo: queda en glosario + comentario en Timer module. Si se reabre el debate partido vs todo, crear ADR entonces.
