# UI Principles — pulpo

No hay design system formal (ver ADR 0005). Estas son las reglas que hacen que la app se sienta
como se tiene que sentir. El felt-need del usuario es **"rápido, teclado, no-Notion"** — eso es
interacción, no decoración.

## Las reglas

1. **Keyboard-first.** Cada acción frecuente tiene un shortcut. El mouse es opcional, no el camino
   principal. La pantalla de Repaso se maneja entera con `Enter` / `←` / `→` sin tocar el mouse.
   Ver la convención de teclas más abajo antes de agregar un shortcut nuevo.
2. **La nota manda.** Abierta —en el dialog de Repaso o en la pantalla Nota— es grande, legible, lo
   único importante en pantalla. Todo lo demás (chrome, nav, metadata) es secundario y discreto.
   Excepción a propósito: el card de la cola de Repaso no muestra la nota completa, solo un extracto
   corto + call to action — la nota completa vive en un dialog on-demand, no inline en la cola (ver
   `.scratch/review-note-dialog/spec.md`).
3. **Chrome mínimo.** Sin sidebars pesadas, sin toolbars llenas de botones que no se usan. Notion
   se siente lento por exceso de UI — no repetir eso.
4. **Rápido de verdad.** Interacciones sin lag percibido. Optimismo en la UI donde ayude (avanzar
   la cola sin esperar el round-trip). TanStack Query cachea; no re-fetch innecesario.
5. **Accesibilidad gratis.** Usar los primitives de Radix (vía shadcn/ui) para dialogs, menús,
   dropdowns — traen focus management y nav por teclado correctos. No reinventar eso a mano.

## Convención de teclas

Resultado del grill en `.scratch/keyboard-shortcuts/`. Antes de agregar un shortcut nuevo, revisar
si ya hay una tecla con este significado en otra vista — reusarla en vez de inventar una nueva.

**Regla v2 (ADR 0017): "las letras escriben, mod+ manda" — por pantalla, no por tecla.** Donde
hay editor (Nota, Notebook) cualquier letra a-z con el editor desenfocado enfoca el editor y se
escribe, sin excepciones (ni F: focus mode es `⌘F`); las acciones de app viven solo en `mod+`.
Donde no hay editor (Repaso, Cursos), bare queda. Los chords `g>`/`h>` solo llegan a pantallas
sin editor — desde Nota/Notebook, `Esc` primero.

| Tecla                                                         | Significa                                                                                                                                                                                                                           | Dónde aplica bare                                                                                                   | Dónde necesita `mod+`                                                                |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `←`/`→` (ADR 0022)                                            | anterior/siguiente en una secuencia plana                                                                                                                                                                                           | Repaso y Cursos (sin editor)                                                                                        | Notebook (nav del índice — ahí las letras escriben, v2)                              |
| `N`                                                           | crear                                                                                                                                                                                                                               | Cursos (sin editor, no hay editable en el punto de disparo)                                                         | Notebook (`⌘N` — v2: las letras escriben)                                            |
| `E`                                                           | editar                                                                                                                                                                                                                              | Cursos (fila seleccionada, sin editor)                                                                              | —                                                                                    |
| `Delete`/`Backspace`                                          | borrar (siempre con confirmación)                                                                                                                                                                                                   | Cursos (fila seleccionada, sin editable)                                                                            | Nota (contenido editable siempre enfocado)                                           |
| `Enter`                                                       | confirmar / abrir la acción principal                                                                                                                                                                                               | Cursos (abrir), Repaso (marcar leído/revelar, gateado en dialog), CourseForm (submit nativo), CommandPalette (cmdk) | —                                                                                    |
| `Esc`                                                         | cerrar / cancelar / salir                                                                                                                                                                                                           | siempre                                                                                                             | —                                                                                    |
| `/` (bind: `"slash"`, no `"/"` — la lib matchea por `e.code`) | enfocar buscador                                                                                                                                                                                                                    | Cursos                                                                                                              | —                                                                                    |
| chord `g>`/`h>` + dígito                                      | acción por posición, sin gastar una letra bare: `g>1..9` = ir al curso N del sidebar, `h>1..9` = acción rápida del hábito N de la tira de Hoy                                                                                       | — (siempre chord)                                                                                                   | —                                                                                    |
| Letra a-z con editor desenfocado                              | escribir (type-to-focus)                                                                                                                                                                                                            | Nota y Notebook (sin excepciones, v2)                                                                               | —                                                                                    |
| `mod+,`                                                       | abrir Ajustes                                                                                                                                                                                                                       | —                                                                                                                   | global (convención del SO: es la tecla que todo el mundo prueba primero)             |
| `mod+Alt+B` (bold) · `mod+\` (limpiar formato)                | formato inline del editor. `mod+B` **no** es bold: es el toggle del sidebar (el editor lo suelta, ADR 0019). I/S/code/highlight quedan en los defaults de Tiptap (`mod+I`, `mod+Shift+X`, `mod+E`, `mod+Shift+H`); color sin atajo. | — (no aplica bare)                                                                                                  | editor del lote Notion-UX (ADR 0019)                                                 |
| `mod+`                                                        | señal de "esto es deliberado, corré aunque el foco esté en un editor"                                                                                                                                                               | —                                                                                                                   | Note (`F`, borrar), Course (nav de notas), global (`mod+k`, precedente ya existente) |

**Regla de fondo (v1, ADR 0017 la re-decide):** un atajo de una sola letra bare es inseguro en
cualquier vista donde el foco puede estar sobre contenido editable — colisiona con escribir esa
letra (bug real con `Space` en Repaso y `F` en Nota, ver
`.scratch/keyboard-shortcuts/to-grill-keyboard-shortcuts.md`). La v2 lo resuelve por partición:
en pantalla con editor las letras escriben y todo es `mod+`; en pantalla sin editor bare es
seguro y queda. Las acciones destructivas (borrar) siguen solo con `mod+` en ambos mundos.

## Qué NO hacer

- No construir un component library "para después". shadcn copia lo que necesitás cuando lo
  necesitás.
- No agregar animaciones/transiciones que metan latencia percibida.
- No pantallas nuevas fuera de las 3 (Repaso, Cursos, Nota) sin reabrir el scope. La vista completa
  de hábitos es un **Dialog** justamente por eso: overlay, no 4ta pantalla — mismo criterio que el
  Settings dialog de `CONTEXT.md`.
