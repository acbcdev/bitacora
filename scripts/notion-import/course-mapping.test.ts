import type { PageObjectResponse } from "@notionhq/client"
import { computeStartedAt, mapCourseProperties } from "./course-mapping"

type Props = PageObjectResponse["properties"]

function title(text: string) {
  return {
    id: "id",
    type: "title" as const,
    title: [
      {
        type: "text",
        text: { content: text, link: null },
        plain_text: text,
        href: null,
        annotations: {},
      },
    ],
  }
}
function select(name: string | null) {
  return {
    id: "id",
    type: "select" as const,
    select: name ? { id: "id", name, color: "default" as const, description: null } : null,
  }
}
function date(start: string | null) {
  return {
    id: "id",
    type: "date" as const,
    date: start ? { start, end: null, time_zone: null } : null,
  }
}

function props(overrides: Partial<Record<string, unknown>>): Props {
  return {
    Nombre: title("Historia de JavaScript"),
    Tema: select("Programación"),
    Área: select("JavaScript"),
    Donde: select("Platzi"),
    "Fecha End": date(null),
    ...overrides,
  } as unknown as Props
}

test("mapea Nombre, Tema+Área concatenados, y Donde", () => {
  const result = mapCourseProperties(props({}))
  expect(result).toEqual({
    skip: false,
    name: "Historia de JavaScript",
    area: "Programación / JavaScript",
    source: "Platzi",
    finishedAt: null,
    startedAtRaw: null,
  })
})

// 'Fecha End' es el nombre real de la columna en la DB (el spec decía "Fecha de finalización").
test("toma Fecha End como fecha de fin", () => {
  const result = mapCourseProperties(props({ "Fecha End": date("2025-06-01") }))
  expect(result).toMatchObject({ skip: false, finishedAt: "2025-06-01" })
})

test("toma Fecha de inicio si la columna existe", () => {
  const result = mapCourseProperties(props({ "Fecha de inicio": date("2025-05-01") }))
  expect(result).toMatchObject({ skip: false, startedAtRaw: "2025-05-01" })
})

test("fila sin Nombre se saltea", () => {
  const result = mapCourseProperties(props({ Nombre: title("") }))
  expect(result.skip).toBe(true)
})

test("con Tema pero sin Área no se saltea: el area concatenado solo lleva Tema", () => {
  const result = mapCourseProperties(props({ Área: select(null) }))
  expect(result).toMatchObject({ skip: false, area: "Programación" })
})

// Verificado contra la DB real: 'Tema' es multi_select, no select.
test("Tema multi_select junta sus valores", () => {
  const multi = {
    id: "id",
    type: "multi_select" as const,
    multi_select: [
      { id: "a", name: "Programación", color: "default" as const, description: null },
      { id: "b", name: "Frontend", color: "default" as const, description: null },
    ],
  }
  const result = mapCourseProperties(props({ Tema: multi }))
  expect(result).toMatchObject({ skip: false, area: "Programación, Frontend / JavaScript" })
})

test("Tema multi_select vacío no aporta al area", () => {
  const empty = { id: "id", type: "multi_select" as const, multi_select: [] }
  const result = mapCourseProperties(props({ Tema: empty }))
  expect(result).toMatchObject({ skip: false, area: "JavaScript" })
})

// "todo, no parcial" (spec) manda: solo se saltea si Área queda TOTALMENTE vacía (Tema y Área
// ausentes), no por tener uno de los dos nada más.
test("sin Tema ni Área (área totalmente vacía) se saltea", () => {
  const result = mapCourseProperties(props({ Tema: select(null), Área: select(null) }))
  expect(result).toEqual({ skip: true, reason: expect.stringContaining("Historia de JavaScript") })
})

test("fila con Nombre pero sin Donde se saltea", () => {
  const result = mapCourseProperties(props({ Donde: select(null) }))
  expect(result.skip).toBe(true)
})

test("started_at: usa Fecha de inicio de Notion tal cual cuando existe", () => {
  expect(computeStartedAt("2025-05-01T00:00:00.000Z", "2025-01-01T00:00:00.000Z")).toEqual({
    startedAt: "2025-05-01T00:00:00.000Z",
    estimated: false,
  })
})

test("started_at: sin Fecha de inicio, usa created_time y marca la fecha como estimada", () => {
  expect(computeStartedAt(null, "2025-01-01T00:00:00.000Z")).toEqual({
    startedAt: "2025-01-01T00:00:00.000Z",
    estimated: true,
  })
})
