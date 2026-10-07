# Flaky tests: suite sensible a carga

**Status:** done (fix aplicado, validar en 5 corridas)

## Problema

El flaky original apuntaba a `icon-picker.test.tsx` (emoji search). **No reproduce**: 0 fallos en
15 corridas (10 aisladas + 5 de suite), el test es síncrono (299 ms vs 5 s de timeout) y
`icon-picker.tsx` no tiene debounce ni estado diferido. Sin mensaje de error original, no hay
con qué trabajar. Si reaparece, capturar el error exacto antes de tocar nada.

El que sí reprodujo (1 de 5 corridas de suite completa):
`notebook-create-note.test.tsx` → `AssertionError: expected 468 to be less than 400`.

## Causa

`SELECT_MS = 400` hacía dos trabajos: latencia simulada Y umbral de `expect(elapsed).toBeLessThan`.
El trabajo real (navegar + montar Tiptap en jsdom) ya consume 100–470 ms bajo carga, así que el
margen contra "colgado esperando el SELECT" era casi cero.

## Fix aplicado

`SELECT_MS = 1000`, sleep final `SELECT_MS + 500` (antes `* 2`), `timeout: SELECT_MS * 2` en el
`waitFor` inicial. Descartado `SELECT_MS = 1500`: sleep de 3 s rozaba el timeout de 5 s del test.

## Observados, sin causa probada (grill 2026-10-07)

~20 corridas de suite completa, 3 tests distintos fallaron, ninguno reproduce aislado: la suite es
sensible a carga, no hay un único flaky.

- `outline.test.tsx` › "el activo es el último heading que reportó el IntersectionObserver" (1 fallo).
  Hipótesis sin verificar: `intersectionCallback?.(...)` (línea 70) traga el caso en que el
  observer aún no se creó. 0/8 aislado.
- `icon-picker.test.tsx` › emoji search: 0 fallos en 15 corridas.

Si reaparecen en CI (ubuntu, 2 cores expone mejor que la laptop): capturar el error exacto antes de
tocar nada. No arreglar a ciegas.
