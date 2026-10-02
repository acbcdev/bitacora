# Duplicación: upload de imagen de nota + toast.promise

**Status:** resolved

## Problema

El mismo flujo "sube imagen de nota con toasts" vive dos veces, con textos idénticos:

- `src/core/components/editor.tsx:196-212` (paste de imagen en `handlePaste`): `toast.promise(store.uploadNoteImage(file).then(src => …), { loading: "Subiendo imagen…", success: "Imagen insertada", error: … })`.
- `src/core/components/slash-menu.tsx:125-146` (ítem "Imagen" del menú slash): el mismo `store.uploadNoteImage(file)` y el MISMO `toast.promise` con los tres mensajes idénticos.

## Fix

Un helper compartido (p. ej. en un `upload-note-image.ts` junto a los dos) con firma
`uploadNoteImageWithToast(file, onSrc: (src: string) => void)`; los dos call sites pasan su forma
de insertar (paste: `view.dispatch`; slash: `editor.chain().setImage`).

## Criterio

- Mecánico: los textos de los toasts y el orden de operaciones no cambian.
- Los tests de editor y slash-menu (291 + 241 líneas) son la red; en verde.

## Answer

`uploadNoteImageWithToast(file, insert)` en `src/core/components/upload-note-image.ts`; paste del
editor y menú slash pasan su forma de insertar. Los imports muertos (`toast`, `store`) salieron de
los dos call sites. Suite en verde.
