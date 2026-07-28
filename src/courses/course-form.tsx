import { useState } from "react"
import { IconPicker } from "@/courses/icon-picker"
import { useCreateCourse, useUpdateCourse } from "@/courses/courses.api"
import { Button } from "@/core/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/core/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/core/ui/field"
import { Input } from "@/core/ui/input"
import { NativeSelect } from "@/core/ui/native-select"
import type { Course, CourseStatus } from "@/core/types/database"

export function CourseForm({ course, onClose }: { course: Course | null; onClose: () => void }) {
  const create = useCreateCourse()
  const update = useUpdateCourse()

  const [name, setName] = useState(course?.name ?? "")
  const [icon, setIcon] = useState(course?.icon ?? null)
  const [status, setStatus] = useState<CourseStatus>(course?.status ?? "active")
  const [startedAt, setStartedAt] = useState(course?.started_at?.slice(0, 10) ?? "")
  const [finishedAt, setFinishedAt] = useState(course?.finished_at?.slice(0, 10) ?? "")

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const done = { onSuccess: onClose }
    // Crear: nombre + icono. El inicio es ahora y el estado lo pone el default de la DB ('active');
    // el fin lo setea el botón Finalizar del curso.
    if (!course) return create.mutate({ name, icon, started_at: new Date().toISOString() }, done)
    // Pasar a "done" sin fecha → setear finished_at hoy.
    const finished =
      status === "done" && !finishedAt ? new Date().toISOString().slice(0, 10) : finishedAt
    update.mutate(
      {
        id: course.id,
        name,
        icon,
        status,
        started_at: startedAt || null,
        finished_at: finished || null,
      },
      done,
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-[420px] max-w-[92vw] gap-0 p-0 sm:max-w-[420px]"
      >
        <form onSubmit={submit}>
          <DialogHeader className="border-b px-8 py-6">
            <DialogTitle className="text-lg font-semibold">
              {course ? "Editar curso" : "Nuevo curso"}
            </DialogTitle>
          </DialogHeader>
          <FieldGroup className="px-8 py-6">
            <Field>
              <FieldLabel htmlFor="course-name" className="eyebrow">
                Nombre
              </FieldLabel>
              <div className="flex items-center gap-2">
                <IconPicker icon={icon} onChange={setIcon} />
                <Input
                  id="course-name"
                  autoFocus
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Compiladores desde cero"
                  className="h-10"
                />
              </div>
            </Field>
            {/* Estado y fechas solo al editar: crear un curso es escribir el nombre y listo. */}
            {course && (
              <>
                <Field>
                  <FieldLabel htmlFor="course-status" className="eyebrow">
                    Estado
                  </FieldLabel>
                  <NativeSelect
                    id="course-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CourseStatus)}
                    className="w-full [&>select]:h-10 [&>select]:text-base"
                  >
                    <option value="active">activo</option>
                    <option value="paused">pausado</option>
                    <option value="done">hecho</option>
                  </NativeSelect>
                </Field>
                <FieldGroup className="flex-row">
                  <Field>
                    <FieldLabel htmlFor="course-started" className="eyebrow">
                      Inicio
                    </FieldLabel>
                    <Input
                      id="course-started"
                      type="date"
                      value={startedAt}
                      onChange={(e) => setStartedAt(e.target.value)}
                      className="h-10"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="course-finished" className="eyebrow">
                      Fin
                    </FieldLabel>
                    <Input
                      id="course-finished"
                      type="date"
                      value={finishedAt}
                      onChange={(e) => setFinishedAt(e.target.value)}
                      className="h-10"
                    />
                  </Field>
                </FieldGroup>
              </>
            )}
          </FieldGroup>
          <div className="flex justify-end gap-2 border-t px-8 py-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">{course ? "Guardar" : "Crear curso"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
