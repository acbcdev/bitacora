# ADR 0017 — Convención de teclado v2: "las letras escriben, mod+ manda"

**Status:** Accepted

## Contexto

La convención v1 (grill de `.scratch/keyboard-shortcuts/`, hoy tabla en `docs/ui-principles.md`)
era dual: teclas bare cuando el foco no está en el editor + alias `mod+` para cuando sí lo está.
El modelo era por tecla, y generaba tres dolores que un grill de 2026-06 volvió a levantar:

- Los chords `g>1-9` / `h>1-9` mueren dentro del editor (bare, `enableOnContentEditable` off):
  para saltar de notebook hay que `Esc` primero. Decisión explícita: **queda así**, el usuario
  prefiere no robar letras al texto antes que sumar alias.
- En la pantalla Nota no había forma de empezar a escribir sin click: el editor no viene enfocado.
- La regla bare/`mod+` exige saber, tecla por tecla, qué hace cada una en cada vista — el usuario
  quiere un modelo mental único y simple.

## Decisión

**1. Partición por pantalla, no por tecla.** La regla es:

- **Pantalla con editor (Nota, Notebook): las letras escriben, `mod+` manda.** Cualquier letra
  a-z con el editor desenfocado enfoca el editor y se escribe en él (type-to-focus), **sin
  excepciones** — incluyendo `F`. Las acciones de app de esa pantalla viven solo en `mod+`:
  focus mode `⌘F` + menú, nav del índice `⌘J/⌘K` (ya existían), nueva nota `⌘N` (nuevo).
  `/` queda bare cuando el editor no está enfocado (no es letra, no colisiona con tipeo).
- **Pantalla sin editor (Repaso, Cursos): bare queda como está.** `Enter`/`J`/`K` del loop
  diario, `N`/`E`/`Del` de Cursos. No hay editor cerca — el bare no puede colisionar con nada.
- Los chords `g>1-9` / `h>1-9` siguen bare-only: alcanzan a Repaso y Cursos (no tienen editor);
  en Nota y Notebook no llegan — desde ahí, `Esc` primero.

**2. Reabre y re-decide la convención v1.** La regla de fondo de v1 ("bare es inseguro donde el
foco puede estar sobre contenido editable, salvo alias mod+") sigue siendo verdadera — v2 la
simplifica: en vez de sostener dos alias por tecla y memorizar excepciones, el teclado tiene un
único significado por pantalla. La tabla de `ui-principles.md` queda actualizada a v2.

## Consecuencias

- `F` en Nota deja de togglear focus mode bare — `⌘F` (ya existía con `enableOnContentEditable`)
  y el botón del menú quedan como únicos accesos.
- El índice de Notebook deja de navegar con `J/K` bare: `⌘J/⌘K`.
- El type-to-focus es un listener propio (las lib de hotkeys no matchea "cualquier letra"): en
  Nota y en el Notebook, keydown de letra con el editor desenfocado → enfoca editor e inserta la
  letra. Ver `.scratch/editor-flow/issues/03-type-to-focus.md`.
- Lo que NO cambia: chords, hotkeys `mod+` existentes, todo el loop de Repaso, la tecla `/`.

## Detalle relacionado (misma sesión, mismo spec)

Selección inicial en Notebook = nota con `updated_at` más reciente (migración 0013: columna +
trigger auto-update + backfill con `created_at`; el índice NO se reordena — sigue por
`position`). Ver `.scratch/editor-flow/issues/01` y `02`.
