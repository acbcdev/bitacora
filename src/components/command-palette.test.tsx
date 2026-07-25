import { fireEvent, render, screen } from "@testing-library/react"
import { CommandPalette, type Action } from "@/components/command-palette"

function setup() {
  const ran: string[] = []
  const onClose = vi.fn()
  const actions: Action[] = [
    { group: "Navegar", label: "Ir a Hoy", run: () => ran.push("hoy") },
    { group: "Navegar", label: "Ir a Cursos", run: () => ran.push("cursos") },
    { group: "Notas", label: "Lexer: de texto a tokens", run: () => ran.push("nota") },
  ]
  render(<CommandPalette onClose={onClose} actions={actions} />)
  return { ran, onClose, input: screen.getByPlaceholderText(/Buscar acción/) }
}

test("filtra por label y por grupo", () => {
  const { input } = setup()
  fireEvent.change(input, { target: { value: "cursos" } })
  expect(screen.getByText("Ir a Cursos")).toBeInTheDocument()
  expect(screen.queryByText("Ir a Hoy")).not.toBeInTheDocument()

  // "Notas" no está en ningún label — matchea por grupo.
  fireEvent.change(input, { target: { value: "notas" } })
  expect(screen.getByText("Lexer: de texto a tokens")).toBeInTheDocument()
})

test("flechas + Enter corren la acción seleccionada y cierran", () => {
  const { ran, onClose, input } = setup()
  fireEvent.keyDown(input, { key: "ArrowDown" })
  fireEvent.keyDown(input, { key: "Enter" })
  expect(ran).toEqual(["cursos"])
  expect(onClose).toHaveBeenCalled()
})

test("sin resultados avisa en vez de mostrar una lista vacía", () => {
  const { input } = setup()
  fireEvent.change(input, { target: { value: "zzz" } })
  expect(screen.getByText(/Sin resultados/)).toBeInTheDocument()
})
