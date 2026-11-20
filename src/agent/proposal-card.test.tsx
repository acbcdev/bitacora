import { fireEvent, render, screen } from "@testing-library/react"
import { ProposalCard } from "@/agent/proposal-card"
import { docToMarkdown, markdownToDoc } from "@/core/lib/tiptap-markdown"
import type { Op } from "@/core/agent/tool"

const op: Op = {
  entity: "notes",
  label: "Editar nota «A» (id 1a2b)",
  before: { id: "n1", content: markdownToDoc("uno") },
  after: { id: "n1", content: markdownToDoc("dos") },
}

test("aprobar con cuerpo editado manda la Propuesta con el Markdown del usuario", () => {
  const onApprove = vi.fn()
  render(
    <ProposalCard
      proposal={{ ops: [op] }}
      status="pending"
      onApprove={onApprove}
      onDiscard={() => {}}
    />,
  )
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Cambios" }), { button: 0 })
  const box = screen.getByRole("textbox")
  expect(box).toHaveValue("dos")
  fireEvent.change(box, { target: { value: "dos, mejorado" } })
  fireEvent.click(screen.getByRole("button", { name: /Aprobar/ }))

  const sent = onApprove.mock.calls[0][0].ops[0]
  expect(docToMarkdown(sent.after.content)).toBe("dos, mejorado")
  expect(sent.before).toBe(op.before)
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
