# 14 — `Card` para lo que queda de `.panel`

Status: resolved
Blocked by: 03, 08

## Qué

`.panel` es `rounded-xl border bg-card` y marca cuatro superficies: tarjetas de curso, panel de
repaso de Hoy, contenedor de la tabla de cursos y la caja del login.

**Por qué lo bloquean `03` y `08`:** los estados vacíos y la tabla viven adentro de esos paneles.

## Aceptación

- [x] Las cuatro superficies usan `Card`; `.panel` sale de `index.css`.
- [x] Las tarjetas de curso siguen navegando al click y resaltando al hover.
- [x] El panel de repaso sigue conteniendo tanto el estado vacío como el editor en solo lectura.
- [x] El `overflow-hidden` que le recorta las esquinas a la tabla se conserva.
- [x] Si `Card` no aporta nada sobre la clase en algún caso (por ejemplo, un panel sin header ni footer), se deja la clase y se documenta en el ticket cuál y por qué.

## Comments

Resuelto. `pnpm exec shadcn add card`. `.panel` salió de `index.css`; las cuatro superficies (más
una quinta que apareció en el camino) usan `Card`:

- tabla de cursos → `Card className="p-0"`, el `overflow-hidden` que le recorta las esquinas ya
  viene en la base de `Card`, no hizo falta pedirlo;
- tarjetas de curso → `Card` con `cursor-pointer`, `gap-0` y el `hover:bg-muted` de siempre; el
  `onClick` que navega no se tocó;
- panel de repaso de Hoy → `Card className="mb-8 py-6"`, sigue conteniendo tanto el `Empty` del `03`
  como el editor en solo lectura;
- caja del login → `Card className="gap-5 p-8"`;
- `TableSkeleton` (`04`) también usaba `.panel` y pasó a `Card`.

Ninguna se queda con la clase, así que la última casilla no aplica.

Deltas anotados:

- `Card` dibuja el contorno con `ring-1 ring-foreground/10` en vez de `border`. El anillo no ocupa
  espacio de layout, así que el contenido no se corre — pero es un pelo más suave que el borde.
- El panel de repaso pasa de `<section>` a `<div>`: `Card` no expone `asChild`. No era un landmark
  con nombre, así que no se pierde nada de a11y.
- Las tarjetas llevan `gap-0` para anular el `gap-(--card-spacing)` de `Card`: adentro ya hay
  `mb-3.5` / `mb-2.5` propios.
