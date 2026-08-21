# Feature: hábitos (buenos y malos, frecuencia custom) — MVP

**Status:** resuelto — implementado 2026-08-20 (los 6 issues, ver sus `## Comments`)
**Blocked by:** ninguno
**ADR:** `docs/adr/0009-habit-log-por-dia-y-target-congelado.md`

Reabre el ítem Tier 3 de `.scratch/platform-features/to-grill-platform-features.md:103-105`
("Seguimiento de hábitos — mismo territorio que `goals`, ya descartado"). El caso nuevo que lo
justifica está en Further Notes; sin ese caso este spec no existiría.

Segunda ronda de grilling (2026-08-20) reescribió el modelo de datos y la superficie de edición. Lo
que cambió y por qué está en el ADR 0009 y en Further Notes.

## Problem Statement

`read_log` mide un solo hábito implícito: leer notas. No hay forma de trackear ningún otro hábito
—ni de sostener uno bueno ni de cortar uno malo— con una frecuencia que no sea "todos los días".
Hoy eso vive fuera de la app (cabeza, papel, otra app), así que la pantalla que el usuario abre
2–3×/día no muestra el estado real de sus hábitos.

## Solution

Una entidad `habits` nueva + su log (`habit_log`). Cada hábito define:

- **`kind`** — `good` / `bad`. Un `good` cumple cuando llega al target (piso: "3 veces por semana");
  un `bad` cumple mientras no lo pase (techo: "máximo 0 por día").
- **frecuencia** — `target` por `period` (`day` / `week` / `month`). Un hábito de días fijos se
  modela como **cupo**: "gym lun/mié/vie" es `count 3/week`.
- **`days`** — los días en que *planeás* hacerlo (`{1,3,5}`). **Recordatorio, no regla**: no entra
  en ningún cálculo. Si vas el martes, cuenta igual.
- **`metric`** — `check` (lo hice o no), `count` (cuántas veces) o `time` (minutos). Los tres son el
  mismo dato con una cantidad: `habit_log.amount`.
- **`icon`** — misma convención que `courses.icon`.

**El log guarda una fila por día, con la meta congelada** (ADR 0009): `(habit_id, day, amount,
target)`. Registrar es un upsert. Corregir es el mismo upsert con otro número. Congelar el `target`
es lo que hace que subir la meta no reescriba las rachas viejas.

**Dos gestos, y cuál es cuál lo decide la métrica:**

| `metric` | Click en el tile | `⌄` |
|---|---|---|
| `check` | **toggle**: marca / desmarca hoy | abre el panel (para corregir días pasados) |
| `count` | +1 | abre el panel |
| `time` | arranca / pausa el cronómetro | abre el panel |

El `⌄` abre un **`Dropover`** (Popover en desktop, Drawer en mobile) con la meta, los últimos 14
días y un stepper. **Click en cualquier cuadrado cambia el día que estás editando** — corregir el
sábado que te olvidaste es el mismo gesto que corregir hoy.

La UI **no agrega pantalla** (`ui-principles.md:52`): una **tira de tiles** en Hoy —la pantalla que
ya se abre 2–3×/día— **debajo del repaso y arriba de la lista de Cursos**. La vista completa
(crear, editar, archivar, ver los `days`) vive en un **Dialog**, mismo criterio que el Settings
dialog de `CONTEXT.md:102-106`.

## User Stories

1. Como usuario, quiero crear un hábito con nombre e icono, para reconocerlo de un vistazo en la
   tira sin leer.
2. Como usuario, quiero marcar un hábito como bueno o malo, porque sostener uno y cortar el otro no
   se miden igual.
3. Como usuario, quiero definir cuántas veces por período lo quiero hacer (ej. 3 por semana), para
   no estar obligado a hábitos diarios.
4. Como usuario, quiero elegir el período entre día, semana y mes, para que la meta refleje cómo
   pienso el hábito de verdad.
5. Como usuario, quiero anotar en qué días planeo hacerlo (lun/mié/vie), para tenerlo escrito
   cuando abra la vista completa.
6. Como usuario, quiero que anotar esos días **no** me marque el martes como fallado si voy el
   martes, porque lo que cuenta es haberlo hecho.
7. Como usuario, quiero elegir cómo se trackea cada hábito —check, cantidad o tiempo— porque
   "medité hoy", "tomé 6 vasos de agua" y "45 minutos de gym" no se miden con la misma unidad.
