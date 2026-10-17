import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Login } from "@/login/login"
import { store } from "@/core/store"

vi.mock("@/core/store", () => ({
  store: { auth: { signIn: vi.fn(async () => {}), verify: vi.fn(async () => {}) } },
}))

test("pide el mail, después canjea el código", async () => {
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  )
  fireEvent.change(screen.getByPlaceholderText("tu@email.com"), { target: { value: "a@b.co" } })
  fireEvent.click(screen.getByRole("button", { name: /enviar código/i }))
  expect(store.auth.signIn).toHaveBeenCalledWith("a@b.co")

  fireEvent.change(await screen.findByPlaceholderText("Código"), { target: { value: "1234a5678" } })
  fireEvent.click(screen.getByRole("button", { name: /entrar/i }))
  expect(store.auth.verify).toHaveBeenCalledWith("a@b.co", "12345678")
})

test("recargar en el paso del código lo mantiene", () => {
  render(
    <MemoryRouter initialEntries={["/?code=a%40b.co"]}>
      <Login />
    </MemoryRouter>,
  )
  expect(screen.getByPlaceholderText("Código")).toBeInTheDocument()
  expect(screen.getByText(/a@b\.co/)).toBeInTheDocument()
})
