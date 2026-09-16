import { fireEvent, screen, waitFor } from "@testing-library/react"
import { IconPicker } from "@/notebooks/icon-picker"
import { renderApp } from "@/test/harness"

const { upload } = vi.hoisted(() => ({
  upload: vi.fn(() => Promise.resolve("https://cdn/icono.png")),
}))

// uploadNotebookIcon es el único método que IconPicker toca — no necesita snapshot,
// así que el fake sigue siendo un vi.fn puntual. Lo que sí migra al harness es
// el wrapper (antes render() pelado, ahora QueryClient+Router+Tooltip via renderApp).
vi.mock("@/core/store", () => ({ store: { uploadNotebookIcon: upload } }))

beforeEach(() => upload.mockClear())

function open(onChange = vi.fn()) {
  renderApp(<IconPicker icon={null} onChange={onChange} />)
  fireEvent.click(screen.getByLabelText("Icono del notebook"))
  return { onChange, popover: screen.getByRole("dialog") }
}

test("pegar una imagen la sube y la deja elegida", async () => {
  const { onChange, popover } = open()
  const png = new File(["x"], "foto.png", { type: "image/png" })

  fireEvent.paste(popover, { clipboardData: { files: [png] } })

  await waitFor(() => expect(onChange).toHaveBeenCalledWith("https://cdn/icono.png"))
  expect(upload).toHaveBeenCalled()
})

// El guard de tipo corta antes de cualquier await, así que no hay nada que esperar.
test("pegar algo que no es imagen no sube nada", () => {
  const { onChange, popover } = open()
  const pdf = new File(["x"], "apunte.pdf", { type: "application/pdf" })

  fireEvent.paste(popover, { clipboardData: { files: [pdf] } })

  expect(upload).not.toHaveBeenCalled()
  expect(onChange).not.toHaveBeenCalled()
})

test("elegir un preset lo setea y cierra el popover", async () => {
  const { onChange } = open()

  fireEvent.click(screen.getByLabelText("Terminal"))

  expect(onChange).toHaveBeenCalledWith("lucide:Terminal")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
})

test("elegir un emoji lo guarda crudo y cierra el popover", async () => {
  const { onChange } = open()

  // Radix activa la pestaña en mousedown, no en click.
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Emojis" }))
  fireEvent.click(screen.getByLabelText("🚀"))

  expect(onChange).toHaveBeenCalledWith("🚀")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
})

test("el buscador filtra presets por nombre", () => {
  open()

  fireEvent.change(screen.getByLabelText("Buscar icono o emoji"), { target: { value: "term" } })

  expect(screen.getByLabelText("Terminal")).toBeInTheDocument()
  expect(screen.queryByLabelText("Book")).not.toBeInTheDocument()
})

test("el buscador encuentra emojis por su nombre en español", () => {
  open()

  fireEvent.mouseDown(screen.getByRole("tab", { name: "Emojis" }))
  fireEvent.change(screen.getByLabelText("Buscar icono o emoji"), { target: { value: "cohe" } })

  expect(screen.getByLabelText("🚀")).toBeInTheDocument()
  expect(screen.queryByLabelText("🍕")).not.toBeInTheDocument()
})
