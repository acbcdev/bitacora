import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { IconPicker } from "@/courses/icon-picker"

const { upload } = vi.hoisted(() => ({
  upload: vi.fn(() => Promise.resolve("https://cdn/icono.png")),
}))

// Un método del Store, no el chain de storage de supabase-js: al picker le da igual si la imagen
// termina en un bucket o en una data URL, sólo le importa recibir una URL.
vi.mock("@/core/store", () => ({ store: { uploadCourseIcon: upload } }))

beforeEach(() => upload.mockClear())

function open(onChange = vi.fn()) {
  render(<IconPicker icon={null} onChange={onChange} />)
  fireEvent.click(screen.getByLabelText("Icono del curso"))
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
