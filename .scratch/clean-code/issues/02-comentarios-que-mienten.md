# Comentarios que mienten o sobrevivieron a su código

**Status:** resolved

## Problema

- `src/notebooks/notebooks.tsx:26-27`: el comentario de cabecera dice que la RPC `notebooks_page`
  (migración 0006) resuelve búsqueda/filtro/orden/paginado. La RPC ya NO se llama: lo hace la
  función pura `derive.notebooksPage` sobre el snapshot (ver comentario en `derive.ts`, que dice
  explícitamente "Reemplaza a la RPC"). El comentario atribuye al server lo que vive en el cliente.
- `src/habits/habit-tiles.tsx:30`: comenta un `SLOT` ("ya no se usa…") que ya no existe en ningún
  archivo — `grep SLOT src` sólo encuentra el comentario.

## Fix

Corregir el primer comentario para decir la verdad (filtros/orden/paginado en `derive.notebooksPage`,
cliente, snapshot); borrar el segundo.

## Criterio

- Sólo comentarios; cero líneas de código. Suite en verde.

## Answer

Corregido `notebooks.tsx:19-20` (ahora dice `derive.notebooksPage` sobre el snapshot) y borrado el
comentario muerto de `SLOT` en `habit-tiles.tsx`. Sólo comentarios; suite en verde.
