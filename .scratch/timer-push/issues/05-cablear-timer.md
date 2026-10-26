# Cablear el Cronómetro: agendar al play, cancelar al pausar, clamp del auto-finish

Status: ready-for-agent
Blocked by: 02, 03

## Qué

En `use-habit-timer.ts`, el `deadline` que ya existe (timeout de desktop) es la fuente:
- `deadline` pasa a número → `store.setTimerAlarm(sub, { fireAt: new Date(deadline), body: "Terminaste tus N min de X." })`.
- `deadline` pasa a `null` (pausa, finish, cambio a otro hábito, hábito `bad`, ya pasado de meta)
  → `store.setTimerAlarm(sub, null)`.
- Sin subscription (permiso no granted, modo local) → nada.
- Un solo effect sobre `[deadline]`; sin mutación optimista (no hay UI que la muestre).
- **Clamp:** el auto-finish (`reached`) escribe con `now = min(Date.now(), deadline)` vía el `now`
  que `pausedValue` ya acepta. La pausa manual no cambia.

## Hecho cuando

- Test: play de un `good` debajo de la meta agenda con el deadline correcto; pausa cancela;
  play en un `bad` no agenda.
- Test: con el reloj 2h pasado el deadline, el auto-finish escribe exactamente la meta, no meta + 2h.
