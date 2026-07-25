# 09 — Switcher tabla/tarjetas como `ToggleGroup`

Status: ready-for-agent
Blocked by: 01

## Qué

El switcher de vista son dos botones sueltos con `aria-pressed` dentro de un contenedor con borde y
`overflow-hidden`. Funciona, pero no expone que son opciones excluyentes de un mismo control.

**Por qué lo bloquea `01`:** esos dos botones usan `.icon-btn`.

## Aceptación

- [ ] Usa `ToggleGroup type="single"`; nunca queda sin ninguna opción seleccionada.
- [ ] Las flechas izquierda/derecha mueven entre las dos opciones.
- [ ] Los `aria-label` ("tabla" / "tarjetas") se conservan.
- [ ] El grupo sigue pegado a la derecha de la barra de filtros, con el mismo alto que el resto de los controles.
