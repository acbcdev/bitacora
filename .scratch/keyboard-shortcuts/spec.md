# Feature: shortcuts nuevos + consistencia entre vistas

**Status:** ready-for-agent
**Blocked by:** ninguno

Resultado del grill en `to-grill-keyboard-shortcuts.md`. Cubre: nav por teclado en Cursos (lista),
editar/borrar por teclado, foco en buscador, y dos bugs reales encontrados en el camino (Space en
el dialog de Repaso, F en Nota) que se arreglan con el mismo criterio.

## Problem Statement

`docs/ui-principles.md` promete "cada acción frecuente tiene un shortcut", pero Cursos (la lista)
es mouse-only: abrir, editar o borrar un curso, y buscar, no tienen atajo. Además hay dos bugs de
la misma familia ya en producción: `Space` en Repaso marca una nota como leída aunque el dialog de
nota completa esté abierto y el usuario no haya terminado de leer; `F` en Nota (forzado
`enableOnContentEditable`) se dispara al escribir la letra "f" dentro de una nota, porque el foco
en esa vista vive siempre en título/editor.

## Solution

1. **Cursos (lista):** nav por teclado sobre `rows` + editar/borrar + foco al buscador.
2. **Repaso:** `Space` se elimina, `Enter` lo reemplaza, gateado por visibilidad del botón "Marcar
   leído" cuando el dialog de nota está abierto.
3. **Nota / Course:** el patrón bare+`mod+` ya usado para `mod+k` se extiende a `F` (Nota) y a la
   nav entre notas (Course), y se agrega `mod+backspace` para borrar nota.
4. `docs/ui-principles.md` gana una tabla de convención de teclas (ver `to-grill-keyboard-shortcuts.md`)
   y `src/core/components/cheatsheet.tsx` se actualiza para reflejar todo lo de acá.

## User Stories

1. Como usuario, quiero moverme entre las filas/cards de Cursos con `J`/`K`/`Left`/`Right` sin
   tocar el mouse, para no perder el hábito de teclado que ya tengo en Repaso y Course.
2. Como usuario, quiero abrir el curso seleccionado con `Enter`, yendo al mismo lugar que hoy abre
   el click (`/course/:id`), para no aprender un flujo nuevo.
3. Como usuario, quiero editar el curso seleccionado con `E`, para no tener que abrir el menú de
   acciones con el mouse.
4. Como usuario, quiero borrar el curso seleccionado con `Delete`/`Backspace`, con la misma
   confirmación que ya existe, para no borrar por accidente.
5. Como usuario, quiero enfocar el buscador con `/`, para no tener que clickearlo primero.
6. Como usuario, quiero que `Esc` con el buscador enfocado limpie el texto y me devuelva a navegar
   la lista, para cortar una búsqueda a medias sin volver a tocar el mouse.
7. Como usuario, quiero que `Space` deje de marcar una nota como leída mientras tengo el dialog de
   nota completa abierto, para no perder el registro de una ronda que todavía no terminé de leer.
8. Como usuario, quiero marcar una nota como leída con `Enter` una vez que scrolleé hasta ver el
   botón "Marcar leído", para tener una señal de teclado que sí respeta que leí el contenido.
9. Como usuario, quiero que `Enter` en la card cerrada (sin dialog) marque leído al toque igual que
   hacía `Space`, porque ahí el contenido corto ya está completo a la vista, sin necesidad de gate.
10. Como usuario, quiero que `Enter` revele una flashcard sin revelar, igual que hacía `Space`, para
    no perder ese flujo.
11. Como usuario, quiero que escribir la letra "f" dentro de una nota ya NO dispare el focus mode,
    para poder escribir sin interrupciones.
12. Como usuario, quiero poder togglear focus mode con `Mod+F` mientras estoy escribiendo en una
    nota, para no perder esa acción solo porque se sacó el bare `f` forzado.
13. Como usuario, quiero moverme entre notas de un curso con `Mod+J`/`Mod+Left`/`Mod+K`/`Mod+Right`
    mientras el cursor está adentro del editor, para no tener que clickear afuera primero.
14. Como usuario, quiero seguir usando `J`/`Left`/`K`/`Right` (sin `Mod`) para lo mismo cuando el
    foco NO está en el editor, para no perder el atajo que ya funciona hoy en ese caso.
15. Como usuario, quiero borrar una nota con `Mod+Backspace`, para no depender solo del botón de
    basurero.

## Implementation Decisions

