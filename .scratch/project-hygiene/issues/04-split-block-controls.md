# Dividir block-controls.tsx (826 líneas)

**Status:** needs-triage

## Problema

`src/core/components/block-controls.tsx` es 826 líneas y +399 en el diff sin commitear.
Es el mayor archvo propio (shadcn `sidebar.tsx` no cuenta). Dentro conviven al menos tres
cosas: menú de bloques (⋮⋮), controles de tabla, y lo de imagen (resize/lightbox).

## Criterio

No dividir por dividir. Dividir **solo si el próximo feature vuelve a tocar ese archivo**
(o si el split es mecánico y no cambia la firma de nada exportado). Si dividir:

- `block-controls.tsx` (orquestación) + `block-controls-table.tsx` + `block-controls-image.tsx`
- Tests siguen a su módulo; nada del store/toast cambia de lugar.
- Split mecánico de módulo, no refactor de lógica — los tests existentes (413 líneas) son la red.
