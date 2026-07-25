# 13 — `Tooltip` en vez de `title=`

Status: ready-for-agent
Blocked by: 09, 10, 11

## Qué

Los botones de icono que quedan fuera del sidebar se apoyan en el atributo `title` del navegador:
tarda cerca de un segundo, no se puede estilar y no aparece con foco de teclado.

**Por qué lo bloquean `09`, `10` y `11`:** los tres reescriben exactamente los nodos que este ticket
tiene que envolver.

## Aceptación

- [ ] Los botones de icono de Curso, Cursos y Nota usan `Tooltip`.
- [ ] El tooltip aparece con foco de teclado, no solo con hover.
- [ ] El `aria-label` de cada botón se conserva — el tooltip no lo reemplaza.
- [ ] Hay un solo `TooltipProvider` en la raíz de la app, no uno por botón.
- [ ] No queda ningún `title=` decorativo en botones de icono.
