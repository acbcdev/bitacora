# Editor flow — convención teclado v2 + última editada

**Status:** grillado y confirmado 2026-06. ADR de la decisión:
`docs/adr/0017-convencion-teclado-v2-mod-manda.md`. Tabla viva: `docs/ui-principles.md`.

## Problema (grill de esta sesión)

El flujo alrededor del editor está algo molesto. Cuatro hallazgos, verificados en código:

1. Los chords `g>1-9` / `h>1-9` mueren dentro del editor (bare en contenteditable) — **decisión:
   queda así**, `Esc` primero, sin cambio (elección explícita del usuario sobre alias `mod+1-9`).
2. En Nota no hay forma de empezar a escribir sin click.
3. Los bare keys pueden fallar/colisionar — el usuario quiere un modelo único, no dos alias por
   tecla. **Regla v2: "las letras escriben, `mod+` manda", por pantalla:**
   - Con editor (Nota, Notebook): letras a-z escriben (type-to-focus, **sin excepciones** — hasta
     `F`; focus mode queda en `⌘F` + menú). Acciones de app solo `mod+`: nav índice `⌘J/⌘K` (ya
     existe), nueva nota `⌘N` (nuevo). `/` queda bare cuando el editor no está enfocado.
   - Sin editor (Repaso, Cursos): bare queda tal cual — `Enter`/`J`/`K`/`N`/`E`/`Del`.
4. Al entrar a un notebook caés en la primera nota, no en la última editada. **Decisión:** el
   índice NO se reordena (queda por `position`); solo la selección inicial = `updated_at` máximo.
   La columna no existe → migración con trigger auto-update.

## Issues

- `01-migration-updated-at.md` — columna + trigger + backfill.
- `02-seleccion-ultima-editada.md` — NoteRef + selección inicial.
- `03-type-to-focus-nota.md` — type-to-focus en Nota, sin exenciones.
- `04-notebook-sin-excepcion.md` — regla v2 en Notebook: type-to-focus embebido, `⌘N`, índice en mod+.
