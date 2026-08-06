import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  collectPaginatedAPI,
  isFullPage,
  type Client,
  type PageObjectResponse,
} from "@notionhq/client"
import type { SupabaseClient } from "@supabase/supabase-js"
import { blocksToTiptap } from "./blocks-to-tiptap"
import { cached, OUT_DIR } from "./cache"
import { computeStartedAt, mapCourseProperties, type CourseMapResult } from "./course-mapping"
import { toCsv, type CsvRow } from "./csv"
import { fetchBlockTree } from "./fetch-block-tree"
import { uploadImage } from "./images"
import { createNotionClient } from "./notion-client"
import { createAdminClient, resolveSingleUserId } from "./supabase-admin"

const COURSES_DATA_SOURCE = "Curso Data"
const skipped: string[] = []
// Una imagen caída (CDN de terceros con hotlink protection, archivo borrado) no puede tirar abajo
// una corrida de una hora: se degrada y se reporta al final. OJO: el curso igual se cachea con la
// degradación adentro — para reintentarlo hay que borrar su json de .out/cache.
const warnings: string[] = []

type CourseBundle = { course: CsvRow; notes: CsvRow[]; estimatedDate: boolean }

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`falta ${name} en .env`)
  return value
}

// La DB de cursos se ubica por nombre en vez de pedir un ID a mano: la integración ve solo lo que
// se le compartió, así que el search no es ambiguo en la práctica.
async function findCoursesDataSource(notion: Client): Promise<string> {
  const res = await notion.search({
    query: COURSES_DATA_SOURCE,
    filter: { property: "object", value: "data_source" },
  })
  const match = res.results.find((r) => r.object === "data_source")
  if (!match)
    throw new Error(
      `no se encontró la data source "${COURSES_DATA_SOURCE}" — ¿está compartida con la integración?`,
    )
  return match.id
}

// Cada curso tiene su propia DB inline de notas (spec): es un bloque child_database entre los
// hijos de la página del curso.
async function findNotesDataSource(notion: Client, coursePageId: string): Promise<string | null> {
  const children = await collectPaginatedAPI(notion.blocks.children.list, {
    block_id: coursePageId,
  })
  const inline = children.find((b) => "type" in b && b.type === "child_database")
  if (!inline) return null
  const db = await notion.databases.retrieve({ database_id: inline.id })
  return "data_sources" in db ? (db.data_sources[0]?.id ?? null) : null
}

function noteTitle(page: PageObjectResponse): string {
  const titleProp = Object.values(page.properties).find((p) => p.type === "title")
  return titleProp?.type === "title" ? titleProp.title.map((t) => t.plain_text).join("") : ""
}

// courses.icon acepta 'lucide:<Nombre>' o una URL pública (migración 0004); CourseIcon además
// renderiza emoji tal cual. Los íconos tipo file/external se resubn porque las URLs de Notion expiran.
async function resolveIcon(
  notion: Client,
  page: PageObjectResponse,
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const icon = page.icon
  if (!icon) return null
  if (icon.type === "emoji") return icon.emoji
  if (icon.type === "external")
    return uploadImage(supabase, "course-icons", userId, icon.external.url)
  if (icon.type !== "file") return null

  // La URL firmada de un archivo de Notion dura 1h (icon.file.expiry_time). La lista de cursos se
  // pide una sola vez al arranque y la corrida entera lleva más que eso, así que para el curso N la
  // URL que vino en la lista ya venció (403 de S3). Se vuelve a pedir la página para tener una fresca.
  const fresh = await notion.pages.retrieve({ page_id: page.id })
  const url = isFullPage(fresh) && fresh.icon?.type === "file" ? fresh.icon.file.url : icon.file.url
  return uploadImage(supabase, "course-icons", userId, url)
}