8. Como usuario, quiero que la fila muestre la unidad correcta (`45/150 min`, `2/3`, hecho/no),
   para no tener que acordarme de qué mide cada uno.
9. Como usuario, quiero registrar que cumplí un hábito bueno con un click, para que registrar no
   cueste más que hacerlo.
10. Como usuario, quiero registrar una recaída de un hábito malo con el mismo gesto, para tener el
    dato real y no una versión editada.
11. Como usuario, quiero ver mis hábitos en la pantalla Hoy debajo del repaso, para tenerlos a mano
    sin que le compitan el lugar a la nota.
12. Como usuario, quiero ver cuánto llevo del período sin leer el número, para saber cómo voy de un
    vistazo mientras hago otra cosa.
13. Como usuario, quiero ver los últimos 14 días al abrir el panel de un hábito, para revisar cómo
    vengo sin tener esa información ocupando la pantalla todo el día.
14. Como usuario, quiero que un hábito malo se lea invertido —llenarse es perder—, para no
    confundir "voy bien" con "ya me pasé".
15. Como usuario, quiero ver el número exacto del período contra mi meta (`2/3`), para confirmar lo
    que el relleno ya me insinuó.
16. Como usuario, quiero ver mi racha de períodos cumplidos, para que la continuidad tenga peso.
17. Como usuario, quiero que un hábito malo mantenga la racha mientras no pase su techo, para que
    "no recaí" cuente como ganado y no como ausencia de dato.
18. Como usuario, quiero que el tile de un hábito malo NO parezca un checkbox de "cumplí", para no
    marcar por reflejo lo contrario de lo que quiero.
19. Como usuario, quiero arrancar un cronómetro desde el tile con un click, para que "30 min de
    lectura" se mida solo en vez de tener que calcular a mano cuánto leí.
20. Como usuario, quiero que el cronómetro **siga desde lo que ya llevo** del período, para que
    reanudar no empiece de cero.
21. Como usuario, quiero poder pausar y retomar, para que interrumpirme no me obligue a elegir entre
    perder el tiempo hecho o dejar el timer corriendo de mentira.
22. Como usuario, quiero que al llegar a la meta me llegue una notificación, para no tener que mirar
    el reloj mientras leo.
23. Como usuario, quiero que se registre solo, para no tener que anotar nada después.
24. Como usuario, quiero que el cronómetro sobreviva a un reload o a cambiar de pestaña, para poder
    seguir usando la app mientras corre.
25. Como usuario, quiero corregir el número de hoy (bajarlo, subirlo, escribirlo), para arreglar un
    mis-tap o anotar lo que hice fuera de la app.
26. Como usuario, quiero corregir **un día pasado**, porque hice gym el sábado y abrí la app el
    lunes.
27. Como usuario, quiero que un hábito de check se desmarque con el mismo click que lo marcó, para
    no necesitar un panel para deshacer algo binario.
28. Como usuario, quiero registrar con el teclado (`H` y después un dígito), para no tocar el mouse
    en la pantalla que uso todos los días.
29. Como usuario, quiero editar el nombre, la meta, el período o la métrica de un hábito, para
    ajustarlo sin perder el historial.
30. Como usuario, quiero que **subir la meta no borre mis rachas viejas**, porque cumplí contra la
    meta que tenía entonces, no contra la de hoy.
31. Como usuario, quiero archivar un hábito que ya no llevo, para sacarlo de la vista sin borrar lo
    que registré.
32. Como usuario, quiero que los hábitos sean privados por usuario igual que mis notas, para que
    apliquen las mismas reglas de RLS.

## Implementation Decisions

**Schema — 2 tablas nuevas, migración nueva `0010_habits.sql`.** El proyecto ya tiene 9 migraciones
y datos propios; se agrega migración, no se edita in place.

