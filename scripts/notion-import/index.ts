import { createInterface } from "node:readline/promises"
import {
  collectPaginatedAPI,
  isFullPage,
  type Client,
  type PageObjectResponse,
} from "@notionhq/client"
import type { SupabaseClient } from "@supabase/supabase-js"
import { blocksToTiptap } from "./blocks-to-tiptap"
import { computeStartedAt, mapCourseProperties } from "./course-mapping"
import { fetchBlockTree } from "./fetch-block-tree"
import { uploadImage } from "./images"
import { createNotionClient } from "./notion-client"
import { createAdminClient, resolveSingleUserId } from "./supabase-admin"

const COURSES_DATA_SOURCE = "Curso Data"
const write = process.argv.includes("--write")
const skipped: string[] = []

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
  page: PageObjectResponse,
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const icon = page.icon
  if (!icon) return null
  if (icon.type === "emoji") return icon.emoji
  if (icon.type === "external")
    return uploadImage(supabase, "course-icons", userId, icon.external.url)
  if (icon.type === "file") return uploadImage(supabase, "course-icons", userId, icon.file.url)
  return null
}

async function importNotes(
  notion: Client,
  supabase: SupabaseClient,
  userId: string,
  coursePageId: string,
  courseId: string | null,
): Promise<number> {
  const dataSourceId = await findNotesDataSource(notion, coursePageId)
  if (!dataSourceId) return 0

  const pages = (
    await collectPaginatedAPI(notion.dataSources.query, {
      data_source_id: dataSourceId,
      sorts: [{ timestamp: "created_time", direction: "ascending" }],
    })
  ).filter(isFullPage)

  let position = 0
  for (const page of pages) {
    const blocks = await fetchBlockTree(notion, page.id, (url) =>
      write ? uploadImage(supabase, "notes-images", userId, url) : Promise.resolve(url),
    )
    const content = { type: "doc" as const, content: blocksToTiptap(blocks) }
    const title = noteTitle(page)

    if (write && courseId) {
      const { error } = await supabase.from("notes").insert({
        user_id: userId,
        course_id: courseId,
        title,
        content,
        kind: "note",
        position,
        imported: true,
        created_at: page.created_time,
      })
      if (error) throw new Error(`insert de nota "${title}" falló: ${error.message}`)
    }
    position++
  }
  return pages.length
}

async function confirmBackup(): Promise<void> {
  // El spec pide backup de la DB antes de la corrida real. No hay credenciales de conexión
  // directa en el repo para automatizar un pg_dump, así que se gatea con confirmación explícita.
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(
    "Esto BORRA todo lo que tenga imported = true en courses y notes, y reinserta desde Notion.\n" +
      "OJO: el borrado de notas cascadea a read_log — se pierde el historial de repaso de las\n" +
      "notas importadas, que CONTEXT.md declara que nunca se borra. En la primera corrida no hay\n" +
      "historial que perder; en una re-corrida sí.\n" +
      "¿Tenés backup de la DB? (escribí 'si' para continuar): ",
  )
  rl.close()
  if (answer.trim().toLowerCase() !== "si") throw new Error("cancelado: hacé el backup primero")
}

async function main() {
  process.loadEnvFile(".env")
  const notion = createNotionClient(env("NOTION_TOKEN"))
  const supabase = createAdminClient(env("VITE_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"))
  const userId = await resolveSingleUserId(supabase)

  if (write) await confirmBackup()
  else console.log("DRY-RUN — nada se escribe. Corré con --write para importar de verdad.\n")

  if (write) {
    // Notas primero: notes.course_id es ON DELETE SET NULL, no CASCADE, así que borrar cursos no
    // se lleva sus notas. El delete de notas sí cascadea a read_log (FK ON DELETE CASCADE).
    for (const table of ["notes", "courses"]) {
      const { error } = await supabase.from(table).delete().eq("imported", true)
      if (error) throw new Error(`delete de ${table} importados falló: ${error.message}`)
    }
  }

  const coursePages = (
    await collectPaginatedAPI(notion.dataSources.query, {
      data_source_id: await findCoursesDataSource(notion),
    })
  ).filter(isFullPage)

  let courses = 0
  let notes = 0
  let estimatedDates = 0

  for (const page of coursePages) {
    const mapped = mapCourseProperties(page.properties)
    if (mapped.skip) {
      skipped.push(mapped.reason)
      continue
    }

    const { startedAt, estimated } = computeStartedAt(mapped.startedAtRaw, page.created_time)
    if (estimated) estimatedDates++

    let courseId: string | null = null
    if (write) {
      const { data, error } = await supabase
        .from("courses")
        .insert({
          user_id: userId,
          name: mapped.name,
          // Todo lo que viene de Notion entra como 'done': es material ya estudiado. El status no
          // afecta la cola de repaso (review_queue() no filtra por él, ver migración 0003).
          status: "done",
          started_at: startedAt,
          finished_at: mapped.finishedAt,
          icon: await resolveIcon(page, supabase, userId),
          source: mapped.source,
          area: mapped.area,
          imported: true,
        })
        .select("id")
        .single()
      if (error) throw new Error(`insert del curso "${mapped.name}" falló: ${error.message}`)
      courseId = data.id
    }

    const noteCount = await importNotes(notion, supabase, userId, page.id, courseId)
    console.log(`${mapped.name} — ${noteCount} notas`)
    courses++
    notes += noteCount
  }

  console.log(`\n${courses} cursos, ${notes} notas${write ? " importados" : " (dry-run)"}.`)
  console.log(`${estimatedDates} cursos con started_at estimado desde created_time.`)
  if (skipped.length) {
    console.log(`\n${skipped.length} filas salteadas para revisión manual:`)
    for (const reason of skipped) console.log(`  - ${reason}`)
  }
}

main().catch((err) => {
  console.error(`\nimport abortado: ${err.message}`)
  process.exit(1)
})
