# 09 — Switcher tabla/tarjetas como `ToggleGroup`

Status: resolved
Blocked by: 01

## Qué

El switcher de vista son dos botones sueltos con `aria-pressed` dentro de un contenedor con borde y
`overflow-hidden`. Funciona, pero no expone que son opciones excluyentes de un mismo control.

**Por qué lo bloquea `01`:** esos dos botones usan `.icon-btn`.

## Aceptación

- [x] Usa `ToggleGroup type="single"`; nunca queda sin ninguna opción seleccionada.
- [x] Las flechas izquierda/derecha mueven entre las dos opciones.
- [x] Los `aria-label` ("tabla" / "tarjetas") se conservan.
- [x] El grupo sigue pegado a la derecha de la barra de filtros, con el mismo alto que el resto de los controles.

## Comments

Resuelto. `pnpm exec shadcn add toggle-group` (arrastra `toggle`, que le da los variants).

`ToggleGroup type="single" variant="outline" spacing={0}` reproduce el control segmentado que antes
se armaba con un `div` con borde y `overflow-hidden`: con `spacing={0}` el componente redondea solo
las puntas y colapsa los bordes entre items.

`onValueChange={(v) => v && setView(...)}` es lo que impide quedarse sin vista: radix manda `""`
cuando clickeás la opción ya activa, y ese caso se ignora.

Las flechas izquierda/derecha salen gratis del roving focus de radix — no hay `onKeyDown` propio.
Los `aria-label` "tabla" y "tarjetas" siguen igual, y `ml-auto` mantiene el grupo pegado a la
derecha con el `h-8` del resto de la barra.
