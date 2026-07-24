# 01 — Editor Tiptap integrado

Status: ready-for-agent

## Qué

Integrar Tiptap como editor de `notes.content`. WYSIWYG, con un set básico de marcas/bloques
(headings, bold/italic, listas, código). Persistir el documento en `content`.

## Aceptación

- El contenido se guarda y se recarga sin pérdida.
- Formato de `content` documentado (JSON de Tiptap o HTML) — importa para el export `.md` (issue 03).
- Sin dependencia de Tiptap Cloud.
