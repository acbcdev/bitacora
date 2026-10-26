# performance.measure en flujos propios

Status: needs-info

**Diferido** (grill 2026-10-26). Trigger: un flujo se siente lento y Cloudflare Web Analytics
no explica por qué. Hasta entonces, medir por medir.

## Qué

`performance.mark/measure` (nativo, 0 deps) en: abrir nota (click → editor montado), autosave
(edición → `save` resuelto), `snapshot` (request → datos), avance de repaso.
Puntos únicos: el seam `Store` (`src/core/store/`) y el autosave (ADR 0021).

## Aceptación

- Los measures aparecen en el panel Performance de DevTools con nombres `pulpo:*`.
- Wrapper de ≤ 10 líneas; sin abstracción por flujo.
