# Themes (multi-preset) — to-grill

**Status:** abierto — falta decidir qué significa. El hogar ya existe (Settings dialog, 2026-08-25).

Ideas de temas concretos en este dir: `papel-tinta.md`, `terminal.md`.

## Estado del grill

**Lo que ya existe:** toggle dark/light persistido en `localStorage` (`bita-theme`), ahora con hogar en el dialog de Settings. Si "themes" pedía solo claro/oscuro, ya está.

**Lo que falta decidir:** si "themes multi-preset" es paletas custom más allá de claro/oscuro (scope nuevo — choca con ADR 0005, "sin design system formal", y con `ui-principles.md` de no construir infra "para después"). El gate de uso real se levantó (2026-09-23), así que está libre para spec-ear — solo falta nombrar qué es.

**Relacionado:** ADR 0011 (`docs/adr/0011-store-adapter-supabase-o-localstorage.md`) — el Settings dialog que contiene el tema salió de ahí.
