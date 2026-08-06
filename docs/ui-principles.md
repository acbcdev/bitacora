# UI Principles — pulpo

No hay design system formal (ver ADR 0005). Estas son las reglas que hacen que la app se sienta
como se tiene que sentir. El felt-need del usuario es **"rápido, teclado, no-Notion"** — eso es
interacción, no decoración.

## Las reglas

1. **Keyboard-first.** Cada acción frecuente tiene un shortcut. El mouse es opcional, no el camino
   principal. La pantalla de Repaso se maneja entera con `Enter` / `J` / `K` sin tocar el mouse.
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

| Tecla | Significa | Dónde aplica bare | Dónde necesita `mod+` |
|---|---|---|---|
| `J`/`K` (+ `Left`/`Right` alias) | anterior/siguiente en una secuencia plana | listas sin contenido editable (Cursos, Repaso) | vistas con editor siempre enfocado (Course: nav de notas) |
| `N` | crear | siempre (no hay contenido editable en el punto donde se dispara) | — |
| `E` | editar | Cursos (fila seleccionada) | — |
| `Delete`/`Backspace` | borrar (siempre con confirmación) | Cursos (fila seleccionada, sin editable) | Nota (contenido editable siempre enfocado) |
| `Enter` | confirmar / abrir la acción principal | Cursos (abrir), Repaso (marcar leído/revelar, gateado en dialog), CourseForm (submit nativo), CommandPalette (cmdk) | — |
| `Esc` | cerrar / cancelar / salir | siempre | — |
| `/` (bind: `"slash"`, no `"/"` — la lib matchea por `e.code`) | enfocar buscador | Cursos | — |
| `mod+` | señal de "esto es deliberado, corré aunque el foco esté en un editor" | — | Note (`F`, borrar), Course (nav de notas), global (`mod+k`, precedente ya existente) |

**Regla de fondo:** un atajo de una sola letra bare es inseguro en cualquier vista donde el foco
puede estar sobre contenido editable — colisiona con escribir esa letra (bug real encontrado con
`Space` en Repaso y `F` en Nota, ver `.scratch/keyboard-shortcuts/to-grill-keyboard-shortcuts.md`).
Fix: separar en un par bare (default de la lib, se desactiva solo con foco en editable) + `mod+`
(forzado, para cuando el foco sí está en el editor) — salvo acciones destructivas (borrar), que van
solo con `mod+`, sin alias bare, porque no hay beneficio en que anden fuera del editor.

## Qué NO hacer

- No construir un component library "para después". shadcn copia lo que necesitás cuando lo
  necesitás.
- No agregar animaciones/transiciones que metan latencia percibida.
- No pantallas nuevas fuera de las 3 (Repaso, Cursos, Nota) sin reabrir el scope.
