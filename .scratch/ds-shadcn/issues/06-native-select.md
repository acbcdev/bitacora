# 06 — Selects nativos, estilados por el DS

Status: resolved
Blocked by: ninguno — se puede arrancar ya

## Qué

Hay dos `<select>` nativos restilados a mano: el `Pill` de Cursos (filtro por estado y orden) y el
selector de estado del formulario de curso.

Se usa **`native-select`**, no `select`. `select` es un popup de radix: más peso, y pierde el picker
nativo de mobile por nada a cambio en este caso.

## Aceptación

- [x] Ambos usan `NativeSelect` y siguen siendo `<select>` nativo.
- [x] El `Pill` conserva su icono a la izquierda (`Filter` para estado, `ArrowUpDown` para orden).
- [x] Filtrar por estado y ordenar siguen funcionando, incluidos los valores iniciales (`todos`, `recientes`).
- [x] Sin regresión de teclado ni del picker nativo en mobile.
- [x] El select de estado del formulario sigue disparando el auto-seteo de `finished_at` al pasar a `done`.

## Comments

Resuelto. `pnpm exec shadcn add native-select`, sin tocar el componente. Siguen siendo `<select>`
nativos, así que el picker de mobile y el teclado quedan igual — no hay nada que testear ahí que no
sea el comportamiento del browser.

- **`Pill`**: el `<label>` con borde se fue. El icono ahora va absoluto sobre el select y este le
  hace lugar con `[&>select]:pl-8`. Es la única forma sin bifurcar el componente: `NativeSelect` no
  tiene slot para hijos que no sean `<option>`.
- **Formulario**: `[&>select]:h-10` para que siga alineado con los `Input` de al lado (que llevan
  `h-10`) y `w-full` porque el wrapper del registry es `w-fit`.

`onChange` idéntico en los dos, así que filtrar, ordenar y el auto-seteo de `finished_at` al pasar a
`done` (que vive en `submit()`, no en el select) no cambiaron. Valores iniciales `todos` y
`recientes` siguen saliendo del `useState` de siempre.

Delta visual: el `Pill` pasa de `text-xs` a `text-sm` y gana el chevron del DS a la derecha. Se
aceptan los dos — sacarlos era volver a pisar el componente a mano, que es lo que el ticket viene a
matar.
