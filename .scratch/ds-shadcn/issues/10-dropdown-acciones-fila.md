# 10 — Acciones de fila en `DropdownMenu`

Status: resolved
Blocked by: 01

## Qué

Editar y borrar curso aparecen como dos iconos que se revelan al hover de la fila. Con teclado son
invisibles hasta que algo adentro recibe foco, y no escalan si mañana hay una tercera acción.

**Por qué lo bloquea `01`:** los dos iconos son `.icon-btn`.

## Aceptación

- [x] Editar y borrar viven en un `DropdownMenu` con un solo botón de trigger.
- [x] El trigger es alcanzable por teclado sin depender del hover.
- [x] Abrir el menú no navega al curso.
- [x] Funciona igual en la vista tabla y en la de tarjetas.
- [x] Borrar sigue siendo la acción destacada como destructiva.

## Comments

Resuelto. `pnpm exec shadcn add dropdown-menu`, sin tocar el componente.

`RowActions` es ahora un trigger `MoreHorizontal` + `DropdownMenu` con Editar y Borrar. El mismo
componente sirve en tabla y en tarjetas, así que las dos vistas cambiaron con un solo diff.

El truco de `opacity-0 group-hover:opacity-100` se fue: el trigger está siempre visible, que era el
punto del ticket. En tarjetas eso dejó libre el `group-hover:hidden` del "últ. repaso", que existía
solo para hacerle lugar a los dos iconos — también borrado.

`stopPropagation` va en el trigger **y** en el content. El content se portalea fuera del `<tr>`,
pero React propaga por el árbol de componentes igual que si fuera hijo, así que sin el segundo
elegir "Editar" abría el curso además de abrir el modal.

Borrar usa `variant="destructive"` de `DropdownMenuItem`. El `confirm()` sigue ahí; lo reemplaza el
ticket `17`.
