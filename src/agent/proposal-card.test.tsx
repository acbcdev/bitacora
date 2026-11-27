import { fireEvent, render, screen } from "@testing-library/react"
import { ProposalCard } from "@/agent/proposal-card"
import { markdownToDoc } from "@/core/lib/tiptap-markdown"
import type { Op } from "@/core/agent/tool"

const edit: Op = {
  entity: "notes",
  label: "Editar nota «A» (id 1a2b)",
  before: { id: "n1", title: "A", content: markdownToDoc("uno") },
  after: { id: "n1", title: "A", content: markdownToDoc("dos") },
}
const create: Op = {
  entity: "notes",
  label: "Crear nota «B»",
  before: null,
  after: { id: "n2", title: "B", content: markdownToDoc("## Plan\n\n- **r** lectura") },
}

const card = (op: Op, onApprove = () => {}) => (
  <ProposalCard
    proposal={{ ops: [op] }}
    status="pending"
    onApprove={onApprove}
    onDiscard={() => {}}
  />
)

test("crear: Markdown renderizado y sin diff ni pestañas", () => {
  render(card(create))
  expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument()
  expect(screen.queryByText(/\*\*r\*\*/)).toBeNull()
  expect(screen.queryByRole("tab")).toBeNull()
})

test("editar: abre en Diff y la pestaña Nota muestra el cuerpo renderizado", async () => {
  render(card({ ...edit, after: { id: "n1", title: "A", content: markdownToDoc("## Valores") } }))
  expect(screen.getByText("-")).toBeInTheDocument()
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Nota" }), { button: 0 })
  expect(await screen.findByRole("heading", { name: "Valores" })).toBeInTheDocument()
})

test("aprueba la Propuesta intacta (solo lectura, sin edición)", () => {
  const onApprove = vi.fn()
  render(card(edit, onApprove))
  fireEvent.click(screen.getByRole("button", { name: /Aprobar/ }))
  expect(onApprove.mock.calls[0][0].ops[0]).toBe(edit)
})

describe("mobile", () => {
  const width = window.innerWidth
  beforeEach(() => {
    window.innerWidth = 375
  })
  afterEach(() => {
    window.innerWidth = width
  })

  test("Aprobar/Descartar sin atajo de teclado", () => {
    const onApprove = vi.fn()
    render(card(edit, onApprove))
    expect(screen.getByRole("button", { name: "Descartar" })).toBeVisible()
    expect(screen.queryByText("⌘↵")).toBeNull()
    fireEvent.keyDown(window, { key: "Enter", metaKey: true })
    expect(onApprove).not.toHaveBeenCalled()
  })
})
