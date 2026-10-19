# Desplegable

Status: resolved

## Qué

`@tiptap/extension-details` (+ summary/content), `persist: false` (default). Se crea con `> ` +
espacio (input rule propia, la extensión no trae) y `/desplegable`. La input rule `> ` de blockquote
se quita; la cita queda por `/cita`.

## Aceptación

- Crear, escribir título y cuerpo, plegar/desplegar con mouse y teclado.
- Toda nota abre con los desplegables cerrados; plegar no marca el borrador como sucio.
- `> ` + espacio crea Desplegable, no cita. Pegar markdown `> texto` sigue dando cita.
- `block-controls` (drag handle) mueve el bloque entero.
- Export `.md`: summary como párrafo en **bold** + cuerpo debajo. Sin `<details>`, sin round-trip.
- Tests en `tiptap-markdown.test.ts` y `slash-menu.test.tsx`.

## Comments

**Review 2026-10-18** — errores de la implementación anterior:

- `docs/ui-principles.md`: la frase de `mod+Shift+Enter` quedó pegada DOS veces en la misma celda.
- `mod+Shift+Enter` para plegar está bien (no choca con `mod+Enter` de Repaso/NoteDialog, ADR 0024);
  documentarlo una sola vez + cheatsheet.
- `"details"`/`"detailsSummary"`/`"detailsContent"` como literales en 3 archivos: usar `Details.name`.
- Faltó nada de aceptación: input rule `> `, drag del bloque entero, export bold, `persist: false`
  sin ensuciar borrador — todo OK, mantener los tests.
