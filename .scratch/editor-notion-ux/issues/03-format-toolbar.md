# 03 — Contrato de la toolbar de formato

Type: grilling
Status: resolved
Blocked by: 01

## Question

¿Cómo se aplica formato visible? ¿Bubble menu al seleccionar, toolbar fija, o ambas? Controles: negrita, cursiva, strike, code inline, weight (¿normal/semibold/bold?), tipo de bloque (convertir heading/cita/lista), color de texto con paleta fija Notion y highlight. Decide también: ¿el color vive como mark custom o como highlight oficial, y cómo se quita ("clear formatting")?

## Answer

Contrato cerrado (grill 2026-09-26, spec historia 3 y 4):

- **Solo BubbleMenu** al seleccionar (opción 1); sin toolbar fija (ui-principles #3) y sin FloatingMenu.
- **Fila de 7 con `ToggleGroup` de shadcn:** B · I · S · code · A · H · ✕. `mousedown → preventDefault` en cada toggle para no robar la selección. Sin weight custom (semibold = mark custom imaginario), sin turn-into (vive en slash menu y menú de bloque).
- **Color y highlight: marks oficiales** (`Color`/TextStyle y `Highlight` multicolor), paleta fija de 8 (gris, marrón, naranja, amarillo, verde, azul, violeta, rojo). Popover por botón con las 8 fichas + "Quitar"; ficha ya activa = quitar; el icono pinta el color activo.
- **Teclado (ADR 0019):** `mod+B` queda para el sidebar (shadcn) y el editor lo remueve de su keymap; **bold = `mod+Alt+B`**; `mod+Shift+B` reservado (segundo sidebar); clear formatting = **`mod+\`** → `unsetAllMarks`; resto defaults de Tiptap (I, `mod+Shift+X`, `mod+E`, `mod+Shift+H`); color sin atajo.
