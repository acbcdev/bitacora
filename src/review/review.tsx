import { useCallback, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import { Flame, Pencil } from "lucide-react"
import { Editor } from "@/core/components/editor"
import { NoteSkeleton } from "@/core/components/skeletons"
import { Button } from "@/core/ui/button"
import { Card } from "@/core/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/core/ui/empty"
import { Kbd } from "@/core/ui/kbd"
import { Progress } from "@/core/ui/progress"
import { useCourses } from "@/courses/courses.api"
import { useReviewQueue, useMarkRead } from "@/review/review.api"
import { DAILY_GOAL, todayKey, useReadStats } from "@/core/lib/stats"
import { Courses } from "@/courses/courses"

// Pantalla Hoy / Repaso (screen 1) — la que abre 2–3×/día. Keyboard-first:
//   Space = marcar leído (insert read_log) + siguiente · J = saltar sig · K = saltar ant.
// Debajo del repaso va la lista de cursos embebida, como en el diseño.
export function Review() {
  const { data: queue = [], isLoading, refetch } = useReviewQueue()
  const { data: courses = [] } = useCourses()
  const { data: stats } = useReadStats()
  const markRead = useMarkRead()
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)

  const note = queue[index]
  const courseName = courses.find((c) => c.id === note?.course_id)?.name
  const readToday = stats?.today ?? 0
  const streak = stats?.streak ?? 0
  const donePct = Math.min(100, (readToday / DAILY_GOAL) * 100)

  const next = useCallback(() => {
    if (note) markRead.mutate(note.id)
    setIndex((i) => i + 1) // avance optimista (ui-principles)
  }, [note, markRead])

  useHotkeys("space", next, { preventDefault: true }, [next]) // no scrollear
  useHotkeys(
    "j",
    () => setIndex((i) => Math.min(i + 1, queue.length)), // saltar sin contar
    { preventDefault: true },
    [queue.length],
  )
  useHotkeys("k", () => setIndex((i) => Math.max(i - 1, 0)), { preventDefault: true })

  if (isLoading)
    return (
      <div className="fade-in mx-auto max-w-shell px-8 pt-9 pb-16">
        <Card className="py-6">
          <NoteSkeleton />
        </Card>
      </div>
    )
  const done = queue.length === 0 || index >= queue.length

  return (
    <div className="fade-in mx-auto max-w-shell px-8 pt-9 pb-16">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="eyebrow">Hoy — {todayKey()}</p>
        <div className="flex items-center gap-6">
          <span className="inline-flex items-center gap-1.5">
            <Flame size={14} className="text-brand-fg" />
            <span className="mono">
              {streak} {streak === 1 ? "día" : "días"}
            </span>
          </span>
          <span className="mono">
            leídas hoy {readToday}/{DAILY_GOAL}
          </span>
        </div>
      </div>

      <Progress
        value={donePct}
        className="mb-8 h-0.5"
        aria-label={`Meta diaria de lectura: ${readToday} de ${DAILY_GOAL} notas`}
      />

      <Card className="mb-8 py-6">
        {done ? (
          // Cola vacía o batch terminado → estado claro, no error (review/02).
          <Empty className="px-8 py-16">
            <EmptyHeader>
              <EmptyTitle className="text-lg">
                {queue.length === 0 ? "Nada para repasar hoy." : "Batch terminado."}
              </EmptyTitle>
              <EmptyDescription>
                {readToday} {readToday === 1 ? "nota leída" : "notas leídas"} hoy.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                onClick={() => {
                  setIndex(0)
                  refetch()
                }}
              >
                Cargar más
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="mx-auto max-w-read px-8">
            <div className="mb-6 flex items-center justify-between">
              <p className="eyebrow">{courseName ?? "Sin curso"}</p>
              <span className="mono-dim">
                {index + 1} / {queue.length}
              </span>
            </div>

            <div key={note.id} className="note-in">
              <h1 className="mb-6 text-3xl font-semibold tracking-tight text-pretty">
                {note.title || "(sin título)"}
              </h1>
              <Editor content={note.content} editable={false} />
            </div>

            <div className="mt-8 flex items-center justify-between border-t pt-5">
              <div className="flex flex-wrap items-center gap-3.5 text-xs text-muted-foreground">
                <span>
                  <Kbd>Space</Kbd> leído + siguiente
                </span>
                <span>
                  <Kbd>J</Kbd> saltar
                </span>
                <span>
                  <Kbd>K</Kbd> volver
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate(`/note/${note.id}`)}>
                  <Pencil />
                  Editar
                </Button>
                <Button size="sm" onClick={next}>
                  Marcar leído
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Courses embed />
    </div>
  )
}
