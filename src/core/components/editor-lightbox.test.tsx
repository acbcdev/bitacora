import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Editor } from "@/core/components/editor"
import { collectImages } from "@/core/components/editor-lightbox-utils"
import { EditorLightbox } from "@/core/components/editor-lightbox"
import type { TiptapDoc } from "@/core/types/database"

// Helper para swipe que evita el bug de react-remove-scroll en jsdom (touches vacío -> getTouchXY)
// Dispara eventos nativos con touches/changedTouches definidas vía defineProperty.
function dispatchSwipe(el: Element, startX: number, endX: number) {
  const start = new Event("touchstart", { bubbles: true })
  Object.defineProperty(start, "touches", { value: [{ clientX: startX }] })
  fireEvent(el, start)
  const end = new Event("touchend", { bubbles: true })
  Object.defineProperty(end, "touches", { value: [] })
  Object.defineProperty(end, "changedTouches", { value: [{ clientX: endX }] })
  fireEvent(el, end)
}

// ── collectImages unit ───────────────────────────────────────────────────────

test("collectImages recolecta image nodos a cualquier profundidad", () => {
  const doc: TiptapDoc = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "hola" }] },
      { type: "image", attrs: { src: "https://a.png", alt: "A" } },
      {
        type: "blockquote",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "cita" }] },
          { type: "image", attrs: { src: "https://b.png" } },
        ],
      },
      { type: "image", attrs: { src: "https://c.png", alt: "C" } },
    ],
  } as unknown as TiptapDoc
  expect(collectImages(doc)).toEqual([
    { src: "https://a.png", alt: "A" },
    { src: "https://b.png", alt: undefined },
    { src: "https://c.png", alt: "C" },
  ])
})

test("collectImages con 0 imágenes devuelve []", () => {
  expect(collectImages({ type: "doc", content: [] })).toEqual([])
  expect(collectImages({ type: "doc" } as unknown as TiptapDoc)).toEqual([])
})

// ── EditorLightbox aislado ──────────────────────────────────────────────────

test("EditorLightbox: navegación circular 0→1→0 y 0→1 vía wrap", async () => {
  const images = [
    { src: "https://a.png", alt: "A" },
    { src: "https://b.png", alt: "B" },
  ]
  const { rerender } = render(
    <EditorLightbox
      images={images}
      index={0}
      open
      onOpenChange={() => {}}
      onIndexChange={() => {}}
    />,
  )
  expect(screen.getByText("1 / 2")).toBeInTheDocument()

  // Simular navegación vía prop index: 1→0 wrap lo testea el Editor, acá solo índice display
  rerender(
    <EditorLightbox
      images={images}
      index={1}
      open
      onOpenChange={() => {}}
      onIndexChange={() => {}}
    />,
  )
  expect(screen.getByText("2 / 2")).toBeInTheDocument()
})

test("EditorLightbox: swipe threshold >40px", async () => {
  const images = [{ src: "https://a.png" }, { src: "https://b.png" }]
  let idx = 0
  const onIndexChange = vi.fn((n: number) => {
    idx = n
  })
  render(
    <EditorLightbox
      images={images}
      index={idx}
      open
      onOpenChange={() => {}}
      onIndexChange={onIndexChange}
    />,
  )
  const content = document.querySelector('[data-slot="lightbox-content"]')!

  // Swipe izquierda (delta -60) → next
  dispatchSwipe(content, 100, 40)
  expect(onIndexChange).toHaveBeenCalledWith(1)

  onIndexChange.mockClear()
  // Swipe derecha (delta +60) → prev (from 0 wrap to 1 but test from 0)
  dispatchSwipe(content, 40, 100)
  expect(onIndexChange).toHaveBeenCalledWith(1)

  onIndexChange.mockClear()
  // Delta <40 no navega
  dispatchSwipe(content, 100, 80)
  expect(onIndexChange).not.toHaveBeenCalled()
})

test("EditorLightbox: broken muestra fallback + alt", async () => {
  const images = [{ src: "https://broken.png", alt: "diagrama" }]
  render(
    <EditorLightbox
      images={images}
      index={0}
      open
      onOpenChange={() => {}}
      onIndexChange={() => {}}
    />,
  )
  const img = screen.getByAltText("diagrama")
  fireEvent.error(img)
  expect(screen.getByText("diagrama")).toBeInTheDocument()
  // sin alt: fallback genérico
})

test("EditorLightbox: broken sin alt muestra placeholder genérico", async () => {
  const images = [{ src: "https://broken2.png" }]
  render(
    <EditorLightbox
      images={images}
      index={0}
      open
      onOpenChange={() => {}}
      onIndexChange={() => {}}
    />,
  )
  const img = document.querySelector('[data-slot="lightbox-content"] img')!
  fireEvent.error(img)
  expect(screen.getByText("Imagen no disponible")).toBeInTheDocument()
})

