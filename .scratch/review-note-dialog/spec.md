# Feature: review-note-dialog

**Status:** ready-for-agent
**Blocked by:** ninguno

Grillado con `/grill-with-docs`, iterando sobre un prototipo HTML (Artifact) con 3 variantes de
layout hasta converger. Decisión final abajo.

## Problem Statement

En Repaso, el card de una nota (`note.kind === 'note'`) renderiza el contenido completo inline con
`<Editor content={note.content} editable={false} />`. Dos casos reales rompen el layout:

- **Nota larga**: el contenido entero (headings, listas, blockquotes) se despliega dentro del card,
  produce un wall-of-text que empuja los CTAs fuera de foco y rompe la sensación de card compacto de
  la pantalla de Repaso.
- **Nota vacía o corta**: el card queda con un hueco vacío desproporcionado bajo el título.

Ninguno de los dos da una UX consistente para un flujo que se usa 2–3×/día (`CONTEXT.md`).

## Solution

El card de nota en la cola de Repaso deja de mostrar el contenido inline. Muestra un resumen —
ícono + nombre de curso, título, extracto corto de 3 líneas— con un único call to action visible
(**Marcar leído**). El contenido completo se ve en un dialog (`@/core/ui/dialog`, shadcn/Radix, ya
usado en `course-form.tsx` y `cheatsheet.tsx`) que se abre haciendo click en el bloque de
título/extracto — no hay un botón "Ver nota" separado.

**Excepción consciente a `ui-principles.md` regla 2** ("la nota manda"): ya documentada ahí. La
regla se mantiene una vez que la nota está abierta (dialog o pantalla Nota); el card de la cola pasa
a ser resumen, no la nota completa.

**Scope: solo `note.kind === 'note'`.** La respuesta revelada de una flashcard sigue usando
`<Editor editable={false}>` inline sin cambios — es un flujo distinto (`358045e`/`c316910`, shippeado
hace poco), no se toca en este spec.

## User Stories

1. Como usuario, quiero ver de un vistazo el curso, el título y un extracto corto de la nota en
   Repaso, para reconocer de qué trata sin tener que abrir nada.
2. Como usuario, quiero que una nota vacía o muy corta no deje un hueco raro en el card, para que la
   cola se sienta pareja sin importar el largo de cada nota.
3. Como usuario, quiero hacer click en cualquier parte del título o el extracto para abrir la nota
   completa, sin tener que apuntarle a un botón chico.
4. Como usuario, quiero poder llegar al mismo dialog con el teclado (Tab + Enter), para no depender
   del mouse si estoy navegando por teclado.
5. Como usuario, quiero seguir marcando una nota como leída con `Space` sin tener que abrir el
   dialog primero, para no perder velocidad en notas que ya me sé de memoria.
6. Como usuario, quiero poder marcar leído también desde adentro del dialog, para cerrar el flujo
   ahí mismo si abrí la nota para releerla.
7. Como usuario, quiero que `J`/`K` sigan saltando la cola sin marcar como leído sin importar si el
   dialog está cerrado, y que el orden de las teclas sea intuitivo: `J` (izquierda) vuelve, `K`
   (derecha) avanza — invertido respecto al bind actual.
8. Como usuario, quiero ver el ícono real del curso (el mismo que uso en Cursos) al lado de su
   nombre, para reconocer visualmente el curso más rápido que solo leyendo el texto.
9. Como usuario, quiero poder editar la nota desde el dialog, ya que ahí es donde estoy viendo el
   contenido completo.

## Implementation Decisions

**Card compacto** (`src/review/review.tsx`, rama `note.kind === 'note'`):

- Estructura: `<div className="card">` contiene dos elementos **hermanos**, no anidados:
  1. `<button>` de ancho completo, sin cromo visual (texto plano, `text-align: left`), que envuelve
     ícono de curso + nombre + índice, título, y extracto. `onClick` abre el dialog.
  2. El footer con los hints de teclado y el botón **Marcar leído**.

  Importante: un `<button>` real no puede anidar otro `<button>` (HTML inválido, rompe el foco). Por
  eso son hermanos dentro del mismo card, no el segundo botón adentro del primero. El `<button>`
  disparador es nativamente tabbable — `Enter` lo activa igual que el click, sin pisar el hotkey
  global `Space` (que sigue siendo `useHotkeys("space", ...)` sobre `document`, no ligado al foco de
  este botón).

- **Sin hint de texto en hover** ("click para ver completa") — se probó en el prototipo y se sacó a
  pedido explícito: el cursor `pointer` + el estado de foco/hover del card ya comunican que es
  clickeable.

- **Ícono de curso**: reusar `CourseIcon` de `@/courses/course-icon` (mismo componente que
  `courses.tsx:215/282`), al lado del nombre del curso, en el card y en el header del dialog. No se
  crea un componente nuevo.

