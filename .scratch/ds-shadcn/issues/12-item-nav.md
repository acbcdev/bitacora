# 12 — `Item` para lo que queda de `.nav-item`

Status: ready-for-agent
Blocked by: 11

## Qué

Después del ticket `11`, `.nav-item` queda usada en un solo lugar: la lista de notas del panel
lateral de Curso. Pasarla a `Item` y borrar la clase.

## Aceptación

- [ ] La lista de notas del curso usa `Item`; `.nav-item` sale de `index.css` junto con sus selectores `[data-active]` y `[aria-current]`.
- [ ] El punto de leído / no leído y el contador de repasos por nota se conservan.
- [ ] La nota seleccionada sigue marcada visualmente.
- [ ] J / K siguen moviendo la selección entre notas del curso.
- [ ] Los títulos largos siguen envolviendo, no cortándose.