```sql
habits(id, user_id, name, icon, kind, metric, target, period, days, deleted_at, created_at)
  -- icon:   'lucide:<Nombre>' (preset) o URL pública del bucket. Nullable.
  -- kind:   'good' | 'bad'                    (check constraint, sin enum type)
  -- metric: 'check' | 'count' | 'time'        (check constraint; 'time' se mide en minutos)
  -- target: int not null default 1            (good = piso, bad = techo; en 'time', minutos)
  -- period: 'day' | 'week' | 'month'          (check constraint)
  -- days:   smallint[] nullable, 0=dom … 6=sáb — RECORDATORIO, no entra en ningún cálculo
habit_log(id, user_id, habit_id, day, amount, target)
  -- day:    date not null — fecha LOCAL del usuario (dayKey), no UTC
  -- amount: int not null default 1 check (amount >= 0) — 0 = no hice nada ese día
  -- target: int not null — la meta vigente ese día, congela el pct (ADR 0009)
  -- unique (habit_id, day)
```

Ver **ADR 0009** para el porqué de la fila por día y del `target` congelado, y para las
alternativas descartadas (guardar el `pct`, log de eventos con soft-delete, versionar `days`).

- RLS en ambas: `auth.uid() = user_id`, mismo patrón que `0002_rls.sql`.
- `habit_log.habit_id` → `references habits(id) on delete set null`, igual que `notes.course_id`
  (ADR 0002): el log sobrevive al hábito.
- **Soft delete solo en `habits`** (`deleted_at`). `habit_log` no lo lleva: desmarcar es
  `amount = 0`, no borrar. La app sigue sin hacer `DELETE` (`CONTEXT.md:56`).
- Sin RPC nueva, sin índices: dataset de ~10 hábitos y ~10 filas/día.

**Una sola columna (`amount`) cubre las 3 métricas.** `metric` sólo decide el gesto de la UI y el
label. Alternativa descartada: una tabla/columna por tipo de tracking.

**Derivación — `src/habits/habits.ts`, funciones puras.** Copia el enfoque de `core/lib/stats.ts`
(baja el log entero, agrega en JS, `ponytail:` comment con el techo). Piezas:

- `periodKey(date, period)`: reusa el `dayKey` de `stats.ts`. `week` = lunes de esa semana como
  `dayKey`; `month` = `YYYY-MM`. Como `habit_log.day` ya es fecha local, no hay conversión de zona
  horaria en ningún lado.
- `deriveHabit(habit, rows, now)` → `{ total, met, streak, days }`:
  - `total` = **suma de `amount`** de las filas del período actual.
  - `met` = `kind === 'good' ? total >= target : total <= target`, contra el **target vivo** para el
    período actual y contra el **`target` de las filas** para los períodos cerrados.
  - `streak` = períodos consecutivos cumplidos hacia atrás. Para `good`, el período actual todavía
    no cumplido **no corta** la racha (misma regla que `deriveReadStats`). Para `bad`, un período
    sin filas cumple.
  - `days` = serie de los últimos 14 días (índice 0 = hace 13 días, 13 = hoy) con `{ amount,
    target }` por día. Sale del mismo array de filas — cero queries extra.
- **`habits.days` no se usa acá.** No aparece en `met`, ni en `streak`, ni en la serie de 14. Vive
  únicamente en el Dialog de hábitos, como texto.

**Cliente — `src/habits/habits.api.ts`**, mismo estilo que `courses.api.ts`/`review.api.ts`:
`useHabits()`, `useHabitLog()`, `useSetDay()`, `useSaveHabit()`, `useArchiveHabit()`.

**`useSetDay({ habit, day, value })` — un upsert, no un diff.** Reemplaza al `useSetToday` del spec
anterior:

- `upsert({ habit_id, day, amount: value, target }, { onConflict: 'habit_id,day' })`.
- El `target` que se escribe es el de `habits` **solo si la fila no existía**; si ya existe, se
  respeta el que tenía (el día se congela con la meta que tenía cuando lo empezaste). Un día pasado
  sin fila se congela con el `target` actual — nadie sabe cuál regía entonces, y queda escrito acá
  que es una aproximación consciente.
- `value = 0` deja la fila en cero. No se borra nada.
- El `+1` del tile y el toggle de un `check` son este mismo camino: `value = hoy + 1` y
  `value = hoy ? 0 : 1`, con `hoy` leído del cache que `useHabitLog()` ya tiene en memoria.

**UI — tira de tiles en Hoy (`src/review/review.tsx`), entre el card de repaso y
`<Courses embed />`.** Decidido sobre el prototipo (`.scratch/habits/habits.prototype.tsx`): el card
de filas con 14 cuadrados fijos se descartó (con 5 hábitos costaba más alto que la nota), y de las
cuatro anatomías probadas (relleno, anillo, subrayado, segmentos) **ganó el relleno** — las otras
esconden el número o se rompen con metas de 150 min y con techo 0.

