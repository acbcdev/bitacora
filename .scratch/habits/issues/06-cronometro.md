# 06 — Cronómetro para hábitos `time` + notificación

**Status:** resuelto — implementado 2026-08-20
**Spec:** `.scratch/habits/spec.md`
**Prototipo:** `.scratch/habits/habits.prototype.tsx` (`useTimer`) — **desactualizado en un punto**:
el chunk fijo de 30 min para metas semanales ya no existe (ver abajo).
**Blocked by:** 03

Un hábito `time` ("30 min de lectura") se corre adentro de la app: arranca del tile con un click, y
**cuenta para arriba desde lo que ya llevás del período**. Play sobre 15 minutos sigue en 15.

## `src/habits/habit-timer.ts`

Un solo timer a la vez. `{ habitId, startedAt }` en `localStorage` bajo `bita-timer`, mismo criterio
que `pinned-courses.ts` (estado de UI vivo, no dato de negocio) — y con la misma receta de
`useSyncExternalStore` si hace falta leerlo desde dos árboles distintos.

```
mostrado    = amount del período (DB) + (Date.now() - startedAt)
pausa/corte = useSetDay({ value: amount + round(elapsed en minutos) }) → limpia el localStorage
play        = startedAt = now                                          → la base sale de la DB
notifica    = cuando mostrado >= target
```

- **No hay "duración de sesión".** El timer corre hasta la meta y avisa. El chunk de 30 min que el
  prototipo inventaba para metas semanales **se elimina**: era un número mágico que nadie decidió, y
  con cuenta hacia arriba no hace falta.
- **Pausar y reanudar entra al MVP.** Estaba fuera del spec viejo por "obliga a guardar tiempo
  acumulado además de `startedAt`" — con una fila por día el acumulado ya está guardado: es
  `amount`. `localStorage` sigue con 2 campos.
- **Escribe en la DB en cada pausa**, vía `useSetDay` (issue 02). El tiempo hecho nunca se pierde y
  el acumulado cruza de dispositivo. Costo aceptado: redondeo a minuto por pausa —
  `Math.round(elapsed / 60000)`, **`round` y no `floor`**, para que el error se compense en vez de
  acumularse hacia abajo. Menos de 30s no suma nada.
- **El transcurrido sale siempre de `Date.now() - startedAt`**, nunca de contar ticks: un tab en
  background throttlea el `setInterval`. El interval (1s) sólo repinta.
- `startedAt` en `localStorage` ⇒ sobrevive reload y cambio de pestaña. Sin esto el cronómetro es un
  juguete: leer 30 minutos sin recargar nada no es un uso real.
- El timer **no es un camino de escritura especial**: escribe con el mismo `useSetDay` que el click
  y el panel, así que el panel (issue 04) puede corregir después ese número como cualquier otro.
- `ponytail: un timer global. Timers paralelos por hábito el día que alguien lea y corra a la vez.`

## Notificación

`Notification` API, permiso pedido **al arrancar el primer timer** (no al montar la tira: pedir
permisos sin que el usuario haya hecho nada es exactamente lo que hace que los denieguen). Toast de
sonner siempre, como fallback si el permiso está denegado.

`ponytail:` sólo llega **con la app abierta** (el tab puede estar de fondo). Push con la app cerrada
necesita service worker + servidor que lo dispare → rompe el "$0, sin servidores propios"
(`CONTEXT.md:27`). Está en Out of Scope del spec, dejarlo escrito en el código también.

## UI en el tile (issue 03)

**Sin modo especial.** El tile sigue mostrando la misma fracción (`107/150 min`) y el mismo relleno,
sólo que el número sube en vivo y el `▶` pasa a `■`. Otro click pausa. Eso es menos código que el
modo running que pedía la versión anterior de este issue — y por eso el `tabular-nums` de la
fracción no es estético: sin ancho fijo el tile late cada segundo.

## Test — `src/habits/habit-timer.test.ts`

Puro, con `Date.now` mockeado — sin timers falsos ni RTL. Casos:

- pausar a los 90s sobre un acumulado de 10 escribe `value: 12`, no `2` (la prueba de que cuenta
  desde lo que había).
- reanudar parte del acumulado de la DB, no de cero.
- pausar a los 20s no escribe nada.
- llegar a `target` notifica y limpia el `localStorage`.
- leer el estado con un `startedAt` viejo en `localStorage` devuelve el transcurrido correcto (la
  prueba de que sobrevive al reload).

## Comments

- `src/habits/habit-timer.ts` + `habit-timer.test.ts` (7 casos, `Date.now` mockeado, sin RTL).
- El snapshot de `useSyncExternalStore` es el string crudo de `localStorage`, no el objeto
  parseado: comparar por identidad un objeto nuevo en cada llamada sería un render infinito.
- Agregado que el issue no pedía: arrancar el cronómetro de otro hábito primero guarda lo que iba
  corriendo. Un timer a la vez sigue siendo cierto, pero cambiar de hábito ya no tira los minutos.
- Post-review: el auto-corte al llegar a la meta tiene dos guardas que el issue no nombraba —
  sólo `good` (en un `bad` el target es un techo, y con techo 0 el timer se apagaba antes de
  arrancar) y sólo si venías por debajo del target (dar play estando ya en la meta se auto-cortaba
  en el primer render, en vez de seguir contando como pide la story 20).
