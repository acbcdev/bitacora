# Hábitos: lista + detalle con historia estilo GitHub

**Status:** ready-for-agent — prototipo 2026-11-06 (variant F de `src/habits/habits-dialog.prototype.html`).

## Problem Statement

La vista completa de hábitos (el HabitsDialog, "Hábitos · N activos") es una grilla de cards de 3
columnas. Cada card muestra una Serie de hábito corta (7 días / 5 semanas / 4 meses), así que no
se ve la historia: no se puede saber de un vistazo si un hábito se sostuvo en los últimos meses o
se cayó en octubre.

Editar un hábito cuesta tres pasos: hover para que aparezca el `⋯` (invisible hasta entonces),
click en "Editar", y la vista cambia entera a otro form, perdiendo de vista la historia y los
demás hábitos. Tampoco hay forma de recorrer los hábitos con el teclado.

## Solution

El HabitsDialog pasa a ser **lista + detalle**:

- **A la izquierda**, la lista de hábitos: ícono, nombre y racha. Uno siempre está seleccionado.
- **A la derecha**, el detalle del hábito seleccionado, que ya es el form de edición: el nombre
  como título editable, los pills (métrica, meta, frecuencia), la **historia estilo GitHub**
  (contribution graph de 26 semanas, una columna por semana y labels de meses) y al pie la meta en
  vivo + Archivar / Cancelar / Guardar.
- No hay "modo edición": cambiás un campo y guardás.
- Se cambia de hábito con un click en la lista, con `↑`/`↓` desde la lista o con `⌥J`/`⌥K` desde
  cualquier parte del dialog, incluso escribiendo en el form.

La historia respeta el período del hábito:

- **Diario:** grilla de 7 filas (lun→dom) × 26 columnas; cada cuadrado es un día, con la tinta
  proporcional a lo cumplido.
- **Semanal:** cada columna es una semana y cada cuadrado **una vez de la meta**, que se llena de
  abajo hacia arriba. "3 por semana" = 3 cuadrados por columna, y si hiciste 2 se encienden 2. Un
  `check` semanal es una sola fila.
- **Mensual:** igual que el semanal, pero con una columna por mes.

## User Stories

