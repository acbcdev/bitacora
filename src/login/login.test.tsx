import { render, screen } from "@testing-library/react"
import { Login } from "@/login/login"

test("renders magic link form", () => {
  render(<Login />)
  expect(screen.getByPlaceholderText("tu@email.com")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /magic link/i })).toBeInTheDocument()
})