Anatomía del tile (`h-16`, ~200px de ancho):

```
┌────────────────────────────────┐
│  ┌──────┐   Gym                │   ← nombre: text-sm font-medium
│  │  🏋  │   2/3          🔥3  ⌄│   ← fracción: text-xs tabular-nums muted
│  └──────┘                      │
└────────────────────────────────┘
   size-10 rounded-md
```

- **Icono en caja a la izquierda**, alineado al alto. `CourseIcon` se reusa con un prop `fallback`
  nuevo: hoy cae en `BookOpen` (`course-icon.tsx:113`), que para un hábito no significa nada.
- **Nombre arriba, fracción abajo.** El número es secundario a propósito: el que comunica el
  progreso es el relleno, y la fracción confirma.
- **El tile se rellena con el progreso del período** — un `<span aria-hidden>` de fondo con
  `width: N%`, no un `background-image`, así el texto de arriba nunca cambia de color.
- **El color del relleno es dato, no decoración**: se mezcla rojo (lo que falta) con verde (lo
  hecho), así el tile **va de rojo a verde a medida que se llena**.

  ```ts
  const done = kind === "good" ? pct : 100 - pct
  const scale = `color-mix(in oklab, var(--brand) ${done}%, var(--destructive))`
  return `color-mix(in oklab, ${scale} 30%, var(--card))` // 30% = cuánto pega contra el fondo
  ```

  La segunda mezcla va contra **`var(--card)`, no `transparent`**: mantiene legible el texto y da
  vuelta la escala sola entre tema claro y oscuro (ADR 0005: sin design system formal).

- **Un `bad` se lee invertido**: borde punteado, `−`, y la escala al revés (`100 - pct`), vacío
  verde y techo rojo. **El punteado significa "todavía tenés margen"**; pasado el techo el borde se
  cierra (sólido `destructive`) y el relleno va al 100% — el rojo lo da la fórmula sola
  (`pct = 100` → `done = 0`), no un caso especial.
- **Con techo `0` el tile muestra el número solo, sin fracción.** `7/0` no quiere decir nada.
- **Estado según métrica**: `check` → ✓ o "hoy" · `count` → `2/3` · `time` → `45/150 min` + `▶`.
  El "máx" de un `bad` no entra en el tile (lo dicen el borde punteado y el `−`).
- **La fracción no cambia de ancho.** `tabular-nums` + `min-width` por métrica: con el cronómetro
  corriendo ese número sube cada segundo y sin ancho fijo el tile late.
- **La racha aparece sólo si es ≥ 2.** Un `🔥 0` es ruido y desmoraliza.
- **Overflow: wrap con tope de 2 filas + "ver todos"**, que abre el Dialog. Techo duro de alto
  (~130px) en la pantalla donde vive la nota, y en mobile —donde entran 1 o 2 por fila— no empuja
  la nota fuera de vista.
- **Orden fijo por `created_at`.** Nada reordena la tira: si los "hoy toca" subieran al frente,
  `h>2` sería otro hábito según el día y el chord se vuelve inusable.
- **`days` no se dibuja en la tira.** Vive en el Dialog.
- Sin gráfico, sin calendario, sin pantalla de stats (`CONTEXT.md:89` lo prohíbe explícito).

**El panel del `⌄` — `Dropover` (`src/core/ui/dropover.tsx`), no Tooltip ni Dialog.** Una sola
superficie reemplaza a las dos del spec anterior:

- `Dropover` ya existe y tiene test: **Popover en desktop, Drawer desde abajo en mobile**. Un
  Tooltip de Radix no sirve — se cierra en pointer-down, su contenido no es focusable, y en mobile
  no hay hover (o sea: los 14 días serían inalcanzables desde el celular, donde ADR 0004 dice que
  se repasa).
- Contenido: meta completa (`3/semana`), los **14 días** en cuadraditos, y el **stepper `− N +`**
  del día seleccionado (hoy por defecto) con presets (`0/10/25/45/60 min` o `0/1/2/3/5`; el `0`
  primero: "no lo hice" es la corrección más común).
