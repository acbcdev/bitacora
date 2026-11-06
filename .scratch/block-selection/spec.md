# Spec — Selección de bloque estilo Notion (Marquee + promoción por cruce)

Status: ready-for-agent

Origen: grill 2026-11-05. Vocabulario en `CONTEXT.md` (entrada **Handle de bloque** → **Selección de bloque**, **Marquee**). Respeta ADR 0023 (monocromo + una señal).

## Problem Statement

En el editor, seleccionar varios bloques es torpe. Si arrastro el mouse sobre texto que cruza de un bloque a otro, el resultado es una selección de texto parcial y mezclada entre bloques: medio párrafo, una ecuación, medio heading. No sirve para mover, borrar ni copiar bloques enteros. Hoy la única forma de tener una **Selección de bloque** es hacer click en `⋮⋮` o Shift+click, bloque por bloque. En Notion, en cambio, apenas la selección cruza un bloque pasa a seleccionar bloques enteros, y además puedo dibujar un rectángulo desde el margen, como en el escritorio de un sistema operativo, para agarrar varios bloques de una.

## Solution

Dos entradas nuevas a la **Selección de bloque**, que ya existe:

1. **Promoción por cruce.** Mientras arrastro seleccionando texto, cuando el puntero sale del bloque donde empecé, la selección se convierte en Selección de bloque y abarca los bloques enteros desde el de origen hasta el actual. Si vuelvo al bloque de origen en el mismo drag, vuelve a ser selección de texto.
2. **Marquee.** Al hacer mousedown en una zona sin texto del área de la nota (márgenes, padding entre bloques, debajo del último bloque) y arrastrar, aparece un rectángulo monocromo. Todo bloque top-level que el rectángulo toque queda en la Selección de bloque. Si el puntero se acerca al borde del área scrolleable, la nota hace auto-scroll.

El halo sigue siendo gris (`--muted`), pero ahora cada bloque seleccionado tiene su propio rect redondeado, separado de los vecinos por un gap. Con la selección activa, el teclado actúa sobre bloques enteros.

## User Stories