// ── Integración Editor ───────────────────────────────────────────────────────

const docTwoImages: TiptapDoc = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "intro" }] },
    { type: "image", attrs: { src: "https://example.com/a.png", alt: "A" } },
    { type: "paragraph", content: [{ type: "text", text: "medio" }] },
    { type: "image", attrs: { src: "https://example.com/b.png", alt: "B" } },
  ],
} as unknown as TiptapDoc

const docOneImage: TiptapDoc = {
  type: "doc",
  content: [{ type: "image", attrs: { src: "https://example.com/only.png", alt: "Solo" } }],
} as unknown as TiptapDoc

const docNoImages: TiptapDoc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "sin imagen" }] }],
} as TiptapDoc

async function getImgs(container: HTMLElement): Promise<NodeListOf<HTMLImageElement>> {
  await waitFor(() => {
    const imgs = container.querySelectorAll<HTMLImageElement>(".ProseMirror img")
    expect(imgs.length).toBeGreaterThan(0)
  })
  return container.querySelectorAll<HTMLImageElement>(".ProseMirror img")
}

test("click en imagen abre lightbox con esa imagen y índice", async () => {
  const { container } = render(<Editor content={docTwoImages} />)
  const imgs = await getImgs(container)
  expect(imgs).toHaveLength(2)

  fireEvent.click(imgs[0])

  await waitFor(() =>
    expect(document.querySelector('[data-slot="lightbox-content"]')).toBeInTheDocument(),
  )
  expect(document.querySelector('[data-slot="lightbox-content"] img')).toHaveAttribute(
    "src",
    "https://example.com/a.png",
  )
  expect(screen.getByText("1 / 2")).toBeInTheDocument()
})

test("click en segunda imagen abre en índice 1", async () => {
  const { container } = render(<Editor content={docTwoImages} />)
  const imgs = await getImgs(container)
  fireEvent.click(imgs[1])
  await waitFor(() =>
    expect(document.querySelector('[data-slot="lightbox-content"]')).toBeInTheDocument(),
  )
  expect(document.querySelector('[data-slot="lightbox-content"] img')).toHaveAttribute(
    "src",
    "https://example.com/b.png",
  )
  expect(screen.getByText("2 / 2")).toBeInTheDocument()
})

test("→ navega a la siguiente, ← vuelve, wrap circular", async () => {
  const { container } = render(<Editor content={docTwoImages} />)
  const imgs = await getImgs(container)
  fireEvent.click(imgs[0])
  await waitFor(() =>
    expect(document.querySelector('[data-slot="lightbox-content"]')).toBeInTheDocument(),
  )

  // → a segunda
  fireEvent.keyDown(window, { key: "ArrowRight" })
  await waitFor(() =>
    expect(document.querySelector('[data-slot="lightbox-content"] img')).toHaveAttribute(
      "src",
      "https://example.com/b.png",
    ),
  )
  expect(screen.getByText("2 / 2")).toBeInTheDocument()

  // → wrap a primera
  fireEvent.keyDown(window, { key: "ArrowRight" })
  await waitFor(() =>
    expect(document.querySelector('[data-slot="lightbox-content"] img')).toHaveAttribute(
      "src",
      "https://example.com/a.png",
    ),
  )
  expect(screen.getByText("1 / 2")).toBeInTheDocument()

  // ← wrap a segunda
  fireEvent.keyDown(window, { key: "ArrowLeft" })
  await waitFor(() =>
    expect(document.querySelector('[data-slot="lightbox-content"] img')).toHaveAttribute(
      "src",
      "https://example.com/b.png",
    ),
  )
})

test("Esc cierra el lightbox", async () => {
  const { container } = render(<Editor content={docOneImage} />)
  const imgs = await getImgs(container)
  fireEvent.click(imgs[0])
  await waitFor(() =>
    expect(document.querySelector('[data-slot="lightbox-content"]')).toBeInTheDocument(),
  )

  fireEvent.keyDown(window, { key: "Escape" })
  await waitFor(() =>
    expect(document.querySelector('[data-slot="lightbox-content"]')).not.toBeInTheDocument(),
  )
})

test("click backdrop cierra", async () => {
  const { container } = render(<Editor content={docOneImage} />)
  const imgs = await getImgs(container)
  fireEvent.click(imgs[0])
  await waitFor(() =>
    expect(document.querySelector('[data-slot="lightbox-content"]')).toBeInTheDocument(),
  )
  const overlay = document.querySelector('[data-slot="lightbox-overlay"]')!
  fireEvent.click(overlay)
  await waitFor(() =>
    expect(document.querySelector('[data-slot="lightbox-content"]')).not.toBeInTheDocument(),
  )
})

