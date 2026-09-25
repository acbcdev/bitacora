# 05 — Contrato de bloques: mover y menú por bloque

Type: grilling
Status: resolved
Blocked by: 01

## Question

¿Cómo se mueven y gestionan los bloques? Handle tipo Notion (⋮⋮ + +) a la izquierda: drag para reordenar (¿drop targets? ¿línea guía?), click en el handle abre menú de bloque (duplicar, borrar, convertir a…, quizá envolver en cita). Decide alcance: ¿todos los nodos (párrafos, headings, tablas, imágenes) o solo párrafo/heading? Y comportamiento en listas (¿el handle agarran el ítem o la lista entera?).

## Answer

Contrato cerrado (grill 2026-09-26, spec historia 6):

- **Layout:** `+ ⋮⋮` side-by-side en el margen izquierdo del bloque hovered (confirmado con mockup).
- **Alcance: TODOS los niveles** (`nested: true`) — decisión del usuario: drag & drop de ítems de lista también, como Notion. Multi-bloque vía `node-range`: click en `⋮⋮` selecciona el bloque, `Shift+click` extiende el rango, drag mueve el rango.
- **`+` = insertar párrafo vacío debajo y enfocar**, sin menú propio: con el cursor ahí, escribir `/` abre el slash menu (ticket 02).
- **Menú de `⋮⋮` (click, no drag):** Convertir a ▸ (Párrafo, H1/H2/H3, Lista, To-do, Cita, Código — sin tabla/imagen/divisor) · Duplicar (build propio, copia debajo) · Eliminar (directo, sin confirmación — `mod+Z` deshace).
- **Drag:** línea guía de 2px en el punto de drop (overlay propio, la extensión maneja el reorden). Skip: auto-scroll (notas cortas) y FloatingMenu (descartado: tercera puerta redundante al mismo gesto — `Enter` / `+` del handle / `/`).

## Comments

- Implementado en `b23dbbd` (historia 6 del spec): `block-controls.tsx` con DragHandle react (`nested`), menú Convertir a ▸ / Duplicar / Eliminar, `+` que inserta párrafo y enfoca, línea guía de 2px en overlay propio y NodeRangeSelection en click/Shift+click. Tests: `block-controls.test.tsx` (10, cubren los 4 AC). Skip deliberado: `unique-id` (el plugin de drag no lee ids y grabaría `id` en el JSON persistido — ADR 0018) y auto-scroll. Dropcursor nativo desactivado: pintaba una segunda línea encima de la guía propia.
