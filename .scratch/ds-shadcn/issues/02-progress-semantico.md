# 02 — Barras de progreso con semántica

Status: resolved
Blocked by: ninguno — se puede arrancar ya

## Qué

Hay tres barras de progreso hechas con dos `<div>` anidados y un `style={{ width }}`:

- progreso por curso, en la tabla y en las tarjetas de Cursos,
- progreso del curso en su panel lateral,
- meta diaria de lectura en Hoy.

Ninguna expone semántica: un lector de pantalla no anuncia nada. Pasarlas a `Progress` del registry.

## Aceptación

- [x] Las tres barras usan `Progress`; no queda ningún `style={{ width: ... }}` de barra en el código.
- [x] Cada una expone `role="progressbar"` con `aria-valuenow` y un nombre accesible.
- [x] El helper local de Cursos sigue mostrando `leídas/total` al lado de la barra.
- [x] Un curso al 100% sigue perdiendo el color de marca (regla visual actual).
- [x] Total en 0 → barra en 0, sin dividir por cero.
- [x] La barra de meta diaria sigue animando el ancho al marcar una nota como leída.

## Comments

Resuelto. `pnpm exec shadcn add progress` (radix-nova). Un solo cambio al componente del registry:
el indicador pasó de `bg-primary` a `bg-brand` — las tres barras de la app son verdes, no hay
ninguna que quiera el primary.

`role="progressbar"` + `aria-valuenow` los pone `Progress.Root` de radix solo; el nombre accesible
va por `aria-label` en cada call site.

- **Cursos**: el helper local se llamaba `Progress` y chocaba con el import, ahora es
  `CourseProgress`. Sigue siendo el que arma `barra + leídas/total`.
- **100% sin marca**: `[&>[data-slot=progress-indicator]]:bg-muted-foreground` desde el call site.
  El registry hardcodea el color del indicador y no expone prop; el selector por `data-slot` evita
  agregar una `indicatorClassName` que solo usaría este caso.
- **Alturas**: `h-1` (default) en Cursos, `h-[3px]` en el panel de curso, `h-0.5` en la meta diaria.
- **Animación de la meta diaria**: radix anima `translateX` en vez de `width`. Mismo resultado
  visual, y transform no dispara layout.

`total === 0` ya estaba guardado en los tres cálculos de `pct` (`total ? ... : 0`), no hizo falta
tocar nada.
