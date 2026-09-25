# Map: editor-notion-ux — editor estilo Notion

## Destination

Una spec en `.scratch/editor-notion-ux/spec.md` — editor de notas estilo Notion: menú `/` de bloques, formato visible (negrita/weight/color con paleta fija Notion), tablas finas con botones para añadir/mover filas y columnas, mover/reordenar bloques — y la spec ya partida en tareas pequeñas, lista para implementar.

## Notes

- Dominio: `src/core/components/editor.tsx` (Tiptap v3 + starter-kit, code-block, ResizableImage, Table). Repaso ya usa este mismo componente — el alcance es un solo editor.
- Contexto previo: tablas actuales son de solo edición de celdas (`resizable: false`, sin toolbar); contenido entra por paste Markdown / import Notion. El comment en editor.tsx referencia una spec `.scratch/editor-tables` ya retirada.
- Skills a consultar: `/grilling`, `/domain-modeling`, `vercel-composition-patterns`, `frontend-design`.
- Preferencia del usuario: la integración debe ser "muy fina" — pulido de UX es criterio transversal, no una mejora futura. Colores: paleta fija tipo Notion (no picker libre).
- Persistencia: las notas se guardan via `tiptap-markdown`; todo bloque/marca nuevo tiene que sobrevivir el round-trip markdown y no romper el paste Markdown existente.

## Decisions so far

- Destino fijado (sesión de charting): spec partida en tareas pequeñas, editor único compartido con repaso, colores paleta fija Notion, pulido de integración como criterio v1.
- [06 — Persistencia: round-trip markdown y notas existentes](issues/06-markdown-roundtrip.md) — Notas se guardan como JSON de Tiptap (markdown es solo export/paste, via parser propio); color/attrs de tabla sobreviven la persistencia solos, se pierden solo en round-trip md; sin migración al añadir attrs; opciones: JSON best-effort / HTML embebido en md / adoptar @tiptap/markdown oficial.
- [01 — Inventario de capacidades Tiptap v3](issues/01-tiptap-inventory.md) — Todo existe oficialmente en v3.31.3 (suggestion, drag-handle(+react), node-range, BubbleMenu, Color/Highlight, table con resize); solo se construyen UIs: popup slash, menú por bloque, toolbar de tabla, color picker.

## Not yet specified

- UX de estos controles en pantallas pequeñas (la app usa drawers `vaul`); depende de cómo quede el contrato de desktop.
- Rendimiento del drag-handle en notas largas (muchos bloques, re-render del menú flotante).
- Qué pasa con el modo lectura (`editable: false`): cómo se renderizan colores/resaltados ahí — quizá trivial, se revisa al definir la paleta.
- Sinergia con el import/paste de Notion: si el menú `/` y las tablas finas cambian lo que aceptamos al pegar.

## Out of scope

- Editor mobile de `.scratch/mobile` (superficie aparte).
- Sistema de temas/colores globales (`.scratch/themes`); aquí solo la paleta de acento del editor.
