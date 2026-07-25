# 10 — Acciones de fila en `DropdownMenu`

Status: ready-for-agent
Blocked by: 01

## Qué

Editar y borrar curso aparecen como dos iconos que se revelan al hover de la fila. Con teclado son
invisibles hasta que algo adentro recibe foco, y no escalan si mañana hay una tercera acción.

**Por qué lo bloquea `01`:** los dos iconos son `.icon-btn`.

## Aceptación

- [ ] Editar y borrar viven en un `DropdownMenu` con un solo botón de trigger.
- [ ] El trigger es alcanzable por teclado sin depender del hover.
- [ ] Abrir el menú no navega al curso.
- [ ] Funciona igual en la vista tabla y en la de tarjetas.
- [ ] Borrar sigue siendo la acción destacada como destructiva.
