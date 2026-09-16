# Rediseño del sidebar de cuaderno

## Pregunta del prototipo

¿Qué jerarquía de información sirve al hábito de repaso diario en el panel lateral
del cuaderno (listado de notas de un curso)?

## Veredicto (capturado 2025-…)

**Gana la variante E — "UI Bitácora".**

Estructura que validó el prototipo (aplicar así en `src/notebooks/notebook.tsx`):

- Header compacto con icono del cuaderno + crumb (notebook padre) + título de una línea.
- Chips de estado debajo del título: `● Activo` (brand-soft/brand-fg verde), `13 notas`,
  `0% repasado` a la derecha en muted.
- Fila de búsqueda con hint `/` (convención de teclas ya existente en Cursos).
- Listado de notas: filas compactas (radio 8px, gap 1px), número mono a la izquierda,
  **frescura por nota a la derecha** — `hace Nd` (≤7d verde brand-fg, ≥30d amarillo warning)
  y **celda vacía** para notas nunca repasadas (sin ruido).
- Hover: aparece un solo `⋯` que abre dropdown con las acciones reales de
  `note-actions.tsx` (Focus, Copiar, Copiar link, Export .md, ──, Borrar nota).
  El repaso NO se ejecuta acá: vive en el Home/Repaso — el sidebar solo diagnostica.
- La nota seleccionada es la única resaltada (una sola, no la cola de hoy).
- Footer: botón primario `＋ Nueva nota · N` a ancho completo.

Detalles técnicos validados en el prototipo (evitar el temblor del hover):

- La celda derecha de cada fila tiene **ancho y alto fijos** (`56px × 22px`);
  `.r` (frescura) y `.acts` (dropdown) comparten la misma celda de grid y se
  intercambian sin reflow — el título `1fr` nunca cambia de ancho ni la fila de alto.

## Ideas reservadas (solo ideas — explícitamente NO implementar acá)

Viven como features aparte en el tracker, no en este spec:

- `.scratch/themes/papel-tinta.md` — tema claro crema con serif, números de
  margen en rojo tinta (idea del prototipo, variante F).
- `.scratch/themes/terminal.md` — modo todo-mono keyboard-only (idea del
  prototipo, variante G).

## Fuente primaria

Prototipo completo (7 variantes A–G + barra de conmutación) en la rama
throwaway `prototype/sidebar-redesign` (fuera de main):
`.scratch/sidebar-redesign/prototype.html`

## Implementación

- `issues/01-implementar-sidebar-e.md` — plegar la variante E en el componente real.
