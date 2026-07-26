# 15 — `Dialog` de radix en vez de `<dialog>` nativo

Status: resolved
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

- [x] Los tres consumidores usan `Dialog`.
- [x] `modal.tsx` se borra.
- [x] Esc cierra, el click en el backdrop cierra, y al cerrar el foco vuelve al elemento que lo abrió.
- [x] Cada diálogo tiene un `DialogTitle`, aunque sea `sr-only`.
- [x] El stub de `<dialog>` del setup de jsdom deja de ser necesario y se borra; si sigue haciendo falta, se documenta por qué.
- [x] El scroll del body queda bloqueado mientras hay un diálogo abierto.

## Comments

Resuelto. `pnpm exec shadcn add dialog`. Los tres consumidores (cheatsheet, command palette y
formulario de curso) montan `Dialog` / `DialogContent` / `DialogHeader` / `DialogTitle`, y
`src/components/ui/modal.tsx` se borró.

Los tres se manejan como diálogos siempre abiertos que el padre monta y desmonta
(`<Dialog open onOpenChange={(open) => !open && onClose()}>`), que es como funcionaba `Modal`. Esc,
click en el backdrop, focus trap, retorno del foco al trigger y el bloqueo de scroll del body los
pone radix — no quedó nada de eso escrito a mano.

El cheatsheet y el palette usan `showCloseButton={false}`: ya tenían su `<Kbd>esc</Kbd>` y una X
extra no estaba en el diseño.

Sobre el stub de jsdom: el de `<dialog>` (`showModal` / `close`) se borró, ya no hace falta. En su
lugar quedaron dos stubs distintos en `src/test/setup.ts`, ambos por límites de jsdom 29 y no por
código de la app:

- `Element.prototype.scrollIntoView` — jsdom no implementa layout y radix lo llama al enfocar.
- `ResizeObserver` — lo pide cmdk (ticket `16`), no radix.
