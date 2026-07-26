# 13 — `Tooltip` en vez de `title=`

Status: resolved
Blocked by: 09, 10, 11

## Qué

Los botones de icono que quedan fuera del sidebar se apoyan en el atributo `title` del navegador:
tarda cerca de un segundo, no se puede estilar y no aparece con foco de teclado.

**Por qué lo bloquean `09`, `10` y `11`:** los tres reescriben exactamente los nodos que este ticket
tiene que envolver.

## Aceptación

- [x] Los botones de icono de Curso, Cursos y Nota usan `Tooltip`.
- [x] El tooltip aparece con foco de teclado, no solo con hover.
- [x] El `aria-label` de cada botón se conserva — el tooltip no lo reemplaza.
- [x] Hay un solo `TooltipProvider` en la raíz de la app, no uno por botón.
- [x] No queda ningún `title=` decorativo en botones de icono.

## Comments

Resuelto. `tooltip` ya había entrado como dependencia del sidebar en el `11`.

`TooltipProvider` va una sola vez, en `App`, envolviendo a `SidebarProvider`. De ahí cuelgan los
tooltips del sidebar (prop `tooltip` de `SidebarMenuButton`) y los seis de las pantallas: volver y
borrar en Nota, volver ×2 y borrar en Curso, y el trigger de acciones en Cursos.

El patrón es `Tooltip` > `TooltipTrigger asChild` > `Button` en los cinco directos; en el de Cursos
el `TooltipTrigger` envuelve al `DropdownMenuTrigger`, que a su vez envuelve al `Button`.

Cada botón conserva su `aria-label` — el tooltip es visual, no el nombre accesible. Como radix
dispara con foco además de hover, ahora aparece con `Tab`, que era la queja del ticket.

No quedó ningún `title=` en el código: los del sidebar viejo murieron con el `11` y los de las
pantallas con el `01`.

Un cambio de test: `review.test.tsx` renderiza `Review`, que embebe `Courses`, que ahora tiene
tooltips — sin provider radix tira. El helper de render del test lo envuelve en `TooltipProvider`.
