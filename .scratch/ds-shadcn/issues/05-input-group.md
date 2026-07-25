# 05 — Input con icono, una sola vez

Status: ready-for-agent
Blocked by: ninguno — se puede arrancar ya

## Qué

Dos lugares meten un icono adentro de un input y para lograrlo replican a mano el borde, el alto y
el focus del `Input` del DS: el buscador de Cursos y el input del command palette. Es duplicación
del design system, y ya divergieron entre sí.

## Aceptación

- [ ] Ambos usan `InputGroup` + `InputGroupAddon`; no queda ningún contenedor con borde armado a mano alrededor de un `<input>`.
- [ ] El palette conserva `autoFocus`, el `<Kbd>esc</Kbd>` a la derecha y la navegación con flechas.
- [ ] `command-palette.test.tsx` pasa sin tocarlo (el placeholder no cambia).
- [ ] El focus ring aparece sobre el grupo entero, no solo sobre el `<input>` interno.
- [ ] Buscar cursos sigue filtrando en cada tecla, sin debounce agregado.
