# Feature: notes

**Blocked by:** foundation, courses

Editor de notas. Una nota vive **dentro de un curso** (`course_id`), por eso depende de `courses`
(la UI de creación necesita elegir curso).

## Scope

- Editor **Tiptap** (WYSIWYG, MIT) para `notes.content`.
- CRUD de nota: `title`, `content`, `position` (orden dentro del curso), soft delete.
- **Botón export a `.md`** — colapsado acá como issue `03`. Es una acción sobre `content`, no una
  pantalla ni tabla propia. **NO negociable** (era un hito del plan original).

## Por qué Tiptap (y no las alternativas)

- **Editor.js** descartado: misma arquitectura de bloques que Notion → reconstruiría lo que el
  usuario odia. Sin markdown, lock-in de JSON propio.
- **CodeMirror 6** descartado: se ofreció como más liviano; el usuario eligió Tiptap por WYSIWYG.
- Tiptap es MIT y gratis para siempre. Tiptap Cloud (lo pago) no se usa.

## Reglas de dominio

- Toda query filtra `deleted_at is null` (ADR 0002).
- `course_id` es FK `on delete set null` — una nota puede quedar sin curso, no debe romper la UI.

## Fuera de scope

- Búsqueda / tags (fuera del MVP).
- El importer de Notion (feature `notion-import`).

## Issues

- `01` editor Tiptap integrado
- `02` CRUD nota
- `03` botón export `.md`
