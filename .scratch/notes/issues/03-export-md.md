# 03 — Botón export a `.md`

Status: ready-for-agent

## Qué

Botón que exporta el `content` de una nota a un archivo **Markdown** descargable. **No negociable.**

## Aceptación

- El `.md` resultante conserva la estructura (headings, listas, código, énfasis) del documento Tiptap.
- Es una acción cliente-side pura (descarga), sin pantalla ni tabla nueva.

## Nota

Depende del formato de `content` definido en el issue `01`. Si el export pierde estructura, el
problema suele estar en la conversión Tiptap → markdown, no en la nota.
