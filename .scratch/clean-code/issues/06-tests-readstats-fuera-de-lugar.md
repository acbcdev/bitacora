# Tests de readStats fuera de lugar + wrapper sólo para tests

**Status:** resolved

## Problema

- `src/core/lib/stats.test.ts` testea funciones de `src/core/store/derive.ts` (`deriveReadStats`,
  `lastDays`) desde otro directorio. La suite de `derive.ts` ya vive en `derive.test.ts`.
- El wrapper existe sólo para esos tests: `derive.ts:229` `deriveReadStats(rows, now)` arma un
  Snapshot pelado adentro. En producción nadie lo llama (grep total: sólo el test).

## Fix

- Mover los tests a `src/core/store/derive.test.ts` (o fusionarlos ahí) construyendo el Snapshot
  pelado en un helper del propio test — la firma de `readStats(snap, now)` ya es granular.
- Borrar `deriveReadStats` y `src/core/lib/stats.test.ts`.

## Criterio

- Cero cambios en producción salvo la eliminación del wrapper.
- Los 4 tests de stats corren desde su lugar nuevo, en verde.

## Answer

Los 4 tests de stats se mudaron a `derive.test.ts` (describe "readStats / lastDays") usando el
helper `snapshot()` que ya existía ahí. Borrados `deriveReadStats` (wrapper) y
`src/core/lib/stats.test.ts`. 287 tests en verde, ahora en 44 archivos.