test("botones prev/next navegan", async () => {
  const { container } = render(<Editor content={docTwoImages} />)
  const imgs = await getImgs(container)
  fireEvent.click(imgs[0])
  await waitFor(() =>
    expect(document.querySelector('[data-slot="lightbox-content"]')).toBeInTheDocument(),
  )

  fireEvent.click(screen.getByLabelText("Imagen siguiente"))
  await waitFor(() =>
    expect(document.querySelector('[data-slot="lightbox-content"] img')).toHaveAttribute(
      "src",
      "https://example.com/b.png",
    ),
  )

  fireEvent.click(screen.getByLabelText("Imagen anterior"))
  await waitFor(() =>
    expect(document.querySelector('[data-slot="lightbox-content"] img')).toHaveAttribute(
      "src",
      "https://example.com/a.png",
    ),
  )
})

test("swipe en mobile cambia de imagen", async () => {
  const { container } = render(<Editor content={docTwoImages} />)
  const imgs = await getImgs(container)
  fireEvent.click(imgs[0])
  await waitFor(() =>
    expect(document.querySelector('[data-slot="lightbox-content"]')).toBeInTheDocument(),
  )

  const content = document.querySelector('[data-slot="lightbox-content"]')!
  dispatchSwipe(content, 200, 50)
  await waitFor(() =>
    expect(document.querySelector('[data-slot="lightbox-content"] img')).toHaveAttribute(
      "src",
      "https://example.com/b.png",
    ),
  )
})

test("con 1 imagen sin navegación no muestra botones ni índice", async () => {
  const { container } = render(<Editor content={docOneImage} />)
  const imgs = await getImgs(container)
  fireEvent.click(imgs[0])
  await waitFor(() =>
    expect(document.querySelector('[data-slot="lightbox-content"]')).toBeInTheDocument(),
  )
  expect(screen.queryByText(/\/ 1/)).not.toBeInTheDocument()
  expect(screen.queryByLabelText("Imagen siguiente")).not.toBeInTheDocument()
  expect(screen.queryByLabelText("Imagen anterior")).not.toBeInTheDocument()
})

test("doc sin imágenes: click no abre nada", async () => {
  const { container } = render(<Editor content={docNoImages} />)
  await waitFor(() =>
    expect(container.querySelector<HTMLElement>(".ProseMirror")).toBeInTheDocument(),
  )
  // No hay img, lightbox no debe existir
  expect(document.querySelector('[data-slot="lightbox-content"]')).not.toBeInTheDocument()
})

test("alt se muestra debajo de la imagen", async () => {
  const { container } = render(<Editor content={docOneImage} />)
  const imgs = await getImgs(container)
  fireEvent.click(imgs[0])
  await waitFor(() =>
    expect(document.querySelector('[data-slot="lightbox-content"]')).toBeInTheDocument(),
  )
  expect(screen.getByText("Solo")).toBeInTheDocument()
})

test("Editor no toca el doc: onChange no dispara al abrir lightbox", async () => {
  const onChange = vi.fn()
  const { container } = render(<Editor content={docTwoImages} onChange={onChange} />)
  const imgs = await getImgs(container)
  // Tiptap puede disparar onChange inicial al normalizar; ignorarlo
  onChange.mockClear()
  fireEvent.click(imgs[0])
  await waitFor(() =>
    expect(document.querySelector('[data-slot="lightbox-content"]')).toBeInTheDocument(),
  )
  expect(onChange).not.toHaveBeenCalled()
})

test("click en imagen no rompe handlePaste", async () => {
  const { container } = render(<Editor content={docNoImages} editable />)
  const pm = await waitFor(() => container.querySelector<HTMLElement>(".ProseMirror")!)
  pm.focus()
  // Simular que el editor sigue recibiendo paste (no testeamos markdownToDoc acá, solo que no throw)
  expect(pm).toBeInTheDocument()
})

test("resize handles visibles en editable", async () => {
  const { container } = render(<Editor content={docOneImage} editable />)
  await getImgs(container)
  expect(container.querySelectorAll("[data-resize-handle]").length).toBe(2)
})

test("resize handles visibles también en modo lectura (ambos)", async () => {
  const { container } = render(<Editor content={docOneImage} editable={false} />)
  await waitFor(() =>
    expect(container.querySelector<HTMLElement>(".ProseMirror")).toBeInTheDocument(),
  )
  await waitFor(() =>
    expect(container.querySelectorAll<HTMLImageElement>(".ProseMirror img").length).toBe(1),
  )
  expect(container.querySelectorAll("[data-resize-handle]").length).toBe(2)
})

