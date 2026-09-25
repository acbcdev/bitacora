# 02 — Contrato del menú slash /

Type: grilling
Status: resolved
Blocked by: 01

## Question

¿Qué contrata el menú `/` exactamente? Lista de ítems (heading 1–3, lista, tarea, cita, tabla, imagen, code, división…), filtrado al escribir, navegación por teclado, colocación del popup, qué pasa si el usuario no está al inicio de línea, y cómo se inserta un bloque de tabla (¿placeholder inmediato + botones?). La integración debe quedar "muy fina": comportamiento Notion-like sin sorpresas.

## Answer

Contrato cerrado (grill 2026-09-26, spec en ../spec.md, historia 2):

- **Ítems (10):** Heading 1/2/3 · Lista con viñetas · Lista numerada · To-do · Cita · Código · Divisor · Tabla · Imagen (file picker → `store.uploadNoteImage`, mismo path del paste de imagen). H4–H6 y "párrafo" fuera. Filtrado excluyente case-insensitive (`h1` matchea Heading 1).
- **Trigger:** `/` al inicio de bloque o precedido de espacio; nunca en medio de palabra. Query hasta espacio o fin de línea; espacio cierra (o confirma con match único). Sin match = "no results"; `Esc` restaura el `/` literal.
- **On-select:** transformaciones (heading/listas/cita/código) convierten el bloque entero del cursor (comportamiento Notion); inserciones (tabla/imagen/divisor) parten el párrafo en el cursor.
- **Popup:** portal mínimo con `cmdk` (ya en deps) montado vía `props.mount/destroy` de `Suggestion`, posicionado con su `floatingUi` (`bottom-start`, offset 4, `flip`). Lista plana, icono + nombre, sin submenús.
- **Tabla:** `insertTable({ rows: 2, cols: 2 })`, sin header row (decisión del usuario; header se togglea desde la toolbar de tablas). Grid-picker de tamaño descartado — pulible si molesta en uso real.
