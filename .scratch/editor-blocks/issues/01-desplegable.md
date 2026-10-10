# Bloque desplegable (toggle)

Status: needs-triage

## Qué

`@tiptap/extension-details` (+ summary/content). Slash `/desplegable` y atajo markdown `>>` .
Estado abierto/cerrado persiste en el JSON.

## Aceptación

- Crear, escribir título y cuerpo, plegar/desplegar con mouse y teclado (Enter/Espacio en summary).
- `block-controls` (drag handle) mueve el bloque entero.
- Export `.md`: `<details><summary>…</summary>…</details>` o degradar a heading+texto (decidir).
- Test en `tiptap-markdown.test.ts` y `slash-menu.test.tsx`.
