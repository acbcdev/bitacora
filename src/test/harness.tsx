import { render, type RenderResult } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { TooltipProvider } from "@/core/ui/tooltip"
import { localStore } from "@/core/store/local-store"
import type { Snapshot } from "@/core/store/types"
import type { Course, Habit, Note, TiptapDoc } from "@/core/types/database"

const PREFIX = "bita-local:"
const LOCAL_USER_ID = "00000000-0000-0000-0000-000000000000"

// ── factories ────────────────────────────────────────────────────────────────

function nowIso() {
  return new Date().toISOString()
}

export function course(over: Partial<Course> = {}): Course {
  return {
    id: crypto.randomUUID(),
    user_id: LOCAL_USER_ID,
    name: "Curso",
    status: "active",
    started_at: null,
    finished_at: null,
    icon: null,
    source: null,
    area: null,
    imported: false,
    deleted_at: null,
    created_at: nowIso(),
    ...over,
  }
}

export function note(over: Partial<Note> & { id?: string } = {}): Note {
  const base: Note = {
    id: crypto.randomUUID(),
    user_id: LOCAL_USER_ID,
    course_id: "c1",
    title: "Nota",
    content: { type: "doc", content: [] } as TiptapDoc,
    kind: "note",
    position: 0,
    imported: false,
    deleted_at: null,
    created_at: nowIso(),
  } as unknown as Note
  return {
    ...base,
    ...over,
    content: (over as { content?: TiptapDoc }).content ?? base.content,
  } as unknown as Note
}

export function habit(over: Partial<Habit> = {}): Habit {
  return {
    id: crypto.randomUUID(),
    user_id: LOCAL_USER_ID,
    name: "Hábito",
    icon: null,
    kind: "good",
    metric: "check",
    target: 1,
    period: "day",
    days: null,
    deleted_at: null,
    created_at: nowIso(),
    ...over,
  }
}

export function readRow(
  over: Partial<{
    note_id: string
    read_at: string
    grade: import("@/core/types/database").Grade | null
  }> = {},
): Snapshot["reads"][number] {
  return {
    note_id: "n1",
    read_at: nowIso(),
    grade: null,
    ...over,
  }
}

function localDayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function habitLogRow(
  over: Partial<Snapshot["habitLog"][number]> = {},
): Snapshot["habitLog"][number] {
  return {
    habit_id: "h1",
    day: localDayKey(),
    amount: 1,
    target: 1,
    ...over,
  }
}

// ── seed ────────────────────────────────────────────────────────────────────

export function seedSnapshot(seed: Partial<Snapshot> = {}) {
  // force local mode (hasSupabaseEnv is false in tests, but be explicit)
  localStorage.setItem("bita-storage", "local")
  if (seed.courses !== undefined) {
    localStorage.setItem(PREFIX + "courses", JSON.stringify(seed.courses))
  }
  if (seed.notes !== undefined) {
    // Snapshot notes are NoteRef, but storage expects full Note with content.
    // If caller used note() factory they already have content; if they passed
    // a bare NoteRef we add content so store.note(id) doesn't throw.
    const fullNotes = (seed.notes as unknown as Record<string, unknown>[]).map((n) => ({
      user_id: LOCAL_USER_ID,
      content: { type: "doc", content: [] },
      kind: "note",
      position: 0,
      imported: false,
      deleted_at: null,
      created_at: nowIso(),
      ...n,
    }))
    localStorage.setItem(PREFIX + "notes", JSON.stringify(fullNotes))
  }
  if (seed.reads !== undefined) {
    // Snapshot reads -> storage read_log (needs id/user_id for completeness but snapshot only reads 3 fields)
    const rows = seed.reads.map((r) => ({
      id: crypto.randomUUID(),
      user_id: LOCAL_USER_ID,
      ...r,
    }))
    localStorage.setItem(PREFIX + "read_log", JSON.stringify(rows))
  }
  if (seed.habits !== undefined) {
    localStorage.setItem(PREFIX + "habits", JSON.stringify(seed.habits))
  }
  if (seed.habitLog !== undefined) {
    const rows = seed.habitLog.map((r) => ({
      id: crypto.randomUUID(),
      user_id: LOCAL_USER_ID,
      ...r,
    }))
    localStorage.setItem(PREFIX + "habit_log", JSON.stringify(rows))
  }
}

// ── render ──────────────────────────────────────────────────────────────────

export function renderApp(
  ui: React.ReactNode,
  seed: Partial<Snapshot> = {},
  opts: { route?: string } = {},
): RenderResult & { store: ReturnType<typeof localStore>; qc: QueryClient } {
  localStorage.clear()
  seedSnapshot(seed)

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const routerProps = opts.route ? { initialEntries: [opts.route] } : {}

  const result = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter {...routerProps}>
        <TooltipProvider>{ui}</TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  return { ...result, store: localStore(), qc }
}
