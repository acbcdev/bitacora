import type { PageObjectResponse } from "@notionhq/client"

type PageProperties = PageObjectResponse["properties"]
type PropertyValue = PageProperties[string]

// Lectura genérica de propiedades: distintos cursos pueden tener columnas de distinto tipo para
// el mismo concepto (schema drift entre DBs inline de notas — spec, mismo espíritu aplica acá
// por las dudas). Cubre los tipos vistos en "Curso Data": title, rich_text, select, url.
function propertyText(prop: PropertyValue | undefined): string | null {
  if (!prop) return null
  switch (prop.type) {
    case "title":
      return prop.title.map((t) => t.plain_text).join("") || null
    case "rich_text":
      return prop.rich_text.map((t) => t.plain_text).join("") || null
    case "select":
      return prop.select?.name ?? null
    // 'Tema' es multi_select en la DB real, aunque `area` es single-value en el schema (CONTEXT.md):
    // se juntan los valores en un texto en vez de perderlos.
    case "multi_select":
      return prop.multi_select.map((o) => o.name).join(", ") || null
    case "url":
      return prop.url
    default:
      return null
  }
}

function propertyDate(prop: PropertyValue | undefined): string | null {
  return prop?.type === "date" ? (prop.date?.start ?? null) : null
}

export type CourseMapResult =
  | {
      skip: false
      name: string
      area: string
      source: string
      startedAtRaw: string | null
      finishedAt: string | null
    }
  | { skip: true; reason: string }

// Política de filas incompletas/vacías (spec): sin Nombre, o con Nombre pero sin Área/Donde →
// skip + reportar. No se inventan valores para campos faltantes.
export function mapCourseProperties(props: PageProperties): CourseMapResult {
  const name = propertyText(props["Nombre"])
  if (!name) return { skip: true, reason: "fila vacía (sin Nombre)" }

  const tema = propertyText(props["Tema"])
  const areaCol = propertyText(props["Área"])
  const area = [tema, areaCol].filter(Boolean).join(" / ") || null
  const source = propertyText(props["Donde"])
  if (!area || !source) return { skip: true, reason: `"${name}": falta Área y/o Donde` }

  return {
    skip: false,
    name,
    area,
    source,
    // Nombres verificados contra la DB real. El spec decía "Fecha de inicio"/"Fecha de
    // finalización"; esas columnas no existen. 'Fecha' es de tipo created_time (no editable), así
    // que no aporta una fecha de inicio propia — startedAt sale de created_time igual, vía
    // computeStartedAt. 'Tipo' se ignora (decisión del usuario), como Count/Time To end/Place.
    startedAtRaw: propertyDate(props["Fecha de inicio"]),
    finishedAt: propertyDate(props["Fecha End"]) ?? propertyDate(props["Fecha de finalización"]),
  }
}

// started_at (spec confirmado): Fecha de inicio de Notion tal cual si existe; si no, created_time
// como aproximación.
//
// `estimated` NO es la columna `imported`. CONTEXT.md define `imported` como "fechas estimadas",
// pero la idempotencia del spec borra por `imported = true` antes de reinsertar: si los ~12 cursos
// con fecha real quedaran en false, el DELETE no los alcanzaría y la segunda corrida los
// duplicaría. Así que `imported = true` va en TODO lo que viene de Notion, y el matiz de fecha
// estimada se reporta con este flag.
export function computeStartedAt(
  startedAtRaw: string | null,
  createdTime: string,
): { startedAt: string; estimated: boolean } {
  return startedAtRaw
    ? { startedAt: startedAtRaw, estimated: false }
    : { startedAt: createdTime, estimated: true }
}