1. As a usuario, I want ver todos mis hábitos en una lista compacta al abrir Hábitos, so that ubico cualquiera sin scrollear una grilla de cards.
2. As a usuario, I want que al abrir el dialog quede seleccionado el primer hábito, so that el detalle nunca está vacío.
3. As a usuario, I want ver la racha de cada hábito en la lista, so that sé cuáles vengo sosteniendo sin abrirlos.
4. As a usuario, I want hacer click en un hábito de la lista y ver su detalle al lado, so that no pierdo la lista de vista.
5. As a usuario, I want ver la historia de las últimas 26 semanas como un contribution graph, so that detecto rachas y caídas de meses de un vistazo.
6. As a usuario, I want labels de meses arriba del graph, so that sé cuándo pasó cada cosa.
7. As a usuario, I want que en un hábito diario cada cuadrado sea un día con intensidad proporcional a lo cumplido, so that distingo "hice la mitad" de "no hice nada".
8. As a usuario, I want que en un hábito semanal cada columna sea una semana y cada cuadrado una vez de la meta, so that veo cuántas de las N veces hice cada semana sin leer números.
9. As a usuario, I want que un hábito `check` semanal se vea como una sola fila de cuadrados, so that no aparece altura vacía sin sentido.
10. As a usuario, I want que un hábito mensual use una columna por mes con la misma lógica de cuadrados, so that la historia está en la escala de su período (ADR 0013).
11. As a usuario, I want un tooltip en cada cuadrado con la fecha (o la semana o el mes) y lo cumplido, so that puedo leer el dato exacto si lo necesito.
12. As a usuario, I want que el graph sea monocromo, con tinta sobre `--track`, so that respeta el lenguaje visual D (ADR 0023).
13. As a usuario, I want que el período anterior a la creación del hábito aparezca vacío (track), so that no parece que fallé días en que el hábito no existía.
14. As a usuario, I want editar el nombre directamente en el título del detalle, so that renombrar es un click.
15. As a usuario, I want cambiar métrica, meta y frecuencia con los mismos pills del form actual, so that no aprendo una UI nueva.
16. As a usuario, I want que con métrica "Hecho" desaparezca el pill del número, so that no me piden una meta que no aplica.
17. As a usuario, I want ver la meta resultante en vivo ("3/semana") mientras edito, so that sé qué voy a guardar antes de guardar.
18. As a usuario, I want que Guardar solo esté habilitado si cambié algo, so that sé si hay cambios pendientes.
19. As a usuario, I want que Cancelar vuelva a los valores guardados sin cerrar el dialog, so that deshago un cambio y sigo mirando.
20. As a usuario, I want que al guardar se actualicen la lista y el detalle al instante, so that veo el nombre nuevo sin recargar.
21. As a usuario, I want archivar desde el detalle con la misma confirmación de hoy, so that no archivo por accidente.
22. As a usuario, I want que después de archivar quede seleccionado el hábito siguiente (o el anterior si era el último), so that el detalle no queda vacío.
23. As a usuario, I want que "Nuevo" muestre en el detalle un form vacío para crear, so that crear y editar son la misma superficie.
24. As a usuario, I want que al crear un hábito quede seleccionado en la lista, so that veo enseguida lo que creé.
25. As a usuario, I want que "Nuevo hábito" desde el command palette siga abriendo el dialog directo en el form de crear, so that el atajo existente no cambia.
26. As a usuario de teclado, I want moverme entre hábitos con `↑`/`↓` cuando el foco está en la lista, so that recorro la lista como cualquier listbox.
27. As a usuario de teclado, I want saltar al hábito siguiente o anterior con `⌥J`/`⌥K` desde cualquier parte del dialog, incluso escribiendo en un input, so that reviso varios hábitos sin tocar el mouse.
28. As a usuario de teclado, I want que `⌥J`/`⌥K` sean los mismos que uso para moverme entre notas, so that no memorizo otro par de teclas.
29. As a usuario de teclado, I want que la navegación no dé la vuelta (en el último, `⌥J` no hace nada), so that no me desoriento.
30. As a usuario de teclado, I want que `Enter` en el form guarde, so that edito sin ir al botón.
31. As a usuario de teclado, I want que `Esc` siga cerrando el dialog, so that salgo como siempre.
32. As a usuario, I want ver los atajos del dialog de Hábitos en el cheatsheet (`⌘/`), so that los descubro.
33. As a usuario, I want que al cambiar de hábito con cambios sin guardar el draft se descarte, so that el form siempre muestra al hábito seleccionado.
34. As a usuario mobile, I want ver primero la lista y tocar un hábito para abrir su detalle con un "volver", so that la vista entra en pantalla chica.
35. As a usuario de lector de pantalla, I want que la lista se anuncie como listbox con la opción seleccionada, so that sé en qué hábito estoy.
36. As a usuario de lector de pantalla, I want que el graph tenga un label resumido ("Últimas 26 semanas de Read: …"), so that no recorro 182 celdas.
37. As a usuario sin hábitos, I want ver el estado vacío con "Nuevo" en vez de una lista vacía, so that sé qué hacer.

## Implementation Decisions

- **Superficie:** se rehace la vista lista del **HabitsDialog**. Sigue siendo un Drialog, no una
  ruta (ui-principles, mismo criterio de hoy). Muere la grilla de cards y el `⋯` con su
  DropdownMenu: Editar deja de ser una acción, y Archivar pasa a ser un botón del detalle.
- **Un solo estado de selección** en el dialog: el id del hábito seleccionado, o "nuevo". Ese id
  reemplaza al `form: Habit | "new" | null` actual. Ya no existe un estado "lista sin form".