1. Como persona que escribe notas, quiero que al arrastrar una selección de texto fuera del bloque donde empecé se seleccionen los bloques enteros, para no quedar con selecciones parciales mezcladas entre bloques.
2. Como persona que escribe notas, quiero que la selección vuelva a ser de texto si regreso al bloque de origen en el mismo drag, para poder corregir un drag que se pasó sin soltar el mouse.
3. Como persona que escribe notas, quiero que la selección de texto dentro de un solo bloque funcione igual que hoy, para no perder la edición fina de texto.
4. Como persona que escribe notas, quiero que la promoción también funcione hacia arriba (arrastrar del bloque 5 al 2), para que la dirección del drag no importe.
5. Como persona que escribe notas, quiero que al cruzar de un ítem de lista a otro de la misma lista se seleccionen esos ítems y no la lista entera, para operar sobre ítems sueltos.
6. Como persona que escribe notas, quiero que al cruzar de un párrafo a un ítem de lista se seleccionen bloques top-level, para que la selección siempre sea de bloques hermanos.
7. Como persona que escribe notas, quiero que dentro de una tabla no haya promoción a bloques, para que la selección de celdas siga funcionando.
8. Como persona que escribe notas, quiero arrastrar un rectángulo desde el margen de la nota, para seleccionar varios bloques sin tener que apuntar al texto.
9. Como persona que escribe notas, quiero que el Marquee arranque también desde el espacio debajo del último bloque y desde el padding entre bloques, para no tener que buscar el margen exacto.
10. Como persona que escribe notas, quiero que un mousedown sobre texto siga siendo selección de texto y no Marquee, para no romper la edición.
11. Como persona que escribe notas, quiero que el mousedown en el gutter del `+ ⋮⋮` siga haciendo lo de siempre (asa, menú, drag), para que el Marquee no le robe esos gestos.
12. Como persona que escribe notas, quiero que cualquier bloque top-level que el rectángulo toque, aunque sea un poco, entre en la selección, para no tener que cubrirlo completo.
13. Como persona que escribe notas, quiero que la selección se actualice en vivo mientras arrastro el Marquee, para ver qué estoy agarrando antes de soltar.
14. Como persona que escribe notas, quiero que achicar el rectángulo saque de la selección los bloques que ya no toca, para ajustar sin empezar de nuevo.
15. Como persona que escribe notas, quiero que el rectángulo del Marquee sea monocromo y sutil (borde y relleno tenue), para que respete el lenguaje visual de la app.
16. Como persona que escribe notas, quiero que la nota haga auto-scroll cuando el puntero llega cerca del borde superior o inferior durante el Marquee, para seleccionar más de una pantalla de bloques.
17. Como persona que escribe notas, quiero que un Marquee nuevo reemplace la selección anterior, para que el gesto sea predecible.
18. Como persona que escribe notas, quiero que un mousedown con mínimo movimiento en una zona vacía no cree una selección, para que un click distraído en el margen no seleccione nada.
19. Como persona que escribe notas, quiero que cada bloque seleccionado tenga su propio rect gris redondeado separado de los vecinos, para contar de un vistazo cuántos bloques seleccioné.
20. Como persona que escribe notas, quiero que la Selección de bloque nunca se pinte de azul, para que la app siga siendo monocroma.
21. Como persona que escribe notas, quiero que Backspace o Delete borren los bloques seleccionados, para limpiar varios bloques de una.
22. Como persona que escribe notas, quiero que Cmd+C copie los bloques enteros seleccionados, para pegarlos en otro lado con su estructura.
23. Como persona que escribe notas, quiero que Cmd+X corte los bloques enteros seleccionados, para moverlos a otra nota.
24. Como persona que escribe notas, quiero que tipear una letra con bloques seleccionados no haga nada, para no borrar varios bloques por accidente.
25. Como persona que escribe notas, quiero que Esc con bloques seleccionados solo limpie la selección y deje el foco en el editor, para salir de la selección sin perder el lugar.
26. Como persona que escribe notas, quiero que un segundo Esc saque el foco del editor como hoy, para conservar el comportamiento que ya conozco.
27. Como persona que escribe notas, quiero que un click normal en el texto termine la Selección de bloque, para volver a editar.
28. Como persona que escribe notas, quiero poder arrastrar con el `⋮⋮` la selección hecha por Marquee o por cruce, para reordenar varios bloques juntos.
29. Como persona que escribe notas, quiero que Shift+↑/↓ sigan extendiendo la selección de bloques, para combinar mouse y teclado.
30. Como persona que escribe notas, quiero que con bloques seleccionados no aparezca el Bubble de formato, para que no se mezclen el formato inline y las operaciones de bloque.
31. Como persona que escribe notas, quiero que click en `⋮⋮` siga agregando bloques al conjunto (no contiguo), para combinar selecciones sueltas.

## Implementation Decisions

- **Un solo modelo de selección.** Las dos entradas nuevas terminan en un `NodeRangeSelection` contiguo de ProseMirror, la misma clase que ya usan Shift+click y la extensión `NodeRange`. La capa de bloques de `block-controls` ya sincroniza el conjunto, el halo, el drag y la supresión del bubble desde cualquier `NodeRangeSelection` externo, así que esa parte no se toca. Lo nuevo es solo cómo se *crea* la selección.
- **Promoción por cruce.** Mientras el botón del mouse está apretado y la selección nació como texto, se compara el bloque del ancla con el del head. Si son distintos, se reemplaza la selección por `NodeRangeSelection.create(doc, anchor, head)` **sin `depth`**, para que la profundidad la dé el ancestro común (`blockRange`): dos ítems de una lista dan un rango de ítems, un párrafo y un ítem dan un rango top-level. Si el head vuelve al bloque del ancla, se restaura una `TextSelection` anclada en el ancla original. No se promueve si el ancestro común está dentro de una tabla.
- **Marquee.** El listener vive en el host del editor (fuera del contenteditable). Solo arranca con mousedown cuyo target no sea texto editable ni el gutter del asa. Hay un umbral de unos pocos px de movimiento antes de considerarlo Marquee, para que un click en el margen no seleccione nada. Durante el drag:
  - se dibuja un overlay rectangular, monocromo: borde `--border`, relleno `--foreground` a ~5%;
  - se hace hit-test por intersección contra los rects de los bloques **top-level** del doc;
  - el resultado se aplica como un único `NodeRangeSelection` del primero al último bloque tocado. Como los bloques top-level están apilados verticalmente, la intersección con un rectángulo siempre da un tramo contiguo;
  - cada movimiento recalcula la selección, así que achicar el rectángulo también la achica;
  - siempre reemplaza la selección previa. Shift+marquee no suma.
