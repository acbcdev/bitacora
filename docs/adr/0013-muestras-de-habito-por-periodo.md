# ADR 0013 — Muestras de hábito por período (serie única, dot proporcional, racha con unidad)

**Status:** Accepted

## Contexto

`deriveHabit` ya puntúa y cuenta la racha en el **período** del hábito (`day` / `week` / `month`,
via `periodKey` — ADR 0009). Pero la única "muestra" que exponía era `days`: una serie fija de 14
celdas **diarias**. De ahí salen las dos muestras visuales, y ambas mienten cuando `period ≠ day`:

- Los **7 dots del tile** (`state.days.slice(-7)`) muestran los últimos 7 días con
  `on = amount > 0`: en "gym 3/semana" prenden por día tocado, cumplas la semana o no.
- El **panel de hover** muestra 14 días y tiene que parchar el desfasaje con
  `perDay = target / 7` (semanal) o `/ 30` (mensual) para mostrar una fracción diaria de una meta
  que no es diaria.

Además el 🔥 de racha muestra un número sin unidad: en un hábito mensual, "🔥3" no dice si son
3 días o 3 meses.

El grill de la sesión `/grill-with-docs` (`.scratch/habit-period-samples/spec.md`) lo confirmó:
para semana y mes, las muestras deben vivir en la escala del período.

## Decisión

**1. Una sola serie, en el período del hábito.** `deriveHabit` devuelve la serie en celdas del
período: 14 días / 7 semanas / 6 meses (`SERIES = { day: 14, week: 7, month: 6 }`, reemplaza
`TRACKED_DAYS`). Dots = últimas 7 (`slice(-7)`), panel = todas. La DB **no cambia**: sigue una
fila por `(habit_id, day)` (ADR 0009) — agregar por período es derivación pura sobre el mapa
`periods` que `deriveHabit` ya construye. La regla de congelado se hereda: celda cerrada contra
el `target` de sus filas, celda actual contra `habits.target`.

**2. Dot proporcional, no binario.** El color del dot sale de `barColor(kind, pct)` — la misma
función `color-mix(in oklab, brand↔destructive)` que ya pinta la barra del tile, invertida para
`bad` — con `pct = min(100, amount / max(target, 1) * 100)` del período. Muere el
`on = amount > 0`: un dot ya no es "tocaste / no tocaste", es el nivel de cumplimiento. El techo
`0` de un `bad` lo cubre el `max(target, 1)`.

**3. Cero = rojo pleno, sin excepciones.** Un período con `amount = 0` cae en el extremo
destructive, aunque sea anterior a `created_at`. Se descartó muted para pre-creación: el pct
manda siempre, y mantener dos semánticas de "vacío" es la ambigüedad que este ADR elimina.

**4. La racha queda estricta.** Un período cerrado parcial rompe; sólo el período en curso de un
`good` no corta (regla vigente desde ADR 0009). Se evaluó "el parcial no rompe" y se rechazó:
redefiniría _Racha de hábito_ a "períodos con algo de actividad" y el 🔥 contaría rachas con
semanas incompletas adentro — exactamente lo que congelar `target` evita.

**5. 🔥 con unidad.** Diario: número solo. Semanal: `sem`. Mensual: `mes`. Tres consumidores
(tile, dialog de hábitos) comparten un helper.

**6. Corrección a nivel día; períodos read-only.** El gesto de corregir días pasados (panel `⌄`)
queda sólo para hábitos diarios. Corregir "la semana del 3 de marzo" exigiría repartir un total
semanal en filas diarias — el diff-algoritmo que ADR 0009 mató a propósito. En semana/mes, el
hover es sólo lectura; la corrección real es el botón `+` de hoy.

## Consecuencias

- Muere `dayColor`'s `perDay = target/7`/`/30`: con celdas por período, `cell.target` ya es el
  target del período y el mix es directo.
- `dayAt(i)` sobrevive sólo para `day`; los labels de semana/mes se derivan del cursor de
  períodos.
- La ventana de 14 diarios no cambia (los dots ya eran 7 de 14); en semana/mes la serie es más
  corta a propósito (14 semanas y 14 meses eran detalle que nadie pide).
- `read_log`, `habit_log`, el schema y toda escritura: intactos. Es un cambio de derivación + UI.