- **El detalle reusa HabitForm.** El form existente (nombre como título + pills + meta en vivo)
  gana un espacio entre los pills y la barra para la historia. El draft del form se **resetea por
  id**, con el mismo patrón que el draft de nota de ADR 0015 (remount keyeado al id): cambiar de
  hábito descarta lo no guardado. Cancelar resetea al guardado y no cierra el dialog (hoy cierra).
- **Guardar habilitado solo con cambios** (draft ≠ hábito guardado). Al crear se habilita con
  nombre no vacío, como hoy.
- **Historia larga = derivación nueva, no tocar `SERIES`.** `SERIES` (7/5/4) alimenta los dots del
  tile y el HabitPanel, y no cambia. Se agrega una derivación pura junto a `deriveHabit` en
  derive: dado un hábito, el log y un rango de 26 semanas que termina hoy, devuelve celdas en el
  período del hábito (`day` → días desde el lunes de hace 25 semanas hasta hoy; `week` → 26
  semanas; `month` → los meses que toca el rango). Cada celda trae `amount`, el `target` congelado
  (misma regla de ADR 0009: celda cerrada contra el target de sus filas, celda actual contra
  `habits.target`) y si la celda es anterior a `created_at`. La DB no cambia.
- **Render del graph:**
  - Columnas = semanas (lun→dom, la semana empieza en lunes como `periodKey`). Diario: 7 filas.
  - Semanal/mensual: filas = `min(target, 7)` (1 si `check`), y los cuadrados encendidos son
    `round(fracción × filas)`, llenados de abajo hacia arriba. Encendido = tinta plena, apagado =
    `--track`.
  - Diario: tinta proporcional con la misma fórmula de `cellColor`/ADR 0023. Pre-creación = `--track`.
  - Celdas de 20px con gap de 4px. Labels de meses en la primera columna de cada mes.
  - Decisión del prototipo (snippet adaptado):

    ```js
    // semana/mes: columna = período, cuadrado = una vez de la meta, se llena de abajo hacia arriba
    const rows = Math.min(h.metric === "check" ? 1 : h.target, 7)
    const done = Math.round(fraction * rows)
    const on = (r) => r >= rows - done   // grid-auto-flow: column llena de arriba hacia abajo
    ```

  - Metas `time` semanales o mensuales: el target viene en segundos (ADR 0011), así que se usa el
    target **en display** (minutos) y el tope de 7 filas. Ver Further Notes.
- **Lista:** `role="listbox"` con `aria-activedescendant` (o roving tabindex); cada opción tiene
  ícono, nombre y racha (`streakText`, mostrada solo con racha ≥ 2 como hoy). El orden es el de la
  tira (created_at).
- **Atajos** (ADR 0017/0024):
  - `↑`/`↓`: con foco en la lista, mueven la selección. Es semántica nativa de listbox, no un hotkey global.
  - `⌥J` / `⌥K`: siguiente / anterior, en todo el dialog **incluidos los inputs del form**
    (`enableOnFormTags`). Es el mismo par que la navegación entre notas (ADR 0024), y `J`/`K` no
    son dead keys de macOS. No da la vuelta. Se registra con el hook de hotkeys seguro existente.
  - `Enter` en el form = submit nativo. `Esc` = cerrar el dialog (ya existe).
  - El cheatsheet gana un grupo **"Hábitos"** con `↑ / ↓` y `⌥J / ⌥K` (usar el helper `alt()`).
  - Descartados: `J`/`K` bare (las letras escriben en el form, ADR 0017) y `←`/`→` (mueven el caret
    en los inputs).
- **Archivar:** se mantiene ConfirmDelete + `useArchiveHabit`. Después de archivar se selecciona el
  siguiente, o el anterior si era el último, o el estado vacío si no queda ninguno.
- **Crear:** "Nuevo" pone la selección en "nuevo" y el detalle muestra HabitForm vacío. Si crea,
  selecciona el id nuevo. Si cancela, vuelve a la selección anterior (o al primero). `startNew` sigue
  existiendo para el command palette.
