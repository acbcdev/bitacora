# Array paralelo por índice: TurnBlockIcon

**Status:** resolved

## Problema

`src/core/components/bubble-menu.tsx` (fin de archivo): `TurnBlockIcon({ index })` define un array
de íconos alineado POR POSICIÓN con el array `BLOCKS` (TypeIcon → encabezados → listas → …). Los
dos arrays son paralelos: si alguien reordena o agrega un bloque en `BLOCKS` y no en `icons`, el
menú muestra el ícono equivocado sin ningún error.

## Fix

El ícono pertenece a la entrada: agregar `icon: LucideIcon` a `type BlockKind` y a cada item de
`BLOCKS`; `TurnBlockIcon` desaparece (o queda un `b.icon` directo en el map del popover).

## Criterio

- Mecánico; tests de bubble-menu en verde (`turn-item-*` no cambia).

## Answer

`icon` ahora es campo de `BlockKind` (las 9 entradas de BLOCKS traen su LucideIcon); el popover usa
`<b.icon>` y `TurnBlockIcon` desapareció. Suite en verde.
