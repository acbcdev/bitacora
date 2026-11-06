# 05: Teclado sobre Selección de bloque

**What to build:** Con bloques seleccionados (por cualquier entrada — testeable hoy con Shift+click o Shift+↑/↓): Backspace/Delete borran los bloques; Cmd+C / Cmd+X copian/cortan los bloques enteros; tipear una letra no hace nada; Esc limpia la selección y deja el foco en el editor, y el siguiente Esc saca el foco como hoy. Lightbox, popovers y menú slash conservan su prioridad sobre Esc. Primero verificar qué ya funciona nativo y escribir código solo para lo que falte.

Spec: `.scratch/block-selection/spec.md` (historias 21–26).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Backspace con 2 bloques seleccionados los borra (test)
- [ ] Cmd+C/X copian/cortan bloques enteros (test o verificado a mano si jsdom no expone clipboard)
- [ ] Tipear una letra con Selección de bloque no modifica el doc (test)
- [ ] Primer Esc colapsa a selección de texto con foco; segundo Esc hace blur (test)
- [ ] Esc con menú slash / popover abierto sigue cerrándolos primero (tests existentes verdes)
