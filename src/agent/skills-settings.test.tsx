import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SkillsSettings } from "@/agent/skills-settings"
import { BUILTIN_SKILLS } from "@/core/agent/skills"
import type { SkillRow } from "@/core/types/database"

const { rows, save } = vi.hoisted(() => ({
  rows: [] as SkillRow[],
  save: vi.fn(),
}))

// Store en memoria con el contrato real: `save` sin id crea, con id edita, nombre repetido tira.
vi.mock("@/core/store", () => ({
  store: {
    skills: {
      list: async () => [...rows],
      save: async ({ id, ...v }: { id?: string; name: string }) => {
        save({ id, ...v })
        if (rows.some((r) => r.name === v.name && r.id !== id))
          throw new Error("Ya existe un skill con ese nombre")
        if (id)
          rows.splice(
            rows.findIndex((r) => r.id === id),
            1,
            { ...rows.find((r) => r.id === id)!, ...v } as SkillRow,
          )
        else
          rows.push({ id: `r${rows.length + 1}`, user_id: "u", created_at: "", ...v } as SkillRow)
      },
      remove: async (id: string) => {
        rows.splice(
          rows.findIndex((r) => r.id === id),
          1,
        )
      },
    },
  },
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

const explicar = BUILTIN_SKILLS.find((s) => s.name === "explicar")!

function setup() {
  rows.length = 0
  save.mockClear()
  render(
    <QueryClientProvider client={new QueryClient()}>
      {/* Ajustes monta esto dentro de un DrialogContent; acá alcanza con el contenedor. */}
      <SkillsSettings />
    </QueryClientProvider>,
  )
}
const open = (name: string) => fireEvent.click(screen.getByText(`/${name}`))
const setDescription = (value: string) =>
  fireEvent.change(screen.getByLabelText("Descripción del skill"), { target: { value } })

test("editar un built-in crea UN override y los autosaves siguientes lo editan (sin duplicar)", async () => {
  setup()
  open("explicar")
  setDescription("primera")
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1), { timeout: 3000 })
  expect(save.mock.calls[0]![0]).toMatchObject({
    id: undefined,
    name: "explicar",
    description: "primera",
    prompt: explicar.prompt,
  })

  setDescription("segunda")
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2), { timeout: 3000 })
  // Mismo skill: la 2da vez resuelve el id del override ya creado en vez de crear otro.
  expect(save.mock.calls[1]![0]).toMatchObject({ id: "r1", description: "segunda" })
  expect(rows).toHaveLength(1)
})

test("un skill nuevo no toca el Store mientras no tenga prompt", async () => {
  setup()
  fireEvent.click(screen.getByRole("button", { name: /Nuevo$/ }))
  fireEvent.change(screen.getByLabelText("Nombre del skill"), { target: { value: "poema" } })
  await new Promise((r) => setTimeout(r, 1100))
  expect(save).not.toHaveBeenCalled()
  expect(screen.getByText(/falta el prompt/)).toBeTruthy()
})

test("Esc en el modo grande lo cierra sin dejar pasar el evento a Ajustes", () => {
  setup()
  // Stand-in del listener de Radix: `document` en fase de captura.
  const radix = vi.fn()
  document.addEventListener("keydown", radix, { capture: true })
  open("explicar")
  fireEvent.keyDown(document.body, { key: "Escape" })
  expect(screen.queryByLabelText("Nombre del skill")).toBeNull()
  expect(radix).not.toHaveBeenCalled()

  // Ya en la lista, Esc le toca a Ajustes.
  fireEvent.keyDown(document.body, { key: "Escape" })
  expect(radix).toHaveBeenCalledTimes(1)
  document.removeEventListener("keydown", radix, { capture: true })
})
