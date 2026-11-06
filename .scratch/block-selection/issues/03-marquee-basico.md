# 03: Marquee básico

**What to build:** Mousedown en una zona sin texto del área de la nota (márgenes, padding entre bloques, debajo del último bloque) y arrastrar dibuja un rectángulo monocromo (borde `--border`, relleno `--foreground` ~5%). Todo bloque top-level que el rectángulo intersecte, aunque sea un poco, queda en la Selección de bloque; la selección se recalcula en vivo (achicar el rectángulo saca bloques). Un Marquee siempre reemplaza la selección previa (Shift no suma). Por debajo de un umbral de pocos px de movimiento no se selecciona nada. Mousedown sobre texto sigue siendo selección de texto; mousedown en el gutter del `+ ⋮⋮` sigue siendo del asa.

El resultado es un único `NodeRangeSelection` contiguo (primer..último bloque tocado), así que halo, drag y supresión del bubble salen de la capa de bloques existente.

Spec: `.scratch/block-selection/spec.md` (historias 8–15, 17, 18, 28).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Marquee desde el margen selecciona los bloques intersectados (test con rects mockeados)
- [ ] Achicar el rectángulo durante el drag reduce la selección (test)
- [ ] Movimiento bajo el umbral no crea selección (test)
- [ ] Mousedown sobre texto no arranca Marquee (test)
- [ ] Mousedown en el gutter del asa no arranca Marquee (test)
- [ ] Marquee nuevo reemplaza la selección previa (test)
- [ ] Overlay monocromo, desaparece al soltar (verificado a mano)
