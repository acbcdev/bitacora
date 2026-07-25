# 16 — Command palette sobre `cmdk`

Status: ready-for-agent
Blocked by: 05, 15

## Qué

`command-palette.tsx` implementa a mano el filtrado, la navegación con flechas, el scroll de la fila
seleccionada y el agrupado por sección. `cmdk` hace las cuatro cosas.

⚠️ **Mete una dep npm nueva (`cmdk`).** Es la única del feature junto con `sonner`.

**Por qué lo bloquean `05` y `15`:** el `command` del registry depende de `input-group` y de
`dialog`. Sin los dos, instalarlo trae una segunda copia de cada uno.

## Aceptación

- [ ] El palette usa `CommandDialog` con `CommandInput` / `CommandList` / `CommandGroup` / `CommandItem`.
- [ ] Sigue filtrando por label **y** por nombre de grupo — hoy matchea contra los dos y es comportamiento buscado.
- [ ] Flechas más Enter corren la acción seleccionada y cierran; sin resultados avisa en vez de mostrar una lista vacía.
- [ ] ⌘K abre, Esc cierra.
- [ ] `command-palette.test.tsx` queda verde; si cmdk cambia el DOM se adapta el test, nunca se borran casos.
- [ ] Las acciones siguen saliendo del caché de TanStack Query, sin búsqueda en servidor.
