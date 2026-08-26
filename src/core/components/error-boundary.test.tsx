import { fireEvent, render, screen } from "@testing-library/react"
import { ErrorBoundary } from "@/core/components/error-boundary"

function Bomb({ explode = false }: { explode?: boolean }) {
  if (explode) throw new Error("boom")
  return <div>ok</div>
}

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}))
afterEach(() => vi.restoreAllMocks())

test("muestra fallback por defecto cuando un hijo explota", () => {
  render(
    <ErrorBoundary>
      <Bomb explode />
    </ErrorBoundary>,
  )
  expect(screen.getByRole("alert")).toBeInTheDocument()
  expect(screen.getByText("Algo salió mal")).toBeInTheDocument()
  expect(screen.getByText("boom")).toBeInTheDocument()
})

test("Reintentar resetea el boundary y vuelve a renderizar hijos sanos", async () => {
  let explode = true
  function Wrapper() {
    return (
      <ErrorBoundary>
        <Bomb explode={explode} />
      </ErrorBoundary>
    )
  }
  const { rerender } = render(<Wrapper />)
  expect(screen.getByRole("alert")).toBeInTheDocument()

  explode = false
  // Cambiar el prop ANTES del reset para que el re-render post-reset no vuelva a explotar
  rerender(<Wrapper />)
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
  expect(await screen.findByText("ok")).toBeInTheDocument()
})

test("fallback custom como función recibe error y reset", () => {
  render(
    <ErrorBoundary
      fallback={({ error, reset }) => (
        <div>
          custom: {error.message} <button onClick={reset}>reset custom</button>
        </div>
      )}
    >
      <Bomb explode />
    </ErrorBoundary>,
  )
  expect(screen.getByText(/custom: boom/)).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "reset custom" })).toBeInTheDocument()
})
