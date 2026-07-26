# 05 — Input con icono, una sola vez

Status: resolved
Blocked by: ninguno — se puede arrancar ya

## Qué

Dos lugares meten un icono adentro de un input y para lograrlo replican a mano el borde, el alto y
el focus del `Input` del DS: el buscador de Cursos y el input del command palette. Es duplicación
del design system, y ya divergieron entre sí.

## Aceptación

- [x] Ambos usan `InputGroup` + `InputGroupAddon`; no queda ningún contenedor con borde armado a mano alrededor de un `<input>`.
- [x] El palette conserva `autoFocus`, el `<Kbd>esc</Kbd>` a la derecha y la navegación con flechas.
- [x] `command-palette.test.tsx` pasa sin tocarlo (el placeholder no cambia).
- [x] El focus ring aparece sobre el grupo entero, no solo sobre el `<input>` interno.
- [x] Buscar cursos sigue filtrando en cada tecla, sin debounce agregado.

## Comments

Resuelto. `pnpm exec shadcn add input-group` (arrastró `textarea`, que `input-group.tsx` importa —
no queda huérfano). A `button.tsx` y `input.tsx` se les dijo que **no** al overwrite: ya tenían el
ajuste de `icon-sm` del ticket `01`.

- **Buscador de Cursos**: `InputGroup` + `InputGroupAddon` (icono) + `InputGroupInput`. El ancho
  `w-[220px]` y el `bg-card` quedan como override; el resto (alto, borde, radio, focus) lo pone el
  componente.
- **Palette**: mismo patrón, con un segundo `InputGroupAddon align="inline-end"` para el
  `<Kbd>esc</Kbd>`. Se le saca la caja (`rounded-none border-0 border-b`) porque ahí el grupo es la
  fila entera del header, no un campo.

El ring ahora cuelga de `has-[[data-slot=input-group-control]:focus-visible]` en el grupo, así que
rodea icono + input + kbd. `autoFocus`, `onKeyDown` (flechas y Enter) y el filtrado por tecla no se
tocaron; `command-palette.test.tsx` pasa sin cambios.

Delta visual consciente: los dos inputs pasan a `text-base`, que es lo que dice el `Input` del DS.
El buscador de Cursos estaba en `text-sm` — esa era justamente la divergencia que el ticket nombra.

Los dos `InputGroup` llevan `dark:bg-transparent` / `dark:bg-card` para anular el `dark:bg-input/30`
que trae el componente, que en esta app tiñe de más.
