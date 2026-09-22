import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { FieldPill } from "@/core/ui/field-pill"
import { Drialog, DrialogContent, DrialogTitle } from "@/core/ui/drialog"

const OPTIONS = ["Platzi", "Programación", "Marketing"]

// Fixture con estado: FieldPill es controlado (value/onChange), así que el tipeo del test
// tiene que pasar por un setValue real para que el filtro y el chip funcionen. Ojo: el input
// del estado vacío y el del chip son elementos DOM distintos — re-query tras cada cambio.
function Pill({
  initial = "",
  onChange = vi.fn(),
  ...props
}: Partial<React.ComponentProps<typeof FieldPill>> & { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <FieldPill
      id="test-pill"
      value={value}
      onChange={(v) => {
        onChange(v)
        setValue(v)
      }}
      options={OPTIONS}
      placeholder="Fuente"
      icon={<span aria-hidden>🌐</span>}
      {...props}
    />
  )
}

// FieldPill (custom) abre el dropdown al enfocar el input: con focus basta.
function openCombobox(input: HTMLElement) {
  fireEvent.focus(input)
}

function DrialogFixture() {
  const [open, setOpen] = useState(true)
  return (
    <Drialog open={open} onOpenChange={setOpen}>
      <DrialogContent>
        <DrialogTitle>Editar notebook</DrialogTitle>
        <Pill />
      </DrialogContent>
    </Drialog>
  )
}

// fireEvent devuelve false cuando alguien llamó preventDefault (dispatchEvent del nativo).
test("↓/↑ mueven el highlight (aria-activedescendant) y Enter selecciona", () => {
  const onChange = vi.fn()
  render(<Pill onChange={onChange} />)
  const input = screen.getByLabelText("Fuente")

  openCombobox(input)
  // Al abrir el highlight arranca en la primera opción.
  expect(input).toHaveAttribute("aria-activedescendant", "test-pill-option-0")
  fireEvent.keyDown(input, { key: "ArrowDown" })
  expect(input).toHaveAttribute("aria-activedescendant", "test-pill-option-1")
  fireEvent.keyDown(input, { key: "ArrowUp" })
  expect(input).toHaveAttribute("aria-activedescendant", "test-pill-option-0")

  fireEvent.keyDown(input, { key: "Enter" })
  expect(onChange).toHaveBeenCalledWith("Platzi")
  // preventDefault: Enter sobre una opción no submittea el form (reabrir y repetir).
  openCombobox(input)
  expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false)
})

test("Escape con dropdown abierto lo cierra con stopPropagation; cerrado, el Escape sigue y cierra el modal", () => {
  render(<DrialogFixture />)
  const input = screen.getByLabelText("Fuente")

  openCombobox(input)
  expect(screen.getByRole("listbox")).toBeInTheDocument()
  // preventDefault (Radix respeta defaultPrevented): el modal queda montado.
  expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(false)
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  expect(screen.getByText("Editar notebook")).toBeInTheDocument()

  // Cerrado el dropdown, el Escape ya no se toca: llega al Dialog y lo cierra (Radix hace
  // su propio preventDefault al cerrar, así que acá no se afirma el return de fireEvent).
  fireEvent.keyDown(input, { key: "Escape" })
  expect(screen.queryByText("Editar notebook")).not.toBeInTheDocument()
})

test("filtro case-insensitive; 'Sin resultados' cuando no matchea", () => {
  render(<Pill />)
  const input = screen.getByLabelText("Fuente")

  openCombobox(input)
  fireEvent.change(input, { target: { value: "pLaTzI" } })
  expect(screen.getByRole("option", { name: "Platzi" })).toBeInTheDocument()
  expect(screen.queryByRole("option", { name: "Marketing" })).not.toBeInTheDocument()

  fireEvent.change(input, { target: { value: "zzz" } })
  expect(screen.getByText("Sin resultados")).toBeInTheDocument()
})

test("Enter sin match no preventDefault (el browser submittea el form) y el valor queda", () => {
  const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
  const onChange = vi.fn()
  render(
    // jsdom no dispara el submit implícito de Enter: se afirma sobre defaultPrevented
    // (el seam real) y se simula el submit del browser con fireEvent.submit.
    <form onSubmit={onSubmit}>
      <Pill onChange={onChange} />
    </form>,
  )
  const input = screen.getByLabelText("Fuente")

  openCombobox(input)
  fireEvent.change(input, { target: { value: "web.dev" } })
  expect(screen.getByText("Sin resultados")).toBeInTheDocument()

  expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(true)
  // El valor tipeado queda: onChange solo lo llamó el tipeo, no el Enter.
  expect(onChange).toHaveBeenCalledTimes(1)
  expect(onChange).toHaveBeenCalledWith("web.dev")
  fireEvent.submit(input.closest("form")!)
  expect(onSubmit).toHaveBeenCalledTimes(1)
})

test("elegir una opción reemplaza el valor; × del chip lo vacía", () => {
  const onChange = vi.fn()
  render(<Pill initial="Platzi" onChange={onChange} />)

  // El chip reemplaza al valor: elegir otro arranca una búsqueda nueva (× o tipeo).
  const input = screen.getByLabelText("Fuente")
  openCombobox(input)
  fireEvent.click(screen.getByRole("button", { name: "Vaciar fuente" }))
  expect(onChange).toHaveBeenCalledWith("")
  expect(input).toHaveValue("")
  // El × deja el dropdown abierto y el foco en el input, listo para elegir/crear otro.
  expect(screen.getByRole("listbox")).toBeInTheDocument()
  expect(input).toHaveFocus()

  fireEvent.click(screen.getByRole("option", { name: "Marketing" }))
  expect(onChange).toHaveBeenCalledWith("Marketing")
  expect(input).toHaveValue("Marketing")
})

test("mover el highlight con ↓ llama scrollIntoView({ block: 'nearest' })", () => {
  const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView")
  render(<Pill />)
  const input = screen.getByLabelText("Fuente")

  openCombobox(input)
  fireEvent.keyDown(input, { key: "ArrowDown" })
  expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" })
})
