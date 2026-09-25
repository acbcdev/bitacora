# ADR 0019 — Teclado de formato del editor: el sidebar se queda `mod+B`

**Status:** Accepted

## Contexto

La UX Notion del editor (`.scratch/editor-notion-ux/`) trae shortcuts de formato. El default
de Tiptap para bold es `Mod-b` — y `mod+B` ya tiene dueño global: el toggle del sidebar
(shadcn, `src/core/ui/sidebar.tsx:22`). Tal como venía, `mod+B` en el editor togglea el
sidebar Y aplica bold: doble efecto.

Descartado `mod+B` para el sidebar → `mod+\`: el usuario decidió mantener el sidebar donde
está (memoria muscular de shadcn). Descartado `mod+Shift+B` para bold: reservado para el
segundo sidebar (convención shadcn futura).

## Decisión

- **`mod+B` queda para el sidebar** — el keymap del editor remueve `Mod-b` para que no haya
  doble efecto (`Bold.extend`, `'Mod-b': () => false`).
- **Bold = `mod+Alt+B`** dentro del editor.
- **Clear formatting = `mod+\`** → `unsetAllMarks` (incluye color y highlight).
- Los defaults de Tiptap que no chocan con nada quedan: italic `mod+I`, strike
  `mod+Shift+X`, code inline `mod+E`, highlight `mod+Shift+H`.
- **Color sin atajo** — acción de picker, como en Notion.

## Consecuencias

- `mod+Alt+B` y `mod+\` se suman a la tabla de `ui-principles.md` (fila del editor).
- Partición coherente con ADR 0017: `mod+` = deliberado, corre aunque el foco esté en el
  editor. `mod+B` es la excepción documentada: es app-level (sidebar) y el editor la suelta.
- `mod+Shift+B` queda reservado: si algún día hay segundo sidebar, es su tecla.

## Alternativas descartadas

- **Mover sidebar a `mod+\` y bold en `mod+B`**: rompe el default de shadcn y la memoria
  muscular del usuario; decisión suya, no se re-abre sin razón nueva.
- **Bold click-only** (sin atajo): viola `ui-principles.md` #1 si bold es frecuente.
