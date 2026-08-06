# To-grill: shortcuts nuevos + consistencia entre vistas

**Status:** resuelto — ver `spec.md`.
**Blocked by:** ninguna.

## Contexto original (brain dump del usuario, sin editar)

> quiero aumetar los shorcuts en difeents views y tener un mejor constistnecia

## Estado real del repo antes de grillear

Librería única: `react-hotkeys-hook` (no hay `onKeyDown` a mano en ninguna vista). Shortcuts
existentes al momento de arrancar:

- Global (`src/app.tsx:84-92`): `mod+k` (palette, forzado `enableOnFormTags`/`enableOnContentEditable`),
  `shift+slash` (cheatsheet), `g>h` / `g>c` (secuencia, `sequenceTimeoutMs: 900`).
- Repaso (`src/review/review.tsx:76-83`): `space` (marcar leído / revelar flashcard), `j` (volver),
  `k` (siguiente sin contar) — los tres sin `enabled` condicionado al dialog de nota abierto.
- Course (`src/courses/course.tsx:71-78`): `j,left` / `k,right` (mover entre notas), `n` (nota nueva).
- Cursos lista (`src/courses/courses.tsx:90`): `n` (curso nuevo) — sin ningún nav por teclado sobre
  las filas/cards, sin editar/borrar por teclado, sin foco al buscador.
- Nota (`src/notes/note.tsx:96,100`): `f` (focus, forzado `enableOnContentEditable` porque el foco
  vive siempre en título/editor — `f` bare, sin alias `mod+`), `escape` (salir de focus).
- Sin ADR sobre shortcuts. `docs/ui-principles.md:9-10` fija el principio ("cada acción frecuente
  tiene un shortcut") pero no una tabla de convención de teclas.

## Grill — decisiones, en el orden en que se resolvieron

**Scope inicial** (multiSelect): Cursos navegar sin mouse + editar/borrar por teclado + foco en
buscador. Un cuarto ítem ("dialog como el de Review") generó dos rondas de confusión — terminó
siendo, no una feature de Cursos, sino un bug real en el dialog de nota de Repaso (ver abajo). No
hay dialog nuevo en Cursos: se descartó explícitamente.

**Bug real encontrado en Repaso** (no era una feature, era un bug): `space` marca leído sin importar
si el dialog de nota está abierto o cerrado — abrís la nota completa para leerla y `Space` te la
marca leída antes de terminar de leer. Decisión: `Space` se elimina como shortcut. Lo reemplaza
`Enter` en los 3 casos (card cerrada → marca al toque, sin gate porque el contenido corto ya está
completo a la vista; dialog abierto → gateado a que el botón "Marcar leído" sea *visible* vía
`IntersectionObserver`, no cálculo de scroll; flashcard sin revelar → revela). `J`/`K` sin cambios.

**Bug real encontrado en Nota, mismo patrón que el de arriba:** `f` fuerza
`enableOnContentEditable: true` porque el foco vive siempre en título/editor (comentario ya
existente en el código) — consecuencia no buscada: escribir la letra "f" en una nota dispara el
toggle de focus mode. Mismo defecto de raíz que Space, encontrado al aplicar la misma regla a otro
atajo bare en una vista de edición.

**Regla general que salió de estos dos bugs:** un atajo de una sola letra bare es inseguro en
cualquier vista donde el foco puede estar sobre contenido editable — colisiona con escribir esa
letra. Fix: se separa en un par — versión bare (default de la lib: se desactiva sola mientras hay
foco en editable) + versión `mod+`, forzada, para cuando el foco SÍ está en el editor. Aplica a:
- `f` (Nota) → queda bare (ya no forzado) + se agrega `mod+f` forzado.
- `j,left` / `k,right` (nav entre notas en Course) → quedan bare tal cual + se agrega
  `mod+j,mod+left` / `mod+k,mod+right` forzado, misma acción (`step`), dos formas de dispararla
  según dónde esté el foco.
- Borrar nota (`Course`/`Nota`, acción destructiva) → **sin bare alias**: solo `mod+backspace`,
  porque no hay beneficio en que funcione fuera del editor y es una acción rara/deliberada, a
  diferencia de navegar/focus que sí tienen un caso de uso legítimo con el foco afuera.

**Conflicto encontrado al implementar** (no discutido en la sesión de grilling, resuelto directo
por ser un bug obvio de la misma clase): el nuevo `enter` global de Repaso dispararía en paralelo
con el `AlertDialogAction`/`AlertDialogCancel` del `ConfirmDelete` de una flashcard (ambos responden
a Enter/Space por default del navegador sobre un `<button>` enfocado) — se gatea con
`enabled: !confirmingDelete`.

**Cursos — nav de lista:** `J/K/Left/Right` como secuencia plana sobre `rows` (respeta el sort
actual), sin necesidad de `mod+` porque no hay contenido editable en la lista. `Enter` abre el curso
seleccionado (mismo destino que el click de hoy, `/course/:id` — sin dialog nuevo). `E` abre
`CourseForm` en modo editar. `Delete`/`Backspace` abre el `ConfirmDelete` de siempre (confirmación
sigue intacta). `/` enfoca el buscador; `Esc` con el buscador enfocado lo vacía y le devuelve el
foco a la lista.

## Convención de teclas que queda (para `docs/ui-principles.md`)

| Tecla | Significa | Dónde aplica bare | Dónde necesita `mod+` |
|---|---|---|---|
| `J`/`K` (+ `Left`/`Right` alias) | anterior/siguiente en una secuencia plana | listas sin contenido editable (Cursos, Repaso) | vistas con editor siempre enfocado (Course: nav de notas) |
| `N` | crear | siempre (no hay contenido editable en el punto donde se dispara) | — |
| `E` | editar | Cursos (fila seleccionada) | — |
| `Delete`/`Backspace` | borrar (siempre con confirmación existente) | Cursos (fila seleccionada, sin editable) | Nota (contenido editable siempre enfocado) |
| `Enter` | confirmar / abrir la acción principal | Cursos (abrir), Repaso (marcar leído/revelar, gateado en dialog), CourseForm (submit nativo), CommandPalette (cmdk) | — |
| `Esc` | cerrar / cancelar / salir | siempre | — |
| `/` | enfocar buscador | Cursos | — |
| `mod+` | señal de "esto es deliberado, corré aunque el foco esté en un editor" | — | Note (F, borrar), Course (nav de notas), global (`mod+k`, precedente ya existente) |

## Comments

Sesión de grilling completa el 2026-08-06 vía `/grill-with-docs`. Ver `spec.md` para el detalle
archivo por archivo, listo para implementar.
