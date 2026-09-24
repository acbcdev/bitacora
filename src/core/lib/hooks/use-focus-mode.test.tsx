import { act, render } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { focusHref, useFocusMode } from "@/core/lib/hooks/use-focus-mode"

// El seam de focus mode (review de arquitectura 2026-09-23): una sola fuente de verdad. El hook
// dueño de state, URL (?focus=1) y Fullscreen; las pantallas cruzan la misma interface.

let exitFullscreen: ReturnType<typeof vi.fn>
beforeEach(() => {
  // jsdom no tiene Fullscreen API.
  exitFullscreen = vi.fn()
  Object.defineProperty(document, "fullscreenElement", {
    get: () => null,
    configurable: true,
  })
  document.exitFullscreen = exitFullscreen as unknown as typeof document.exitFullscreen
  document.documentElement.requestFullscreen = vi
    .fn()
    .mockRejectedValue(
      new Error("sin gesto"),
    ) as unknown as typeof document.documentElement.requestFullscreen
  history.replaceState(null, "", "/note/n1")
})
afterEach(() => {
  document.dispatchEvent(new Event("fullscreenchange"))
})

function Probe() {
  const { focus, enter, exit } = useFocusMode()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  return (
    <>
      <button onClick={() => (focus ? exit() : enter())} aria-label="toggle">
        {`${focus}|${pathname}${search}`}
      </button>
      {/* Navegar de verdad vía router (MemoryRouter no mira window.history). */}
      <button onClick={() => navigate("/notebooks")} aria-label="nav" />
    </>
  )
}

function renderAt(route = "/note/n1") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
}

const label = (c: ReturnType<typeof renderAt>) =>
  c.getByRole("button", { name: "toggle" }).textContent!

test("enter() prende el state y escribe ?focus=1 en la URL", () => {
  const c = renderAt("/note/n1")
  expect(label(c)).toBe("false|/note/n1")
  act(() => c.getByRole("button", { name: "toggle" }).click())
  expect(label(c)).toBe("true|/note/n1?focus=1")
})

test("?focus=1 en la URL inicial arranca en focus", () => {
  const c = renderAt("/notebook/c1/n2?focus=1")
  expect(label(c)).toBe("true|/notebook/c1/n2?focus=1")
})

test("cambiar de ruta sin ?focus=1 apaga el focus (navegar sale del modo)", () => {
  const c = renderAt("/note/n1?focus=1")
  expect(label(c)).toBe("true|/note/n1?focus=1")

  act(() => c.getByRole("button", { name: "nav" }).click())

  expect(label(c)).toBe("false|/notebooks")
})

test("exit() apaga y limpia el param de la URL", () => {
  const c = renderAt("/note/n1?focus=1")
  act(() => c.getByRole("button", { name: "toggle" }).click())
  expect(label(c)).toBe("false|/note/n1")
})

test("requestFullscreen rechazado (mejor-effort): el state queda en true, sin requestFullscreen cuando el fullscreen real se apaga por fuera", () => {
  const rf = vi.fn().mockRejectedValue(new Error("sin gesto"))
  document.documentElement.requestFullscreen =
    rf as unknown as typeof document.documentElement.requestFullscreen
  const c = renderAt()
  act(() => c.getByRole("button", { name: "toggle" }).click())
  expect(rf).toHaveBeenCalled()
  // El estado vive en el seam; el fullscreen nativo pelado es mejor-effort.
  expect(label(c)).toBe("true|/note/n1?focus=1")
})

test("salir del fullscreen por fuera (Esc del browser) apaga el modo — sólo si fue el hook quien lo entró", () => {
  const c = renderAt()
  act(() => c.getByRole("button", { name: "toggle" }).click())
  // El fullscreen del browser se terminó por fuera (Esc/F11) sin pasar por el hook. El browser
  // dispara el evento sobre document.
  act(() => document.dispatchEvent(new Event("fullscreenchange")))
  expect(label(c)).toBe("false|/note/n1?focus=1")
})

test("fullscreenchange con el fullscreen en true (enter OK) no apaga el estado", () => {
  Object.defineProperty(document, "fullscreenElement", {
    get: () => document.documentElement,
    configurable: true,
  })
  const c = renderAt("/note/n1?focus=1")
  document.dispatchEvent(new Event("fullscreenchange"))
  expect(label(c)).toBe("true|/note/n1?focus=1")
})

test("focusHref construye la URL que el hook lee de vuelta como focus", () => {
  expect(focusHref("/notebook/c1/n2")).toBe("/notebook/c1/n2?focus=1")
  const c = renderAt(focusHref("/notebook/c1/n2"))
  expect(label(c)).toBe("true|/notebook/c1/n2?focus=1")
})
