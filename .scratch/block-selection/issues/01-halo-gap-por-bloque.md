# 01: Halo con gap por bloque + limpieza del debug log

**What to build:** Cada bloque en la Selección de bloque (vía Shift+click, `⋮⋮` o Shift+↑/↓) se ve como su propio rect gris redondeado, separado de los vecinos por un gap visible — se cuentan los bloques de un vistazo. El color no cambia (`--muted`, nunca azul — ADR 0023). De paso, se elimina el `console.log` de debug que quedó en el plugin de decoraciones de la capa de bloques.

Spec: `.scratch/block-selection/spec.md` (historias 19, 20).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [ ] Dos bloques contiguos seleccionados muestran dos rects separados con gap (verificado a mano corriendo la app)
- [ ] El halo sigue usando `--muted`, sin reflow del texto
- [ ] No queda el log de debug de decoraciones en la consola
- [ ] Tests existentes de node-range / halo siguen verdes
