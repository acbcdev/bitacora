# 06 — Selects nativos, estilados por el DS

Status: ready-for-agent
Blocked by: ninguno — se puede arrancar ya

## Qué

Hay dos `<select>` nativos restilados a mano: el `Pill` de Cursos (filtro por estado y orden) y el
selector de estado del formulario de curso.

Se usa **`native-select`**, no `select`. `select` es un popup de radix: más peso, y pierde el picker
nativo de mobile por nada a cambio en este caso.

## Aceptación

- [ ] Ambos usan `NativeSelect` y siguen siendo `<select>` nativo.
- [ ] El `Pill` conserva su icono a la izquierda (`Filter` para estado, `ArrowUpDown` para orden).
- [ ] Filtrar por estado y ordenar siguen funcionando, incluidos los valores iniciales (`todos`, `recientes`).
- [ ] Sin regresión de teclado ni del picker nativo en mobile.
- [ ] El select de estado del formulario sigue disparando el auto-seteo de `finished_at` al pasar a `done`.