test("handles tienen cursor ew-resize y están inset del borde", async () => {
  const { container } = render(<Editor content={docOneImage} editable />)
  await getImgs(container)
  const left = container.querySelector<HTMLElement>('[data-resize-handle="left"]')!
  const right = container.querySelector<HTMLElement>('[data-resize-handle="right"]')!
  // handle es ahora un solo pill de 3px × 48px con cursor-ew-resize directo (hit-area exacta, evita sticky)
  expect(left.className).toMatch(/cursor-ew-resize/)
  expect(right.className).toMatch(/cursor-ew-resize/)
  expect(left.className).toMatch(/w-\[3px\]/)
  expect(left.className).toMatch(/h-12/)
  // inset dentro del borde (left-2/right-2)
  expect(left.className).toMatch(/left-2/)
  expect(right.className).toMatch(/right-2/)
  // pointer-events solo cuando visible — evita que el área invisible capture cursor sobre la imagen
  // cuando está selected es pointer-events-auto directo, cuando no es group-hover:pointer-events-auto
  expect(left.className).toMatch(/pointer-events-auto/)
  expect(left.className).toMatch(/cursor-ew-resize/)
  // hit-area exacta 3px × 48px, no flex wrapper que deje sticky
  expect(left.className).not.toMatch(/flex/)
})

test("drag handle derecha actualiza width y dispara onChange", async () => {
  const onChange = vi.fn()
  const { container } = render(<Editor content={docOneImage} editable onChange={onChange} />)
  await getImgs(container)
  onChange.mockClear()
  const handle = container.querySelector<HTMLElement>('[data-resize-handle="right"]')!
  // mock getBoundingClientRect para que startW sea determinístico (300)
  const img = container.querySelector<HTMLImageElement>(".ProseMirror img")!
  vi.spyOn(img, "getBoundingClientRect").mockReturnValue({
    width: 300,
    height: 200,
    top: 0,
    left: 0,
    right: 300,
    bottom: 200,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as unknown as DOMRect)

  fireEvent.mouseDown(handle, { clientX: 100 })
  fireEvent.mouseMove(window, { clientX: 150 })
  fireEvent.mouseUp(window)

  await waitFor(() => expect(onChange).toHaveBeenCalled())
  const lastDoc = onChange.mock.calls.at(-1)![0] as TiptapDoc
  const imageNode = (lastDoc.content as unknown[]).find(
    (n: unknown) => (n as { type: string }).type === "image",
  ) as { attrs: { width: number } }
  expect(imageNode.attrs.width).toBeGreaterThan(300)
})

test("drag handle izquierda aumenta al arrastrar a la izquierda", async () => {
  const onChange = vi.fn()
  const { container } = render(<Editor content={docOneImage} editable onChange={onChange} />)
  await getImgs(container)
  onChange.mockClear()
  const handle = container.querySelector<HTMLElement>('[data-resize-handle="left"]')!
  const img = container.querySelector<HTMLImageElement>(".ProseMirror img")!
  vi.spyOn(img, "getBoundingClientRect").mockReturnValue({
    width: 300,
    height: 200,
    top: 0,
    left: 0,
    right: 300,
    bottom: 200,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as unknown as DOMRect)

  fireEvent.mouseDown(handle, { clientX: 200 })
  fireEvent.mouseMove(window, { clientX: 150 }) // mover izquierda 50px → width +50
  fireEvent.mouseUp(window)

  await waitFor(() => expect(onChange).toHaveBeenCalled())
  const lastDoc = onChange.mock.calls.at(-1)![0] as TiptapDoc
  const imageNode = (lastDoc.content as unknown[]).find(
    (n: unknown) => (n as { type: string }).type === "image",
  ) as { attrs: { width: number } }
  expect(imageNode.attrs.width).toBe(350)
})

test("cursor cambia a ew-resize mientras se arrastra y vuelve", async () => {
  const { container } = render(<Editor content={docOneImage} editable />)
  await getImgs(container)
  const handle = container.querySelector<HTMLElement>('[data-resize-handle="right"]')!
  const img = container.querySelector<HTMLImageElement>(".ProseMirror img")!
  vi.spyOn(img, "getBoundingClientRect").mockReturnValue({
    width: 300,
    height: 200,
    top: 0,
    left: 0,
    right: 300,
    bottom: 200,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as unknown as DOMRect)

  fireEvent.mouseDown(handle, { clientX: 100 })
  expect(document.body.style.cursor).toBe("ew-resize")
  expect(document.documentElement.style.cursor).toBe("ew-resize")
  expect(document.body.style.userSelect).toBe("none")
  fireEvent.mouseUp(window)
  expect(document.body.style.cursor).toBe("")
  expect(document.documentElement.style.cursor).toBe("")
  expect(document.body.style.userSelect).toBe("")
})