**`src/review/review.tsx`:**
- Sacar `onSpace` y `useHotkeys("space", ...)`.
- Agregar un `ref` (`markReadBtnRef`) al `Button` "Marcar leído" que está *adentro* del dialog
  (el de la card cerrada no lo necesita — ver siguiente punto).
- `useEffect` que, mientras `dialogOpen` es true, observa ese ref con un `IntersectionObserver` y
  guarda en estado (`readyToMark`) si está visible. Se limpia el observer al cerrar el dialog o
  cambiar de nota (dep `[dialogOpen, note?.id]`).
- `onEnter`: si es flashcard sin revelar → revela. Si `dialogOpen && !readyToMark` → no hace nada
  (todavía no llegaste al botón). Si no, `markNoteRead()`. La card cerrada (`!dialogOpen`) marca
  directo, sin gate — el contenido corto ya está completo a la vista, no hace falta scrollear.
- `useHotkeys("enter", onEnter, { preventDefault: true, enabled: !confirmingDelete }, [...])` — el
  `enabled` evita que el mismo `Enter` dispare en paralelo con el `AlertDialogAction`/`Cancelar`
  del `ConfirmDelete` de una flashcard (ambos responden a Enter sobre un botón enfocado por
  default del navegador).
- El click en el botón "Marcar leído" (card o dialog) sigue llamando `markNoteRead` directo, sin
  gate — llegar a clickearlo ya implica haber scrolleado hasta ahí.
- Actualizar el hint de flashcard sin revelar: `<Kbd>Space</Kbd> revelar respuesta` →
  `<Kbd>Enter</Kbd> revelar respuesta`.

**`src/notes/note.tsx`:**
- `f`: sacar `enableOnContentEditable`/`enableOnFormTags` forzados (vuelve al default de la lib:
  se desactiva mientras el foco está en editable).
- Agregar `mod+f` con `{ enableOnFormTags: true, enableOnContentEditable: true, preventDefault: true }`
  para el mismo `setFocus(!focus)`.
- Agregar `mod+backspace` (mismo `globalScope` forzado) que abre `setConfirming(true)` — reusa el
  `ConfirmDelete` que ya existe, sin bare alias (acción destructiva, no hace falta que ande fuera
  del editor).
- `escape` (salir de focus) sin cambios — no produce carácter, no choca con escribir.

**`src/courses/course.tsx`:**
- Mantener `useHotkeys("j,left", ...)` / `useHotkeys("k,right", ...)` tal cual (sin forzar,
  siguen funcionando cuando el foco no está en el editor embebido).
- Agregar en paralelo `useHotkeys("mod+j,mod+left", () => step("back"), { enableOnContentEditable: true, preventDefault: true }, [...])`
  y el equivalente `mod+k,mod+right` para `step("forward")` — misma función `step`, forzados para
  cuando el foco está adentro del `NoteEditor` embebido.

**`src/courses/courses.tsx`:**
- Estado de selección: un índice (o id) sobre `rows` (el array ya filtrado/ordenado). Reset a 0
  (o `undefined`) cuando cambian `q`/`status`/`sort` para no dejar seleccionada una fila que ya no
  está en la lista filtrada.
- `useHotkeys("j,left", ...)` → mueve selección atrás (clamp en 0); `"k,right"` → adelante (clamp
  en `rows.length - 1`). Sin `mod+`: la lista no tiene contenido editable (el buscador es un campo
  aparte, y el default de la lib ya lo excluye).
- `useHotkeys("enter", ...)` → `navigate(`/course/${rows[selected].id}`)` — mismo destino que el
  `onClick` de la fila/card hoy.
- `useHotkeys("e", ...)` → `setEditing(rows[selected])` (abre `CourseForm`, mismo flujo que
  "Editar" del `RowActions`).
- `useHotkeys("backspace,delete", ...)` → abre el `ConfirmDelete` para `rows[selected]` (extraer el
  `confirming`/`ConfirmDelete` que hoy vive dentro de `RowActions` a un estado en `Courses`, o
  levantarlo — el implementador elige, pero la confirmación tiene que seguir siendo la misma).
- Visual: la fila/card seleccionada necesita alguna indicación (reusar el patrón `data-active` que
  ya usa `course.tsx` para el ítem de nota seleccionado, aplicado a `TableRow`/`Card`).
- `useHotkeys("/", () => searchRef.current?.focus(), { preventDefault: true })` — necesita un
  `ref` nuevo en el `InputGroupInput` del buscador.
- En el buscador: `onKeyDown` (o un `useHotkeys("escape", ...)` scoped) que, si `q !== ""`, hace
  `setQ("")` y `blur()`; si ya está vacío, solo `blur()`. Esto es local al input, no un hotkey
  global — evitar que choque con el `Esc` global de otras vistas.

