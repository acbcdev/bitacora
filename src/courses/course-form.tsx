import { useMemo, useState } from "react"
import { IconPicker } from "@/courses/icon-picker"
import { useCourses, useCreateCourse, useUpdateCourse } from "@/courses/courses.api"
import { Button } from "@/core/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/core/ui/combobox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/core/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/core/ui/field"
import { Input } from "@/core/ui/input"
import { NativeSelect } from "@/core/ui/native-select"
import type { Course, CourseStatus } from "@/core/types/database"

// Valores distintos ya usados en otros cursos, para sugerir vía <datalist>. Mismo query
// cacheado que usa la pantalla de Cursos — sin fetch adicional.
function useCourseFieldSuggestions() {
  const { data: courses = [] } = useCourses()
  return useMemo(() => {
    const uniq = (field: "source" | "area") => [
      ...new Set(courses.map((c) => c[field]).filter((v): v is string => !!v)),
    ]
    return { sourceOptions: uniq("source"), areaOptions: uniq("area") }
  }, [courses])
}

// Combobox de texto libre: a diferencia de un select, el valor es lo que esté tipeado en el
// input (inputValue), no un ítem elegido de `items` — fuente/área no son un enum cerrado.
function TextCombobox({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder: string
}) {
  return (
    <Combobox<string>
      items={options}
      inputValue={value}
      onInputValueChange={onChange}
      onValueChange={(v) => onChange(v ?? "")}
    >
      <ComboboxInput id={id} placeholder={placeholder} className="h-10" />
      <ComboboxContent collisionAvoidance={{ side: "none" }}>
        <ComboboxEmpty>Sin resultados</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export function CourseForm({ course, onClose }: { course: Course | null; onClose: () => void }) {
  const create = useCreateCourse()
  const update = useUpdateCourse()
  const { sourceOptions, areaOptions } = useCourseFieldSuggestions()

  const [name, setName] = useState(course?.name ?? "")
  const [icon, setIcon] = useState(course?.icon ?? null)
  const [source, setSource] = useState(course?.source ?? "")
  const [area, setArea] = useState(course?.area ?? "")
  const [status, setStatus] = useState<CourseStatus>(course?.status ?? "active")
  const [startedAt, setStartedAt] = useState(course?.started_at?.slice(0, 10) ?? "")
  const [finishedAt, setFinishedAt] = useState(course?.finished_at?.slice(0, 10) ?? "")

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const done = { onSuccess: onClose }
    // Crear: nombre + icono. El inicio es ahora y el estado lo pone el default de la DB ('active');
    // el fin lo setea el botón Finalizar del curso.
    if (!course)
      return create.mutate(
        {
          name,
          icon,
          source: source || null,
          area: area || null,
          started_at: new Date().toISOString(),
        },
        done,
      )
    // Pasar a "done" sin fecha → setear finished_at hoy.
    const finished =
      status === "done" && !finishedAt ? new Date().toISOString().slice(0, 10) : finishedAt
    update.mutate(
      {
        id: course.id,
        name,
        icon,
        source: source || null,
        area: area || null,
        status,
        started_at: startedAt || null,
        finished_at: finished || null,
      },
      done,
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="w-105 max-w-[92vw] gap-0 p-0 sm:max-w-105">
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
                  autoComplete="off"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Compiladores desde cero"
                  className="h-10"
                />
              </div>
            </Field>
            <FieldGroup className="flex-row">
              <Field>
                <FieldLabel htmlFor="course-source" className="eyebrow">
                  Fuente
                </FieldLabel>
                <TextCombobox
                  id="course-source"
                  value={source}
                  onChange={setSource}
                  options={sourceOptions}
                  placeholder="Ej: Platzi"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="course-area" className="eyebrow">
                  Área
                </FieldLabel>
                <TextCombobox
                  id="course-area"
                  value={area}
                  onChange={setArea}
                  options={areaOptions}
                  placeholder="Ej: Programación"
                />
              </Field>
            </FieldGroup>
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