- **Auto-scroll.** Mientras el Marquee está activo, si el puntero queda a ≤40px del borde superior o inferior del contenedor scrolleable, se scrollea a paso fijo en un loop de `requestAnimationFrame`, recalculando el hit-test en cada frame. Sin aceleración.
- **Teclado sobre Selección de bloque.**
  - Backspace/Delete y Cmd+C/X: verificar primero si ya funcionan nativos (`deleteSelection` y `selection.content()` operan sobre cualquier `Selection`). Escribir código solo si falla.
  - Texto tipeado: no-op mientras la selección sea `NodeRangeSelection`.
  - Esc en dos pasos: el handler global de Esc del editor primero colapsa una `NodeRangeSelection` a selección de texto y conserva el foco. Solo el siguiente Esc hace blur. Se respeta el orden actual del handler: lightbox, popover y menú slash siguen teniendo prioridad.
- **Halo.** Se reduce el inset vertical del pseudo-elemento del halo para que bloques contiguos dejen un gap visible: un rect por bloque. El color no cambia (`--muted`, ADR 0023).
- **Limpieza.** Se borra el `console.log` de debug que quedó en el plugin de decoraciones de la capa de bloques.
- **Glossary.** `CONTEXT.md` ya está actualizado: la entrada **Handle de bloque** define **Selección de bloque** y **Marquee**, y corrige que el click en `⋮⋮` *agrega* al conjunto.

## Testing Decisions

- **Seam único: el editor montado en jsdom.** Se renderiza el editor real con la capa de bloques, se disparan eventos DOM (mousedown/mousemove/mouseup/keydown) y se aseguran dos cosas observables: el tipo y rango de `editor.state.selection` y la clase del halo en los nodos del DOM. Nada se testea contra helpers internos.
- **Geometría.** jsdom no tiene layout, así que se mockea `getBoundingClientRect` de los bloques y del host. Es el mismo patrón que ya usan los tests de visibilidad del asa en `block-controls.test.tsx`, que funcionan como prior art. También son prior art los tests `node-range` de ese archivo, que despachan `NodeRangeSelection` y aseguran el halo.
- **Casos mínimos**, uno por comportamiento no trivial:
  - cruce hacia abajo promueve;
  - volver al bloque ancla restaura el texto;
  - cruce entre ítems de la misma lista da un rango de ítems;
  - cruce dentro de una tabla no promueve;
  - Marquee desde el margen selecciona los bloques intersectados;
  - movimiento bajo el umbral no selecciona;
  - mousedown sobre texto no arranca Marquee;
  - Esc en dos pasos;
  - letra con selección de bloques no modifica el doc;
  - Backspace borra los bloques.
- **Fuera de tests automáticos:** el auto-scroll y el gap visual del halo (CSS y rAF, sin layout real en jsdom). Se verifican a mano corriendo la app.

## Out of Scope

- Esc mientras escribís para seleccionar el bloque actual (hoy Esc saca el foco).
- Cmd+A en dos pasos estilo Notion (hoy `Mod-a` de `NodeRange` selecciona todos los bloques de una y así se queda).
- Shift+marquee para sumar al conjunto existente (para sumar no contiguos está el click en `⋮⋮`).
- Marquee sobre bloques anidados (solo top-level).
- Halo o Marquee azul (ADR 0023).
- Touch / mobile.
- Aceleración del auto-scroll.

## Further Notes

- Las decisiones salen del grill del 2026-11-05: Q1–Q13 en la conversación, resumidas en `CONTEXT.md`.
- Riesgo: la promoción por cruce pelea con la selección nativa del browser durante el drag. Si reemplazar la selección en cada mousemove tiene flicker, la alternativa es hacer `preventDefault` del drag nativo una vez promovido y seguir el puntero manualmente con `posAtCoords`.
