# Flaky test: emoji search en español

**Status:** needs-triage

## Problema

`el buscador encuentra emojis por su nombre en español` (emoji-picker) falló en la primera corrida y pasó en la segunda. Reproducción intermitente — no determinística.

Corrida 1 (13:06): `1 failed | 286 passed (287)`
Corrida 2 (13:09): `287 passed (287)`

## Al menos una causa posible

Con setup de jsdom de ~3s y los filtros de búsqueda (nombre español) dependiendo de estado
async (carga de datos, debounce de la búsqueda), lo más probable es que el test aserta
antes de que el filtro termine de aplicar. Falta confirmar si es ese el punto o si es otra
la causa (por ejemplo, orden de resultados no determinístico).

## Fix esperado

1. Correr aislado con `vitest run -t "el buscador encuentra"` varias veces para reproducir.
2. Si es timing: `await` explícito (findBy/user-event) en vez de aserción inmediata.
3. Si es orden: aserción sobre set de resultados, no sobre el primero.
4. Dejar el test verde en 5 corridas seguidas antes de cerrar.
