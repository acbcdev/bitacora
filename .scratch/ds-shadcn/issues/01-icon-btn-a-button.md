# 01 — `.icon-btn` muere, `Button` manda

Status: ready-for-agent
Blocked by: ninguno — se puede arrancar ya

## Qué

`.icon-btn` es una clase de `index.css` que replica lo que `Button` ya hace con
`variant="ghost" size="icon-sm"`. Hay 14 usos repartidos en sidebar, curso, cursos y nota.

Prefactor: dejar **una sola** forma de escribir un botón de icono antes de que el resto de los
tickets toquen esos mismos nodos.

## Aceptación

- [ ] `.icon-btn` no existe ni en `index.css` ni en ningún `className`.
- [ ] Los 14 botones de icono son `Button`; los que navegan (los `NavLink` del sidebar) usan `asChild`.
- [ ] Cada botón conserva su `aria-label` y su `title` tal como están hoy.
- [ ] El delta de tamaño (`.icon-btn` es 30px, `size="icon-sm"` es 28px) se resuelve en `button.tsx`, nunca con clases sueltas en el call site.
- [ ] Los botones de borrar siguen poniéndose `destructive` al hover.
- [ ] Los `NavLink` del rail colapsado siguen marcando la ruta activa vía `aria-current="page"`.
