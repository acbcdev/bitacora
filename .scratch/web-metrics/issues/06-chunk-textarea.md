# Chunk `textarea-*` de 107 KB gz en la carga inicial

Status: needs-triage

## Qué

`pnpm build` (2026-11-08) genera `textarea-*` de 338 KB / 107 KB gz y `dist/index.html` lo
precarga (`modulepreload`). Un textarea no pesa eso: rolldown nombró un chunk compartido por uno de
sus módulos y adentro va alguna dependencia pesada.

Carga inicial hoy ~332 KB gz contra los 175 que dejó `0d0b628`. Averiguar qué hay adentro y si
puede ir lazy.

No bloquea 01 ni 03: el budget congela el estado actual, este issue lo baja.