- **Extracto**: nueva función pura `docToPlainText(doc: TiptapDoc): string` en
  `src/core/lib/tiptap-markdown.ts` (junto a `docToMarkdown`) — recorre `doc.content` recolectando
  solo los `.text` de los nodos hoja, sin aplicar marks (sin `**`, `#`, etc.), separando bloques con
  un espacio. No reusar `docToMarkdown` directo para esto: dejaría símbolos de sintaxis visibles en
  el extracto. El truncado a 3 líneas es CSS (`line-clamp: 3`), no slicing de caracteres a mano — se
  banca cualquier ancho de card sin recalcular.

  Nota vacía (`doctoPlainText(doc) === ""`) → el extracto muestra un placeholder itálico ("Nota sin
  contenido todavía.") en vez de quedar en blanco.

- **Botón "Editar" se mueve al dialog.** Hoy vive en el footer del card, visible sin abrir nada.
  Cambia de lugar: pasa al footer del dialog (junto a Marcar leído), visible solo después de abrir
  la nota completa. Es un cambio de comportamiento real, no solo visual — editar una nota ahora
  cuesta un click extra (abrir el dialog primero). Se acepta como parte de la decluttering del card:
  "Editar" es una acción menos frecuente que "Marcar leído" en el loop diario.

**Dialog** (`@/core/ui/dialog`, mismo patrón que `course-form.tsx`):

- Header: ícono de curso + nombre (mismo `course-row` que el card) + título de la nota.
- Body: `<Editor content={note.content} editable={false} />` — el mismo componente y el mismo
  render que hoy, solo que ahora vive dentro del dialog en vez de inline en el card. Nota vacía →
  mismo placeholder que hoy (sin contenido no rompe el `Editor`).
- Footer: botón **Editar** (navega a `/course/:id/:noteId` o `/note/:id`, igual que hoy — cierra el
  dialog al navegar) + botón **Marcar leído** (mismo handler `markNoteRead` que el del card).

**Hotkeys J/K invertidos** (`src/review/review.tsx`):

- `J` → `volver` (antes avanzaba). `K` → `siguiente` (antes volvía). Cambio **global**: los hooks
  `useHotkeys("j", ...)` / `useHotkeys("k", ...)` no distinguen `note.kind`, así que el swap afecta
  también la navegación cuando el ítem actual es una flashcard — mismo comportamiento (saltar sin
  registrar en `read_log`), solo cambia qué tecla hace qué.
- `Space` no cambia de comportamiento para notas: sigue siendo `markNoteRead()` directo (leído +
  siguiente), no abre el dialog primero. Precedente: hoy "Editar" tampoco tiene shortcut propio — el
  dialog es, igual que Editar, una acción alcanzable por mouse o Tab+Enter, no parte del loop
  Space/J/K que exige `ui-principles.md` regla 1 (keyboard-first) para las acciones frecuentes.

**`docs/ui-principles.md` actualizado** durante este grill (regla 2, ver diff) para documentar la
excepción del card de Repaso en vez de dejarlo contradicho en silencio.

## Testing Decisions

Seam existente: `src/review/review.test.tsx`. Extender, no crear archivo nuevo.

- **Actualizar el test de hotkeys** ("J/K saltan sin tocar read_log..."): hoy asume `KeyJ` avanza y
  `KeyK` vuelve. Con el swap, es al revés — actualizar las aserciones, no la intención del test.
- **Nuevo caso: click en el card abre el dialog** y el `Editor` mockeado (`data-testid="editor"`, ya
  mockeado en este archivo porque Tiptap no corre limpio en jsdom) aparece en el DOM; `Escape` o el
  botón de cerrar lo saca.
- **Nuevo caso: Marcar leído funciona desde el card sin abrir el dialog** (ya cubierto en espíritu
  por el test de `Space`, agregar el equivalente con click directo en el botón del footer) **y
  también desde adentro del dialog** (abrir, click en Marcar leído del footer del dialog, mismo
  insert en `read_log`, dialog se cierra).
- **`docToPlainText`**: función pura, no depende de Tiptap runtime — test unitario directo en
  `tiptap-markdown.test.ts` (ya existe, mismo archivo que testea `docToMarkdown`). Casos: doc con
  texto y marks → texto sin símbolos de formato; doc vacío (`content: []`) → string vacío.

## Out of Scope

- **Flashcard reveal** (`note.kind === 'flashcard' && revealed`) — sigue con `<Editor>` inline sin
  cambios. Si más adelante se decide unificar, es un spec propio.
- **Editar contenido dentro del dialog.** El dialog es de solo lectura, igual que el card de hoy —
  "Editar" sigue navegando a la ruta de edición existente, no se agrega un modo de edición inline.
- **Borrar una nota normal desde Repaso.** No existe hoy (el `Trash2`/`ConfirmDelete` actual es
  solo para flashcards) y este spec no lo agrega.
- **Shortcut de teclado dedicado para abrir el dialog.** Se resuelve con Tab+Enter (foco nativo del
  `<button>`), no se suma una tecla nueva tipo `O`/`Enter` global.

## Further Notes

Iteración visual: 3 variantes (A mínimo, B extracto, C fila compacta) probadas en un Artifact HTML
con tokens reales de `src/index.css` y toggle nota-larga/nota-vacía antes de converger en B
refinado. Decisiones de detalle (sin botón "Ver nota", sin hint de hover, ícono de curso) vinieron
de iterar sobre ese prototipo, no de una ronda de preguntas de texto.
