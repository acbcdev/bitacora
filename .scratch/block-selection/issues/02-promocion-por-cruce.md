# 02: Promoción por cruce

**What to build:** Mientras arrastro seleccionando texto, cuando el puntero sale del bloque donde empecé, la selección se convierte en Selección de bloque que cubre los bloques enteros desde el de origen hasta el actual (en ambas direcciones). Si vuelvo al bloque de origen en el mismo drag, vuelve a ser selección de texto. La profundidad la da el ancestro común: cruzar entre ítems de la misma lista selecciona esos ítems; cruzar párrafo → ítem selecciona bloques top-level. Dentro de una tabla no hay promoción (manda la selección de celdas). Selección de texto dentro de un solo bloque queda como hoy.

La selección resultante es un `NodeRangeSelection` contiguo, así que halo, drag del `⋮⋮` y supresión del Bubble de formato salen de la capa de bloques existente.

Spec: `.scratch/block-selection/spec.md` (historias 1–7, 27–30). Riesgo de flicker con la selección nativa: ver Further Notes del spec.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Drag de texto del bloque A al C deja Selección de bloque A..C (test)
- [x] Drag hacia arriba promueve igual (test)
- [x] Volver al bloque ancla en el mismo drag restaura selección de texto (test)
- [x] Cruce entre ítems de la misma lista selecciona solo esos ítems (test)
- [x] Cruce dentro de una tabla no promueve (test)
- [x] Selección dentro de un solo bloque sigue siendo de texto (test)
- [ ] Sin flicker visible al promover (verificado a mano)