- **Click en un cuadrado cambia el día que editás.** El título dice qué día (`Gym — sáb 15 ago`).
- **El `⌄` existe en las 3 métricas**, también en `check`: aunque hoy sea un toggle, corregir el
  sábado pasado necesita el panel.
- **Un día no es sí/no: el color del cuadrado sale de la fracción hecha.** Meta 25 min y 10 hechos =
  verde flojo. `color-mix(in oklab, var(--brand) ${25 + ratio * 75}%, var(--muted))`, con
  `ratio = amount / meta diaria` y la meta diaria sacada del **`target` congelado de esa fila**
  (`day` → `target`, `week` → `target/7`, `month` → `target/30`). Se mezcla contra `var(--muted)`
  (no `transparent`) para que la escala se dé vuelta sola entre temas; el piso de 25% existe para
  que "hice algo" nunca se vea igual que "no hice nada".

**Vista completa — Dialog `src/habits/habits-dialog.tsx`.** Se abre desde un `⚙`/`+` al final de la
tira y desde el "ver todos" del overflow. Lista todos los hábitos con nombre, icono, meta, período,
**`days`** y racha; ahí se crea, se edita y se archiva. Absorbe lo que el spec anterior tenía en
`habit-form.tsx`. Dialog y no ruta: overlay no reabre "solo 3 pantallas" (`ui-principles.md:52`),
mismo criterio que el Settings dialog de `CONTEXT.md:102-106`.

**Cronómetro (`time`) — cuenta para arriba desde lo acumulado.**

```
localStorage bita-timer = { habitId, startedAt }      ← 2 campos, nada más

mostrado    = amount del período (DB) + (Date.now() - startedAt)
pausa/corte = upsert amount = amount + round(elapsed en minutos) → limpia el localStorage
play        = startedAt = now                                    → la base vuelve a salir de la DB
notifica    = cuando mostrado >= target
```

- **No hay "duración de sesión".** El timer corre hasta la meta y avisa. El chunk de 30 min que
  inventó el prototipo para metas semanales no hace falta.
- **Pausar y reanudar entra al MVP** — estaba fuera por "el doble de estado", y con una fila por día
  el acumulado ya está guardado: es `amount`.
- **Escribe en la DB en cada pausa.** El tiempo hecho nunca se pierde y el acumulado cruza de
  dispositivo. Costo: redondeo a minuto por pausa (±30s, `round` no `floor`, se compensa solo).
- El transcurrido se calcula **siempre** como `Date.now() - startedAt`, nunca contando ticks del
  `setInterval`: un tab en background throttlea el interval. El interval sólo repinta.
- Sobrevive reload y cambio de pestaña porque `startedAt` está en `localStorage`.
- **El tile no tiene modo especial mientras corre.** Sigue mostrando `107/150 min` con el mismo
  relleno; sólo el `▶` pasa a `■`. Es menos código que el modo running del spec anterior.
- Un solo timer a la vez. `ponytail:` timers paralelos el día que alguien lea y corra a la vez.
- **Notificación:** `Notification` API, permiso pedido al arrancar el primer timer. Toast de sonner
  siempre, como fallback si el permiso está denegado.
- `ponytail:` la notificación sólo llega **con la app abierta** (el tab puede estar de fondo). Push
  con la app cerrada necesita service worker + servidor: rompe el "$0" de `CONTEXT.md:27`.

**La meta va en el subtítulo del Dropover, en texto**: `1/día`, `150 min/semana`, `máx 0/día`. Un
número suelto no dice si es piso o techo — el `máx` sí.

**Teclado — chord `h>1..9`**, calcado de `g>1..9` (`app.tsx:245-255`): un componente = un hook por
dígito, porque la lib comparte el buffer de secuencia entre atajos de la misma llamada. Numeración =
el orden de los tiles (`created_at`). Va en la pantalla Hoy, no global. Chord y no letra bare
(`ui-principles.md:40-45`). **El dígito no se dibuja** — mismo precedente que `g>1..9`, que monta
`CourseHotkey` invisibles (`app.tsx:234-236`) y vive en el cheatsheet. En un `time`, `h>N`
arranca/pausa el cronómetro: la misma acción que el click.

## Testing Decisions

Dos seams, no más. El valor está en la derivación, que es donde vive toda la lógica no trivial.

