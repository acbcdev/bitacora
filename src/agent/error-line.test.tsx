import { fireEvent, render, screen } from "@testing-library/react"
import { ErrorLine, describeError } from "@/agent/error-line"

test("describeError traduce lo conocido y cae en el genérico", () => {
  expect(describeError('401 {"error":"invalid x-api-key"}')).toMatch(/key/)
  expect(describeError("429 rate limit")).toMatch(/limitando/)
  expect(describeError("TypeError: Failed to fetch")).toMatch(/conectar/)
  expect(describeError("algo raro")).toBe("El Proveedor devolvió un error.")
})

test("acción y detalle crudo a un click", () => {
  const onAction = vi.fn()
  render(<ErrorLine title="Falló" detail="crudo 401" action="Reintentar" onAction={onAction} />)
  expect(screen.queryByText("crudo 401")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Detalle" }))
  expect(screen.getByText("crudo 401")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
  expect(onAction).toHaveBeenCalled()
})
