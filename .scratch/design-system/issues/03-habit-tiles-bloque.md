# Tiles de hábito: bloque sobre hatch

Status: ready-for-agent
Blocked by: 01

## Qué

`habits/habit-tiles.tsx` + `habits/habit-tile-info.tsx`: el tile pasa de barra de 3px a bloque que
sube sobre hatch (`--hatch`, bloque = `--hero` en dark). Estados según `../spec.md` (check/count/time ×
good/bad). Sin rellenos de color: verde/rojo solo en texto e ícono. Dots según ADR 0023:
proporcionales y monocromos (`color-mix(in oklab, var(--foreground) pct%, var(--track))`, `pct`
invertido para `bad`, cero = `--track`). Muere `barColor`.

## Aceptación

- Los 8 estados del prototipo (sección "Estados") se ven igual en dark y light — **el spec manda** donde difieren (el prototipo tiene datos inventados y bugs ya corregidos en el spec).
- Tests de habits verdes; chord `h>N` y click rápido sin cambios.