async function noteRows(
  notion: Client,
  supabase: SupabaseClient,
  userId: string,
  coursePageId: string,
): Promise<CsvRow[]> {
  const dataSourceId = await findNotesDataSource(notion, coursePageId)
  if (!dataSourceId) return []

  const pages = (
    await collectPaginatedAPI(notion.dataSources.query, {
      data_source_id: dataSourceId,
      sorts: [{ timestamp: "created_time", direction: "ascending" }],
    })
  ).filter(isFullPage)

  const rows: CsvRow[] = []
  for (const [position, page] of pages.entries()) {
    const blocks = await fetchBlockTree(notion, page.id, (url) =>
      // Si la subida falla se deja la URL original en el documento: si es externa puede seguir
      // resolviendo desde el browser, y si es de Notion queda rota pero visible para arreglar a mano.
      uploadImage(supabase, "notes-images", userId, url).catch((err: Error) => {
        warnings.push(`imagen de "${noteTitle(page)}": ${err.message}`)
        return url
      }),
    )
    rows.push({
      // El id de página de Notion ya es un uuid: se usa tal cual como PK para que el CSV sea
      // estable entre corridas y notes.course_id apunte al curso sin tabla de equivalencias.
      id: page.id,
      user_id: userId,
      course_id: coursePageId,
      title: noteTitle(page),
      content: JSON.stringify({ type: "doc", content: blocksToTiptap(blocks) }),
      kind: "note",
      position,
      imported: true,
      created_at: page.created_time,
    })
  }
  return rows
}

async function buildCourse(
  notion: Client,
  supabase: SupabaseClient,
  userId: string,
  page: PageObjectResponse,
  mapped: Extract<CourseMapResult, { skip: false }>,
): Promise<CourseBundle> {
  const { startedAt, estimated } = computeStartedAt(mapped.startedAtRaw, page.created_time)
  return {
    course: {
      id: page.id,
      user_id: userId,
      name: mapped.name,
      // Todo lo que viene de Notion entra como 'done': es material ya estudiado. El status no
      // afecta la cola de repaso (review_queue() no filtra por él, ver migración 0003).
      status: "done",
      started_at: startedAt,
      finished_at: mapped.finishedAt,
      icon: await resolveIcon(notion, page, supabase, userId).catch((err: Error) => {
        warnings.push(`icono de "${mapped.name}": ${err.message}`)
        return null
      }),
      source: mapped.source,
      area: mapped.area,
      imported: true,
    },
    notes: await noteRows(notion, supabase, userId, page.id),
    estimatedDate: estimated,
  }
}

async function main() {
  process.loadEnvFile(".env")
  const notion = createNotionClient(env("NOTION_TOKEN"))
  // Sigue haciendo falta Supabase: las imágenes/íconos van a Storage porque las URLs `file` de
  // Notion expiran ~1h, y el CSV necesita la URL final. A las tablas no se escribe nada.
  const supabase = createAdminClient(env("VITE_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"))
  const userId = await resolveSingleUserId(supabase)

  // Sin cachear a propósito: son 2 requests y las páginas traen URLs de icono firmadas que se
  // pudren en 1h. Lo que se cachea es el resultado por curso, ya con las URLs de Storage resueltas.
  const coursePages = (
    await collectPaginatedAPI(notion.dataSources.query, {
      data_source_id: await findCoursesDataSource(notion),
    })
  ).filter(isFullPage)

  const courseRows: CsvRow[] = []
  const allNoteRows: CsvRow[] = []
  let estimatedDates = 0

  const width = String(coursePages.length).length

  for (const [index, page] of coursePages.entries()) {
    const at = `[${String(index + 1).padStart(width)}/${coursePages.length}]`
    const mapped = mapCourseProperties(page.properties)
    if (mapped.skip) {
      skipped.push(mapped.reason)
      continue
    }

    const bundle = await cached(page.id, () => buildCourse(notion, supabase, userId, page, mapped))
    courseRows.push(bundle.course)
    allNoteRows.push(...bundle.notes)
    if (bundle.estimatedDate) estimatedDates++
    console.log(`${at} ${mapped.name} — ${bundle.notes.length} notas`)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, "courses.csv"), toCsv(courseRows))
  writeFileSync(join(OUT_DIR, "notes.csv"), toCsv(allNoteRows))

  console.log(`\n${courseRows.length} cursos, ${allNoteRows.length} notas → ${OUT_DIR}/`)
  console.log(`${estimatedDates} cursos con started_at estimado desde created_time.`)
  if (skipped.length) {
    console.log(`\n${skipped.length} filas salteadas para revisión manual:`)
    for (const reason of skipped) console.log(`  - ${reason}`)
  }
  if (warnings.length) {
    console.log(`\n${warnings.length} imágenes que no se pudieron subir:`)
    for (const warning of warnings) console.log(`  - ${warning}`)
  }
}

main().catch((err) => {
  console.error(`\nimport abortado: ${err.message}`)
  process.exit(1)
})
