# 02 — Barras de progreso con semántica

Status: ready-for-agent
Blocked by: ninguno — se puede arrancar ya

## Qué

Hay tres barras de progreso hechas con dos `<div>` anidados y un `style={{ width }}`:

- progreso por curso, en la tabla y en las tarjetas de Cursos,
- progreso del curso en su panel lateral,
- meta diaria de lectura en Hoy.

Ninguna expone semántica: un lector de pantalla no anuncia nada. Pasarlas a `Progress` del registry.

## Aceptación

- [ ] Las tres barras usan `Progress`; no queda ningún `style={{ width: ... }}` de barra en el código.
- [ ] Cada una expone `role="progressbar"` con `aria-valuenow` y un nombre accesible.
- [ ] El helper local de Cursos sigue mostrando `leídas/total` al lado de la barra.
- [ ] Un curso al 100% sigue perdiendo el color de marca (regla visual actual).
- [ ] Total en 0 → barra en 0, sin dividir por cero.
- [ ] La barra de meta diaria sigue animando el ancho al marcar una nota como leída.
