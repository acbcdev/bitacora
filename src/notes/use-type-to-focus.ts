import { useEffect } from "react"
import type { EditorHandle } from "@/core/components/editor"

// Type-to-focus (ADR 0017, regla v2 "las letras escriben, mod+ manda"): en una pantalla con
// editor (Nota standalone, Notebook embebido), un keydown de letra a-z con el editor desenfocado
// enfoca el editor y la letra entra. Sin excepciones — ni F (focus mode queda sólo en ⌘F).
//
// No es un hotkey de react-hotkeys-hook: la lib no matchea "cualquier letra", y acá la letra no
// dispara una acción sino que tiene que SEGUIR su curso (el editor, ya enfocado, recibe el mismo
// evento y la inserta — simular la inserción a mano daría doble letra).
export function useTypeToFocus(editorRef: React.RefObject<EditorHandle | null>) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      onKey(e)
    }

    async function onKey(e: KeyboardEvent) {
      // mod/alt/ctrl tienen su propia tecla asignada (⌘F, ⌘N, ⌘J/K, ⌘K palette): no escribir.
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // Una letra, y sólo una (mayúscula incluida): Enter/Esc/flechas quedan al navegador — no
      // son acciones de app acá.
      if (!/^[a-z]$/i.test(e.key)) return
      const editor = editorRef.current
      if (!editor) return
      // El editor ya tiene foco: la letra escribe sola. Ídem con el título u otro editable
      // enfocado (título de la nota, buscador del índice).
      if (editor.isFocused()) return
      const active = document.activeElement
      if (active instanceof HTMLElement && active.closest("input, textarea, [contenteditable]"))
        return
      // Dialog/confirm abierto: las letras son del diálogo, no de la pantalla de atrás
      // (mismo fallback por data-state que usa useSafeHotkeys para el foco que todavía no entró).
      if (
        document.querySelector(
          '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
        )
      )
        return

      editor.focusEnd()
      // El focus de Tiptap pone el foco DOM dentro de un rAF (delayedFocus): jsdom no corre
      // rAF, así que el foco queda pendiente hasta el próximo tick. Re-disparar en el mismo keydown
      // dejaría doble letra — con esto la letra sale una sola vez y el timing queda igual en
      // browser (rAF corre antes del próximo evento) y en jsdom.
      await new Promise((r) => setTimeout(r, 0))
      // Sin preventDefault: el evento sigue y el editor —ya enfocado— inserta la letra.
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [editorRef])
}
