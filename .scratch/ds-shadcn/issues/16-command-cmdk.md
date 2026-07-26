# 16 — Command palette sobre `cmdk`

Status: resolved
Blocked by: 05, 15

## Qué

`command-palette.tsx` implementa a mano el filtrado, la navegación con flechas, el scroll de la fila
seleccionada y el agrupado por sección. `cmdk` hace las cuatro cosas.

⚠️ **Mete una dep npm nueva (`cmdk`).** Es la única del feature junto con `sonner`.

**Por qué lo bloquean `05` y `15`:** el `command` del registry depende de `input-group` y de
`dialog`. Sin los dos, instalarlo trae una segunda copia de cada uno.

## Aceptación

- [x] El palette usa `CommandDialog` con `CommandInput` / `CommandList` / `CommandGroup` / `CommandItem`.
- [x] Sigue filtrando por label **y** por nombre de grupo — hoy matchea contra los dos y es comportamiento buscado.
- [x] Flechas más Enter corren la acción seleccionada y cierran; sin resultados avisa en vez de mostrar una lista vacía.
- [x] ⌘K abre, Esc cierra.
- [x] `command-palette.test.tsx` queda verde; si cmdk cambia el DOM se adapta el test, nunca se borran casos.
- [x] Las acciones siguen saliendo del caché de TanStack Query, sin búsqueda en servidor.

## Comments

Resuelto. `pnpm exec shadcn add command` (única dep nueva: `cmdk`). `command-palette.tsx` perdió el
filtrado, el manejo de flechas, el `scrollIntoView` de la fila seleccionada y el agrupado a mano:
todo eso lo hace cmdk. Quedó el armado de la lista de acciones y el render.

El filtrado por label **y** por nombre de grupo se conserva pasándole a cada item
`value={`${group} ${a.label}`}` — cmdk matchea contra el `value`, no contra el texto renderizado. Sin
resultados sale un `CommandEmpty` con el query, no una lista vacía.

`command-palette.test.tsx` quedó verde **sin tocarlo**.

Dos cosas para dejar anotadas:

1. **El `CommandDialog` del registry no monta el root de cmdk.** Renderiza `Dialog > DialogContent >
   {children}` y nada más, así que usarlo tal cual revienta con `TypeError: Cannot read properties of
   undefined (reading 'subscribe')` — `CommandInput` busca un contexto que no existe. El contenido
   del palette va envuelto en un `<Command>` explícito adentro del `CommandDialog`.
2. **Se perdió el `<Kbd>esc</Kbd>` a la derecha del input**, que el ticket `05` había dejado como
   criterio cumplido. `CommandInput` del registry no tiene slot de addon: es
   `div > SearchIcon + input`, sin `children`. Recuperarlo pedía o forkear el componente del registry
   o posicionar el `Kbd` en absoluto encima del input. Ninguna de las dos vale por un hint de teclado
   que además está en el cheatsheet (`?`). Esc sigue cerrando.
