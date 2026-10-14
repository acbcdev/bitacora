# Header Hoy y card de repaso con lenguaje D

Status: resolved
Blocked by: 01

## Qué

- `review/review-stats.tsx`: fecha humana en vez de `todayKey()`; barras finas inline (tooltip del
  🔥 se borra) con etiqueta "14 días" alimentadas por el **Cumplimiento diario** (nueva función pura
  en `derive.ts`, ver `CONTEXT.md`) en vez de `lastDays(byDay)`. Reglas de altura/verde en
  `../spec.md`.
- `review/review.tsx` + `review/note-card.tsx`: card con `--hero`, título 44px (300 dark / 400 light),
  "Anterior" circular, "Siguiente" pill primaria; `kbd` en botón sólido con `currentColor` 10%.

## Aceptación

- Test de la derivación: día con hábitos mixtos (good cumplido, good parcial, bad sin log = cumplido),
  hábito creado después del día (no cuenta), hábito `week` (no cuenta), día sin hábitos diarios.
- Mismo comportamiento de teclado (Enter, ⌘Enter, ←, →); tests de review verdes.
- Visual igual al prototipo en dark y light — **el spec manda** donde difieren (el prototipo tiene datos inventados y bugs ya corregidos en el spec).
