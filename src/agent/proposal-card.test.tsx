import { fireEvent, render, screen } from "@testing-library/react"
import { ProposalCard } from "@/agent/proposal-card"
import { markdownToDoc } from "@/core/lib/tiptap-markdown"
import type { Op } from "@/core/agent/tool"

const op: Op = {
  entity: "notes",
  label: "Editar nota «A» (id 1a2b)",
  before: { id: "n1", content: markdownToDoc("uno") },
  after: { id: "n1", content: markdownToDoc("dos") },
}

test("Cambios muestra el cuerpo renderizado, no Markdown crudo", async () => {
  const heading: Op = {
    ...op,
    after: { id: "n1", content: markdownToDoc("## Valores\n\n- **r** lectura") },
  }
  render(
    <ProposalCard
      proposal={{ ops: [heading] }}
      status="pending"
      onApprove={() => {}}
      onDiscard={() => {}}
    />,
  )
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Cambios" }), { button: 0 })
  expect(await screen.findByRole("heading", { name: "Valores" })).toBeInTheDocument()
  expect(screen.queryByText(/\*\*r\*\*/)).toBeNull()
})

test("sin tocar la pestaña Cambios, aprueba la Propuesta intacta", () => {
  const onApprove = vi.fn()
  render(
    <ProposalCard
      proposal={{ ops: [op] }}
      status="pending"
      onApprove={onApprove}
      onDiscard={() => {}}
    />,
  )
  fireEvent.click(screen.getByRole("button", { name: /Aprobar/ }))
  expect(onApprove.mock.calls[0][0].ops[0]).toBe(op)
})

describe("mobile", () => {
  const width = window.innerWidth
  beforeEach(() => {
    window.innerWidth = 375
  })
  afterEach(() => {
    window.innerWidth = width
  })

  test("card resumen: Aprobar/Descartar sin atajo; la operación abre Diff | Cambios", async () => {
    const onApprove = vi.fn()
    render(
      <ProposalCard
        proposal={{ ops: [op] }}
        status="pending"
        onApprove={onApprove}
        onDiscard={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: "Descartar" })).toBeVisible()
    expect(screen.queryByText("⌘↵")).toBeNull()
    fireEvent.keyDown(window, { key: "Enter", metaKey: true })
    expect(onApprove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: /Editar nota/ }))
    expect(await screen.findByRole("tab", { name: "Diff" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Cambios" })).toBeInTheDocument()
  })
})
