# Type-to-focus en Nota (sin exenciones)

**Status:** ready-for-agent

## Qué

En la pantalla Nota (`src/notes/note.tsx`), un keydown de letra a-z con el editor **desenfocado**
enfoca el editor e inserta la letra que inició el tipeo. Sin excepciones — **incluida `F`**:
focus mode queda solo en `⌘F` (ya existe con `enableOnContentEditable`) y el botón "Focus" del
menú de acciones. Decisión explícita del grill: cero exenciones.

Los chords `g>1-9` / `h>1-9` quedan inaccesibles en Nota — se usan desde Repaso/Cursos. Desde
Nota, `Esc` primero (decisión del grill sobre los chords, ver ADR 0017).

## Detalle de implementación

- react-hotkeys-hook no matchea "cualquier letra": es un listener `keydown` propio sobre la
  pantalla, no un hotkey más. Reglas:
  - Ignorar si el editor ya tiene foco (`editor.isFocused`), si hay dialog/confirm abierto, o si
    el evento tiene `mod/alt/ctrl` (esos tienen su propia tecla asignada).
  - Ignorar teclas no-letra (Enter, Esc, flechas, `/`...) — no capturar Enter: en Nota no es
    acción de app, y si el editor va a recibirlo igual, dejarlo al navegador.
  - Insertar la letra: enfocar `editor.commands.focus("end")` y dejar que el keydown siga su
    curso natural — el editor, ya enfocado, recibe el mismo evento y lo inserta. No simular la
    inserción a mano (doble inserción).
- El `escape` de note.tsx (salir de focus mode) no se toca.

## Test

Un test que: renderiza Nota, despacha keydown de letra con el body enfocado, y aserta que el
editor tiene foco y el doc contiene la letra. Y uno negativo: con `mod+` presionado, no enfoca.
