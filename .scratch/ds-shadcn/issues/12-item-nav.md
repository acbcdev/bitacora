# 12 — `Item` para lo que queda de `.nav-item`

Status: resolved
Blocked by: 11

## Qué

Después del ticket `11`, `.nav-item` queda usada en un solo lugar: la lista de notas del panel
lateral de Curso. Pasarla a `Item` y borrar la clase.

## Aceptación

- [x] La lista de notas del curso usa `Item`; `.nav-item` sale de `index.css` junto con sus selectores `[data-active]` y `[aria-current]`.
- [x] El punto de leído / no leído y el contador de repasos por nota se conservan.
- [x] La nota seleccionada sigue marcada visualmente.
- [x] J / K siguen moviendo la selección entre notas del curso.
- [x] Los títulos largos siguen envolviendo, no cortándose.

## Comments

Resuelto. `pnpm exec shadcn add item`. `.nav-item` y sus dos selectores (`[data-active="true"]`,
`[aria-current="page"]`) salieron de `index.css`.

La lista de notas usa `Item asChild` sobre el `<button>` que ya estaba, con los tres spans intactos:
el punto de leído/no leído, el título y el contador de repasos.

Sin `ItemMedia` / `ItemContent` / `ItemTitle`. Los dos primeros no aportaban nada sobre los spans
que ya había, y `ItemTitle` viene con `line-clamp-1` — el ticket pide explícitamente que los títulos
largos envuelvan.

`Item` solo trae hover para `<a>` (`[a]:hover:bg-muted`) y acá el nodo es un `<button>`, así que el
hover y el estado seleccionado van en la constante `NOTE_ITEM`, colgados del mismo `data-active` que
usaba `.nav-item`. J / K no se tocaron: siguen moviendo `sel`, que es lo que alimenta `data-active`.
