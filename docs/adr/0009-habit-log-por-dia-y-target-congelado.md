# ADR 0009 — `habit_log`: una fila por día, con el `target` congelado

**Status:** Accepted

## Contexto

`read_log` es append-only: una fila `(note_id, read_at)` por repaso, nunca se borra, y todo
—progreso, racha, `read_count`— sale de agregarlo (ADR 0003). El spec original de hábitos copió esa
forma: una fila por evento, `(habit_id, amount, done_at)`, más un `deleted_at` para poder corregir.

El grill de 2026-08-20 (`.scratch/habits/`) rompió esa copia con dos casos concretos.

**1. Con el log crudo solo, cambiar la meta reescribe la historia.**

`Leer`, meta 10 min/día, 15 días seguidos de exactamente 10 minutos. Subís la meta a 20:

| día | `amount` | pct antes | pct después |
|---|---|---|---|
| 5–19 ago | 10 | 1.0 ✅ | **0.5 ❌** |
| racha | | **15** | **0** |

Quince días cumplidos se vuelven quince fracasos retroactivos. Esto **no pasa con `read_log`**
porque un repaso no se mide contra ninguna meta: la fila ES el hecho. Un hábito se mide contra un
target que el usuario cambia (user story 27 del spec: editar la meta sin perder el historial), y
ahí el hecho crudo no alcanza.

**2. Con una fila por evento, bajar un número necesita un algoritmo.**

Tocaste el chip 3 veces y fueron 2. El spec original resolvía eso soft-borrando filas *"de la más
nueva a la más vieja hasta cubrir la diferencia; si la última se pasa, se la borra y se inserta el
resto"*. Es decir: ya había pagado el `deleted_at` en `habit_log` —perdiendo la propiedad
append-only que justificaba copiar a `read_log`— y encima seguía debiendo un diff.

Además `done_at` es `timestamptz` (UTC) mientras `dayKey` (`core/lib/stats.ts:15-17`) es fecha
local, así que toda derivación tenía que esquivar el bug de medianoche a mano.

## Decisión

```sql
habit_log(id, user_id, habit_id, day date, amount int, target int)
  unique (habit_id, day)
  amount int not null default 1 check (amount >= 0)
```

- **Una fila por `(habit_id, day)`.** `amount` es el total de ese día, no el de un evento. Registrar
  es un upsert, no un insert.
- **`day` es `date` en hora local**, escrito por el cliente con `dayKey()`. La clase entera de bug
  UTC/local desaparece del feature.
- **Cada fila congela el `target` vigente** cuando se empezó ese día. El período **actual** se
  puntúa contra `habits.target` (vivo); los períodos cerrados, contra el `target` de sus filas.
- **`amount >= 0`, no `> 0`.** `0` es "no hice nada ese día" — desmarcar un `check` es `amount = 0`.
  Por eso `habit_log` **no lleva `deleted_at`**: no hay nada que borrar.
- En un upsert sobre una fila que ya existe, **`target` no se pisa**: el día vale la meta que tenía
  cuando lo empezaste.

## Regla

**`target` no es un derivado guardado — es el contexto vigente al escribir.** La distinción importa
porque ADR 0003 prohíbe lo primero, no lo segundo. Es el patrón de línea de factura: se guarda el
precio que regía, no el descuento calculado. El `pct` sigue siendo derivado (`amount / target`), y
sigue sin existir ninguna columna que lo guarde.

ADR 0003 no se toca: `read_log` sigue append-only, sin `deleted_at`, sin `target`, y todo lo suyo
sigue derivándose igual. Esto aplica a `habit_log` **solamente**, por la diferencia de arriba: un
repaso es un hecho absoluto, un hábito es un hecho medido contra una meta editable.

## Lo que NO se hizo

**Guardar el `pct` en la fila** (la propuesta original: dos valores, porcentaje de éxito + valor
conseguido). Congela igual de bien, pero pierde en los tres ejes:

- **La suma de floats miente en el caso más común.** `Gym 3/semana`: tres filas de `0.33` suman
  `0.9899999999999999` — fuiste 3 de 3 y el chip dice que fallaste. Con `amount` entero,
  `1+1+1 = 3 >= 3` es exacto siempre.
- **Un `bad` con techo `0` no tiene pct** (`1/0`). Habría que inventar una regla al escribir, y esa
  regla queda congelada en los datos viejos.
- **Ninguna pantalla lee el pct de una fila suelta.** El chip siempre muestra el del período, que es
  `suma(amount) / target`. Sería una columna que nadie consulta.

Guardando `target` se recupera el `pct` dividiendo; guardando `pct` no se recupera el `target` sin
una división de floats que falla con `amount = 0` y con `target = 0`.

**Versionar `habits.days`** (el schedule "lun/mié/vie"). Un snapshot no lo arregla: el problema son
los días **sin fila**, y una fila inexistente no congela nada — haría falta una tabla de schedules
con `valid_from`. Se resolvió sacando `days` de todo cálculo (ver Consecuencias), con lo cual el
problema deja de existir en vez de resolverse.

**Un RPC para el incremento.** `+1` se calcula en el cliente sobre el cache que `useHabitLog()` ya
tiene en memoria. La carrera solo existe con dos pestañas abiertas del mismo usuario;
`ponytail:` upsert con `amount = excluded.amount` calculado en SQL el día que eso pase de verdad.

## Consecuencias

- **`habits.days` es recordatorio, no regla.** Un hábito "lun/mié/vie" se modela como cupo
  (`count 3/week`); si vas el martes, cuenta igual. `days` no entra en `met`, ni en la racha, ni en
  los 14 días. Cambiar los días no toca una sola métrica histórica.
- **Editar días pasados sale gratis** — es el mismo upsert con otro `day`. Estaba en Out of Scope
  del spec por costo; con este modelo entra al MVP.
- **Pausar y reanudar el cronómetro sale gratis.** Estaba fuera por "obliga a guardar tiempo
  acumulado además de `startedAt`": el acumulado ya es `amount` de hoy. `localStorage` guarda
  `{ habitId, startedAt }` y nada más.
- **Se pierde la hora exacta de cada registro.** Ninguna pantalla la muestra hoy. Recuperarla es
  agregar una tabla de eventos aparte, no revertir esta.
- Un día pasado sin fila no tiene target que congelar: se escribe el `habits.target` actual. Es la
  única opción honesta y queda documentada en el spec.
- Redondeo: `amount` son minutos enteros, así que pausar un cronómetro redondea (`round`, no
  `floor`) — error acotado a ±30s por pausa, que se compensa solo.
