import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { FieldPill } from "@/core/ui/field-pill"
import { Drialog, DrialogContent, DrialogTitle } from "@/core/ui/drialog"

const OPTIONS = ["Platzi", "Programación", "Marketing"]

// Fixture con estado: FieldPill es controlado (value/onChange). El tipeo no pasa por onChange
// (la búsqueda es interna): el filtro vive adentro del componente.
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

test("Escape con dropdown abierto lo cierra y descarta la búsqueda; cerrado, el Escape sigue y cierra el modal", () => {
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
  // Sin matches la lista ofrece crear el valor nuevo.
  expect(screen.getByRole("option", { name: "Crear “zzz”" })).toBeInTheDocument()
})

test("Enter sin match confirma la búsqueda y deja que el form submittee", () => {
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
  expect(screen.getByRole("option", { name: "Crear “web.dev”" })).toBeInTheDocument()

  expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(true)
  // El Enter confirma la búsqueda como valor nuevo (única llamada onChange) y no bloquea
  // el submit nativo del browser.
  expect(onChange).toHaveBeenCalledTimes(1)
  expect(onChange).toHaveBeenCalledWith("web.dev")
  expect(input).toHaveValue("web.dev")
  fireEvent.submit(input.closest("form")!)
  expect(onSubmit).toHaveBeenCalledTimes(1)
})

test("el tipeo no pisa el valor confirmado: la búsqueda es interna hasta confirmar", () => {
  const onChange = vi.fn()
  render(<Pill initial="Platzi" onChange={onChange} />)
  const input = screen.getByLabelText("Fuente")

  openCombobox(input)
  // Sin búsqueda activa la lista muestra todas las opciones (el filtro no sale del valor).
  expect(screen.getByRole("option", { name: "Marketing" })).toBeInTheDocument()

  // Tipear arranca una búsqueda: no toca el valor confirmado.
  fireEvent.change(input, { target: { value: "Progra" } })
  expect(input).toHaveValue("Progra")
  expect(onChange).not.toHaveBeenCalled()
  expect(screen.getByRole("option", { name: "Programación" })).toBeInTheDocument()

  fireEvent.keyDown(input, { key: "Enter" })
  expect(onChange).toHaveBeenCalledWith("Programación")
  expect(input).toHaveValue("Programación")
})

test("Escape descarta la búsqueda: el valor confirmado queda y el dropdown se cierra", () => {
  const onChange = vi.fn()
  render(<Pill initial="Platzi" onChange={onChange} />)
  const input = screen.getByLabelText("Fuente")

  openCombobox(input)
  fireEvent.change(input, { target: { value: "Platzzz" } })
  expect(screen.getByRole("option", { name: "Crear “Platzzz”" })).toBeInTheDocument()

  fireEvent.keyDown(input, { key: "Escape" })
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  expect(input).toHaveValue("Platzi")
  expect(onChange).not.toHaveBeenCalled()
})

test("elegir una opción reemplaza el valor", () => {
  const onChange = vi.fn()
  render(<Pill initial="Platzi" onChange={onChange} />)
  const input = screen.getByLabelText("Fuente")

  openCombobox(input)
  fireEvent.click(screen.getByRole("option", { name: "Marketing" }))
  expect(onChange).toHaveBeenCalledWith("Marketing")
  expect(input).toHaveValue("Marketing")
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
})

test("click en 'Crear …' crea el valor nuevo sin pasar por Enter", () => {
  const onChange = vi.fn()
  render(<Pill onChange={onChange} />)
  const input = screen.getByLabelText("Fuente")

  openCombobox(input)
  fireEvent.change(input, { target: { value: "web.dev" } })
  fireEvent.click(screen.getByRole("option", { name: "Crear “web.dev”" }))
  expect(onChange).toHaveBeenCalledWith("web.dev")
  expect(input).toHaveValue("web.dev")
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
})

test("click afuera confirma la búsqueda pendiente (no se pierde lo tipeado)", () => {
  const onChange = vi.fn()
  render(
    <>
      <Pill onChange={onChange} />
      <button type="button">otro</button>
    </>,
  )
  const input = screen.getByLabelText("Fuente")

  openCombobox(input)
  fireEvent.change(input, { target: { value: "web.dev" } })
  fireEvent.mouseDown(screen.getByRole("button", { name: "otro" }))
  expect(onChange).toHaveBeenCalledWith("web.dev")
  expect(input).toHaveValue("web.dev")
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
})

test("mover el highlight con ↓ llama scrollIntoView({ block: 'nearest' })", () => {
  const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView")
  render(<Pill />)
  const input = screen.getByLabelText("Fuente")

  openCombobox(input)
  fireEvent.keyDown(input, { key: "ArrowDown" })
  expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" })
})