- **Seam 1 — `src/habits/habits.test.ts` (nuevo).** `deriveHabit` puro, con `now` fijo: good con
  `3/week` a mitad de semana da `met: false` sin cortar racha; good que llega al target da
  `met: true`; bad con `target: 0` y cero filas cumple y suma racha; bad con una fila corta la
  racha; una recaída en el período anterior no borra los períodos limpios previos; un hábito `time`
  suma `amount` (30 + 45 = 75), no cuenta filas; `days` tiene 14 posiciones; **un período cerrado
  con `target` congelado en 10 sigue cumplido después de subir `habits.target` a 20** (el caso que
  motivó el ADR 0009); `habits.days` no cambia ningún resultado (mismo log, con y sin `days`, da
  idéntico `met`/`streak`).
- **Seam 2 — `src/review/review.test.tsx` (extender).** Click en un tile `count` hace exactamente 1
  upsert con `habit_id`, `day` y `amount: 1`; un segundo click upsertea `amount: 2` (no inserta una
  fila nueva); click en un `check` ya marcado lo deja en `amount: 0`; el chord `h>1` registra el
  primer hábito; los tiles no rompen `Enter`/`J`/`K` del repaso.
- **`src/habits/habit-timer.test.ts`** — puro, con `Date.now` mockeado: pausar a los 90s suma 2 a lo
  que había; reanudar parte del acumulado de la DB, no de cero; leer el estado con un `startedAt`
  viejo en `localStorage` devuelve el transcurrido correcto (la prueba de que sobrevive al reload).

Sin tests de SQL: el repo no testea RPCs ni RLS hoy, no se abre esa práctica acá.

## Out of Scope

- **Reescribir días más viejos que 14.** El panel muestra 14 cuadrados; más atrás es un calendario,
  que es otra UI y otro spec.
- **Undo con toast.** El panel cubre el mis-tap: abrís, bajás, guardás.
- **Recordatorios / notificaciones push.** Necesitan service worker + servidor; rompe el "$0".
- **Gráficos, calendario tipo heatmap, pantalla de stats.** Prohibido explícito por `CONTEXT.md:89`.
- **Que `days` afecte las métricas** (racha que saltea días no programados, tile apagado los días
  que no toca). Decisión consciente, no olvido: ver ADR 0009. Un hábito de días fijos se modela como
  cupo.
- **Cronómetros en paralelo.** Uno a la vez.
- **Cronómetro en hábitos `count`/`check`.** Sólo `time`.
- **Unidades libres** (vasos, km, páginas). `time` = minutos y listo.
- **Guardar la hora exacta de cada registro.** Una fila por día no la tiene. Ninguna pantalla la
  muestra; recuperarla es una tabla de eventos aparte, no revertir el ADR 0009.
- **Metas de estudio (`goals`)**. Siguen descartadas — son derivables de `read_log`, esto no.
- **Reordenar hábitos a mano.** El orden es `created_at`; alcanza para ~10 tiles.
- **Card de filas con los 14 días siempre visibles.** Se prototipó y se descartó: con 5 hábitos
  ocupaba más alto que la nota.
- **Ventana configurable del tracking.** 14 días fijos.

## Further Notes

- **Por qué se reabre el gate.** `CONTEXT.md:97-100` gatea "seguimiento de hábitos" por ser el mismo
  territorio que `goals`. No lo es: `goals` eran metas de estudio derivables de `read_log`, miradas
  1×/semana; esto es una entidad con log propio, tocada a diario, que incluye hábitos **malos** —
  algo que ningún derivado de `read_log` puede expresar. Aun así el gate original (loop diario sin
  uso real confirmado) sigue sin resolverse: este spec se construye igual **por decisión consciente
  del usuario**, mismo precedente que dejó escrito el spec de flashcards.
- **Qué cambió en la segunda ronda de grilling (2026-08-20).** El modelo pasó de log de eventos con
  soft-delete a una fila por día con `target` congelado (ADR 0009); `days` entró como recordatorio
  puro; el Tooltip y el dialog del editor se fusionaron en un `Dropover`; editar días pasados y
  pausar el cronómetro salieron de Out of Scope porque el modelo nuevo los hace gratis; el chip de
  una línea pasó a tile de dos con el icono a la izquierda.
- Actualizar `CONTEXT.md` es parte del trabajo (issue 05), no un extra.
