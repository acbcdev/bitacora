# ADR 0007 — El Outline se deriva del DOM y se ancla con `sticky`

**Status:** Accepted

## Contexto

El Outline (rail de headings, ver `.scratch/heading-outline/spec.md`) tiene que aparecer en las
**3 superficies** donde se renderiza una nota completa, y cada una tiene su propio contenedor
scrolleable:

1. `/note/:id` → scrollea `<main>` (`app.tsx:209`)
2. `/course/:id/:noteId` → scrollea `#note-pane` en md+, `<main>` en mobile (`course.tsx:130`)
3. Dialog de Repaso → scrollea un div interno de `max-h-[85vh]`, read-only (`note-dialog.tsx:101`)

Dos preguntas de fondo: de dónde salen los headings, y respecto de qué se posiciona el rail.

## Decisión

**Los headings salen del DOM**, no del documento de Tiptap:
`host.querySelectorAll("h1, h2, h3")`, rescaneado con debounce cuando el editor avisa que cambió
el contenido.

**El rail se ancla con `position: sticky`**, nunca con `fixed` ni con medición de contenedores.
Va dentro del wrapper del `Editor`, primero en el flujo, en un div de altura 0.

## Por qué

- **DOM sobre doc:** el rail necesita un elemento al que scrollear. `querySelectorAll` lo devuelve
  directo; el doc de Tiptap devuelve nodos, y mapear nodo→DOM obliga a exponer la instancia del
  editor y a usar `posToDOM` de ProseMirror. Dos fuentes de verdad para el mismo dato, y la
  segunda es más cara.
- **`sticky` sobre `fixed`:** `sticky` se posiciona respecto del scroll**port** ancestro, sea cual
  sea. El mismo componente funciona en los 3 contenedores sin detectar cuál scrollea, sin
  `getBoundingClientRect`, sin listeners de resize. `fixed` habría necesitado una rama por
  superficie (dentro del dialog hay que anclar al contenedor, no al viewport).
- El rail va **primero en el flujo, antes del contenido**: `sticky` no puede subir por encima de
  su posición natural. Un rail declarado después del contenido queda pegado abajo para siempre.
- El rail va **fuera del `contenteditable`**: adentro de `.ProseMirror` sería contenido editable
  del documento y ProseMirror lo trataría como tal.

## Consecuencias

- `Editor` deja de devolver `<EditorContent>` pelado y pasa a devolver un wrapper `relative`. Las
  3 superficies lo reciben sin cambiar ninguna prop.
- El Outline no sabe nada de Tiptap: es un componente sobre un `HTMLElement`. Se puede testear con
  HTML pelado.
- El rescaneo depende de que el editor avise. En modo lectura, `setContent` no dispara `onUpdate`
  — ese caso se emite a mano (`editor.tsx:84-86`).
- Si algún día un heading se renderiza fuera del `contenteditable` (un título de nota, por
  ejemplo), no aparece en el Outline. Es intencional: el Outline mapea el **cuerpo** de la nota.
- Este mismo criterio aplica a cualquier chrome futuro que tenga que flotar sobre la nota en las 3
  superficies (bubble menu, indicador de progreso de lectura): `sticky` dentro del wrapper del
  `Editor`, no `fixed` con cálculo de posición.