**`src/core/components/cheatsheet.tsx`:**
- Grupo "Repaso": `Space` → `Enter` (dos líneas: "marcar leído + siguiente" y, si hace falta,
  aclarar el gate del dialog en el texto).
- Grupo "Cursos": agregar `J/K`, `Enter`, `E`, `Delete`, `/`.
- Grupo "Nota": `F` → `F` (bare) queda igual en el texto visible al usuario (el cheatsheet no
  necesita explicar la mecánica interna de bare vs `mod+`, salvo que el implementador prefiera
  documentar `Mod+F`/`Mod+J`/`Mod+K`/`Mod+Backspace` explícitamente como variante "mientras
  escribís" — decisión de redacción, no bloqueante).

## Testing Decisions

Mismo criterio que ya sigue `review.test.tsx`/`courses.test.tsx` (mock del cliente Supabase,
`fireEvent.keyDown(document, { code: "KeyX" })`, comportamiento observable).

- **`src/review/review.test.tsx`:** actualizar el test que hoy usa `code: "Space"` a `code: "Enter"`
  para el caso "card cerrada marca al toque". Agregar: `Enter` dentro del dialog NO llama a
  `insertReadLog` si el botón todavía no es visible (mock/stub de `IntersectionObserver` — jsdom no
  lo implementa, hay que poner un stub en el setup de test o en el archivo); sí llama una vez que
  el observer reporta `isIntersecting: true`. Agregar: con `confirmingDelete` true, `Enter` no
  dispara `markNoteRead`.
- **`src/courses/courses.test.tsx`:** agregar casos — `K`/`J` mueven la selección visual; `Enter`
  navega (`MemoryRouter` + assert de la ruta, mismo patrón que otros tests con router); `E` abre
  el form de editar (`CourseForm` visible); `Delete` abre el `ConfirmDelete`; `/` enfoca el input
  del buscador (`document.activeElement`).
- **`src/courses/course.test.tsx`:** agregar caso — `mod+k`/`mod+j` mueven entre notas incluso con
  el foco puesto en el editor mockeado (o directamente en el body, ya que `Editor` está mockeado a
  un `div` sin contenido editable real en el test — alcanza con firear el keydown con `ctrlKey`/
  `metaKey: true` y confirmar que navega).
- **`src/notes/note.tsx`** no tiene test hoy (no hay `note.test.tsx` en el repo) — no se agrega uno
  nuevo solo por este cambio, sigue el mismo criterio que ya aplica el repo (no hay precedente para
  esta vista).

`IntersectionObserver` no existe en jsdom: falta confirmar si el repo ya tiene un stub global en
`src/test/setup.ts` — si no, agregarlo ahí (mock mínimo con `observe`/`disconnect` no-op más un
modo de disparar el callback manualmente desde el test) en vez de mockearlo por archivo.

## Out of Scope

- **Dialog de preview en Cursos** (ver un curso en un dialog tipo Repaso antes de entrar a la
  página completa) — se propuso y se descartó explícito en el grill: no era lo que el usuario
  pedía, y la lista de Cursos sigue navegando igual que hoy (`Enter`/click van directo a
  `/course/:id`).
- **Nav 2D real en la vista tarjetas** (columnas con `Left`/`Right`, filas con `Up`/`Down`) — se
  descartó a favor de tratar la grilla como secuencia plana, mismo criterio que ya usa Course.
- **Gate por scroll (no por visibility) en el dialog de Repaso** — se decidió `IntersectionObserver`
  sobre el botón, no un cálculo de `scrollTop`/`scrollHeight`.
- **Shortcuts en Login** — no se tocó, no forma parte del pedido.
- **Cambiar el comportamiento del click de mouse en Cursos** — sigue exactamente igual (navega
  directo); todo lo nuevo es puramente teclado, aditivo.

## Further Notes

- El bug de `Space` y el bug de `F` no eran parte del pedido original — aparecieron durante el
  grill cuando el usuario mandó una captura de pantalla del dialog de Repaso. Vale la pena, la
  próxima vez que se toque un hotkey bare en una vista con contenido editable, chequear de entrada
  si necesita el mismo tratamiento bare+`mod+` en vez de esperar a que aparezca como bug reportado.
- La convención de teclas completa (tabla) queda en `to-grill-keyboard-shortcuts.md` — portarla a
  `docs/ui-principles.md` como parte de esta implementación, no como tarea aparte.
