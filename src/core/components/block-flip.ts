import { Extension } from "@tiptap/react"
import { Plugin } from "@tiptap/pm/state"

// FLIP al soltar un bloque: ProseMirror reemplaza el doc y los hermanos saltan a su nuevo
// lugar. Foto de los bloques top-level antes del drop; tras el update, los que siguen vivos
// (hermanos que se corren) se deslizan desde su top viejo, y los recreados (el bloque movido)
// parten del top de los DOM descartados, emparejados en orden. Solo `transform` (compositor).
// ponytail: solo bloques top-level; items anidados de listas siguen saltando.
const MS = 180

export const BlockFlip = Extension.create({
  name: "blockFlip",
  addProseMirrorPlugins() {
    let before: Map<Element, number> | null = null
    const slide = (el: Element, from: number) => {
      const dy = from - el.getBoundingClientRect().top
      if (Math.abs(dy) < 1) return
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], {
        duration: MS,
        easing: "ease-out",
      })
    }
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            drop: (view) => {
              if (typeof Element.prototype.animate !== "function") return false
              if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false
              before = new Map(
                Array.from(view.dom.children, (el) => [el, el.getBoundingClientRect().top]),
              )
              return false // PM sigue con su drop normal
            },
          },
        },
        view: (view) => ({
          update: () => {
            if (!before) return
            const snap = before
            before = null
            const now = new Set(Array.from(view.dom.children))
            const gone = [...snap].filter(([el]) => !now.has(el)).map(([, top]) => top)
            let i = 0
            for (const el of now) {
              const from = snap.get(el) ?? gone[i++]
              if (from !== undefined) slide(el, from)
            }
          },
        }),
      }),
    ]
  },
})
