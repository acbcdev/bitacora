import { act, fireEvent, render, waitFor } from "@testing-library/react"
import { useRef } from "react"
import { Outline } from "@/core/components/outline"

// Mock controlable de IntersectionObserver (el de src/test/setup.ts es no-op): guarda el callback
// para simular "este heading cruzó el borde superior" desde el test.
let intersectionCallback:
  | ((entries: { target: Element; isIntersecting: boolean }[]) => void)
  | null = null
class MockIntersectionObserver {
  constructor(cb: (entries: { target: Element; isIntersecting: boolean }[]) => void) {
    intersectionCallback = cb
  }
  observe() {}
  disconnect() {}
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)

// El Outline solo necesita un host con HTML: no sabe nada de Tiptap (ADR 0007).
function Host({ html }: { html: string }) {
  const host = useRef<HTMLDivElement>(null)
  return (
    <div ref={host}>
      <Outline host={host} version={0} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

const ticks = (c: HTMLElement) => [...c.querySelectorAll<HTMLButtonElement>("[data-outline-tick]")]
const headings = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>("h1, h2, h3")]

const DOC = "<h1>Uno</h1><p>texto</p><h2>Dos</h2><p>texto</p><h3>Tres</h3>"

test("un tick por heading", async () => {
  const { container } = render(<Host html={DOC} />)

  await waitFor(() => expect(ticks(container)).toHaveLength(3))
})

test("con menos de 2 headings no renderiza nada", async () => {
  const { container } = render(<Host html="<h1>Solo uno</h1><p>texto</p>" />)

  // Pasado el debounce del rescaneo: sigue sin haber rail.
  await act(() => new Promise((r) => setTimeout(r, 400)))
  expect(ticks(container)).toHaveLength(0)
})

test("click en un tick scrollea a su heading", async () => {
  const { container } = render(<Host html={DOC} />)
  await waitFor(() => expect(ticks(container)).toHaveLength(3))

  const target = headings(container)[1]
  target.scrollIntoView = vi.fn()
  fireEvent.click(ticks(container)[1])

  expect(target.scrollIntoView).toHaveBeenCalled()
})

test("el activo es el último heading que reportó el IntersectionObserver", async () => {
  const { container } = render(<Host html={DOC} />)
  await waitFor(() => expect(ticks(container)).toHaveLength(3))

  act(() => intersectionCallback?.([{ target: headings(container)[1], isIntersecting: true }]))
  expect(ticks(container)[1]).toHaveAttribute("aria-current", "true")
  expect(ticks(container)[0]).not.toHaveAttribute("aria-current")

  // Sale de la banda de arriba y no entra ninguno: el activo se queda donde estaba.
  act(() => intersectionCallback?.([{ target: headings(container)[1], isIntersecting: false }]))
  expect(ticks(container)[1]).toHaveAttribute("aria-current", "true")
})