- **Layout:** en desktop, el dialog de ancho fijo actual (`md:w-240`) con lista de 260px + detalle,
  y alto fijo (como hoy, para que no salte). En mobile, la lista ocupa todo y tocar un hábito abre
  el detalle a pantalla completa con "volver".

## Testing Decisions

- **Un test bueno** ejercita el comportamiento externo: lo que el usuario ve y lo que llega al
  store. Nunca estado interno, clases CSS ni cantidad de renders.
- **Seam principal — el componente HabitsDialog** renderizado con `@/core/store` mockeado
  (snapshot con habits + habitLog, `save` como spy). Es el seam que ya usa el test del dialog, y
  cubre:
  - seleccionar en la lista cambia el título del detalle;
  - `⌥J`/`⌥K` mueven la selección, también con foco en el input de nombre, y no dan la vuelta;
  - `↑`/`↓` en la lista;
  - editar + Guardar manda `save("habits", …)` con los campos nuevos; Guardar arranca deshabilitado;
  - Cancelar resetea sin cerrar; cambiar de hábito descarta el draft;
  - archivar selecciona el siguiente;
  - "Nuevo" muestra el form vacío y crear selecciona el nuevo;
  - el graph expone su `aria-label` resumido.
- **Seam secundario — la derivación de historia** como función pura, en el mismo estilo que los
  tests de `deriveHabit`/`habits.test.ts`: largo correcto por período, target congelado por celda,
  celdas pre-`created_at` marcadas, semana empezando en lunes, mes parcial al borde del rango.
- **Prior art:** el test del dialog (crear con `period: week`), `habits.test.ts`, y los tests del
  store/derive. Para los hotkeys, los tests existentes de `h>N` en el test de los tiles.

## Out of Scope

- Cambiar la tira de Hoy (HabitTiles), sus dots o el HabitPanel: siguen con `SERIES` 7/5/4.
- Un graph agregado de todos los hábitos (estilo perfil de GitHub): necesitaría una métrica nueva.
- Corregir registros desde el graph (click en un cuadrado para editar ese día): corregir sigue
  siendo el `⌄` del HabitPanel.
- Rango configurable (52 semanas, "todo"), zoom, scroll horizontal del graph.
- Autosave del form de hábito.
- Hábitos `bad`: no se crean desde el form, pero los que existan se tienen que ver bien. El graph
  usa el `pct` invertido como `cellColor`. Sin diseño especial.
- Reordenar hábitos.

## Further Notes

- **Origen:** prototipo `src/habits/habits-dialog.prototype.html`, que tiene 6 variants
  (A grid actual, B lista densa, C lista+detalle, D GitHub, E compacto+inline, F = C+D). El usuario
  eligió **F**, con los semanales como cuadrados apilados por meta y dots grandes (20px). El
  prototipo usa historia **mock** (determinística por nombre) y métricas adivinadas desde el
  screenshot: el look está validado, los números no. Según la skill de prototype, el archivo debe ir
  a una branch descartable (p. ej. `prototype/habits-github`), no a main.
- **Tope de 7 filas:** una meta como `20 min/semana` o `10/semana` no puede ser 20 cuadrados. Con el
  tope, `round(fracción × 7)` aproxima. Si aparecen metas así en uso real, la alternativa es un solo
  cuadrado por período con intensidad proporcional (como los diarios).
- **Draft descartado al navegar:** se eligió el reset por id (precedente ADR 0015) por ser lo más
  simple. Si en uso real se pierden ediciones con `⌥J`, la alternativa es guardar al cambiar de
  hábito.
- **CONTEXT.md desactualizado:** la entrada "Serie de hábito" dice 14 días / 7 semanas / 6 meses,
  pero el código tiene `SERIES = { day: 7, week: 5, month: 4 }`. Al implementar, corregir el
  glosario y agregar el término **Historia de hábito** (la derivación de 26 semanas del dialog),
  para no confundirla con la Serie.
