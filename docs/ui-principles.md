# UI Principles — pulpo

No hay design system formal (ver ADR 0005). Estas son las reglas que hacen que la app se sienta
como se tiene que sentir. El felt-need del usuario es **"rápido, teclado, no-Notion"** — eso es
interacción, no decoración.

## Las reglas

1. **Keyboard-first.** Cada acción frecuente tiene un shortcut. El mouse es opcional, no el camino
   principal. La pantalla de Repaso se maneja entera con `Space` / `J` / `K` sin tocar el mouse.
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

## Qué NO hacer

- No construir un component library "para después". shadcn copia lo que necesitás cuando lo
  necesitás.
- No agregar animaciones/transiciones que metan latencia percibida.
- No pantallas nuevas fuera de las 3 (Repaso, Cursos, Nota) sin reabrir el scope.
