# 15 — `Dialog` de radix en vez de `<dialog>` nativo

Status: ready-for-agent
Blocked by: 07

## Qué

`modal.tsx` usa `<dialog>` nativo. Eso fue una decisión explícita (ui-principles #5): focus trap,
Esc y backdrop salen gratis del navegador, sin librería.

⚠️ **Este ticket revierte esa decisión a propósito.** No es limpieza: es lo que permite que el
ticket `16` use `CommandDialog` sin tener dos sistemas de modal conviviendo en la app. Si `16` se
cancela, este ticket se cancela con él — el `<dialog>` nativo por sí solo no tiene nada de malo.

Consumidores a migrar: cheatsheet, command palette y formulario de curso.

**Por qué lo bloquea `07`:** el formulario de curso es uno de los tres consumidores y `07` reescribe
sus campos.

## Aceptación

- [ ] Los tres consumidores usan `Dialog`.
- [ ] `modal.tsx` se borra.
- [ ] Esc cierra, el click en el backdrop cierra, y al cerrar el foco vuelve al elemento que lo abrió.
- [ ] Cada diálogo tiene un `DialogTitle`, aunque sea `sr-only`.
- [ ] El stub de `<dialog>` del setup de jsdom deja de ser necesario y se borra; si sigue haciendo falta, se documenta por qué.
- [ ] El scroll del body queda bloqueado mientras hay un diálogo abierto.
