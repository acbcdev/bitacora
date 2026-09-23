# Notebook: regla v2 sin excepción (type-to-focus embebido + ⌘N)

**Status:** ready-for-agent

Blocked by: 03 (mismo listener/patrón; sacarlo a un hook compartido si aplica).

## Qué

La pantalla Notebook entra en la partición "con editor": las letras escriben, `mod+` manda.
Sin excepciones (decisión del grill) — incluye mientras se lee el índice al lado del editor:
un `J` accidental enfoca el editor e inserta la letra. Consecuencias asumidas:

1. **Type-to-focus en el editor embebido** (NoteEditor en `notebook.tsx`): mismas reglas del
   issue 03 — keydown de letra con el editor desenfocado → foco + insertar.
2. **`N` → `⌘N`**: el bare de crear nota (notebook.tsx:143-149) muere; se registra el alias mod+
   con `enableOnContentEditable: true` (nueva nota es deliberada aunque estés escribiendo).
3. **Nav del índice en `⌘J/⌘K`** — ya existe (notebook.tsx:136-149), no requiere código. Los bare
   `j/k/left/right` de la pantalla mueren bajo la regla v2.
4. **`/` (buscador) queda bare** cuando el editor no está enfocado: no es letra, no colisiona con
   el type-to-focus. Con el editor enfocado, `Esc` y después `/` (o el mouse).

## Consistencia global

- Chords `g>1-9`: inaccesibles en Notebook (la `g` escribe). Desde Repaso/Cursos siguen.
- Los alias mod+ de nav ya existentes no se tocan.

## Test

Mismo patrón del issue 03, sobre Notebook: letra con índice enfocado → editor enfocado + letra
insertada; `⌘N` crea nota; `j` bare ya no mueve la selección.
