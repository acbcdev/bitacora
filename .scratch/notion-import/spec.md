# Feature: notion-import

**Status:** blocked (needs-info) — bloqueo externo único: falta que el usuario complete el setup de
la Notion integration (token + compartir página). Una vez hecho, listo para escribir el primer
issue de implementación.

**Blocked by:** foundation, courses, notes (ya construidos — `courses`/`notes` ya tienen columna
`imported boolean` y `courses.started_at` ya es nullable, ver `supabase/migrations/0001_initial_schema.sql`)

Último en el orden. Migra los 59 cursos (~1.500 notas) desde Notion. Es el código con **más riesgo
de corromper datos** — por eso va al final.

## Fuente de datos: Notion API, no export manual

Se descartó el plan original de pedir un export Markdown+CSV. Verificado en vivo (browsing de la
DB real "Aprendizaje", `notion.so`) que conviene usar la **API oficial de Notion**
(`@notionhq/client`) en su lugar:

- La API devuelve bloques estructurados (rich_text arrays con bold/italic/links) — más confiable
  que reverse-engineear markdown ambiguo.
- No depende de que el usuario haga un export manual de 200MB.

**Setup pendiente (lo hace el usuario, no el agente — es cambio de cuenta/config):**
1. `notion.so/my-integrations` → New integration (Internal) → copiar el token.
2. Página "Aprendizaje" → `•••` → Conexiones → agregar la integración.
3. Guardar token en `.env.local` como `NOTION_TOKEN`.

Notas técnicas para cuando se escriba el parser (no requieren más decisiones, son restricciones
conocidas de la API):
- Rate limit ~3 req/s → retry con backoff.
- Paginación por cursor en queries de DB (100 rows por página).
- URLs de imágenes tipo `file` (hosteadas por Notion) expiran en ~1h → hay que descargar y
  resubir a Supabase Storage dentro de la misma corrida, no guardarlas para después.

## Estructura real verificada (DB "Aprendizaje" → "Curso Data")

59 cursos, 2 filas vacías. Columnas reales de la DB de cursos:

| Columna Notion | Mapeo a `courses` |
|---|---|
| Nombre | `name` |
| Tema + Área | concatenados → `area` (ej. `"Programación / JavaScript"`) |
| Donde | `source` |
| Fecha de inicio | `started_at` (ver estrategia abajo) |
| ícono de página | `icon` |
| Fecha de finalización | `finished_at` |
| Count, Time To end, Place | **ignorar** — vacías en todas las filas vistas o sin semántica clara |

Cada curso tiene una **DB inline de notas** independiente (propiedades pueden variar de curso a
curso — son DBs separadas, no una sola compartida). Propiedades vistas en una nota real
("Historia de JavaScript"): `Título`, `Creado` (created_time), `Etiquetas` (contador de veces
leída la nota — confirmado por el usuario). Contenido: rich text con negrita/itálica/links +
**imágenes embebidas**.

## `started_at`: confirmado

De los 59 cursos, solo ~12 (los más recientes, desde mayo 2025) tienen `Fecha de inicio` real en
Notion. Estrategia:
- Si `Fecha de inicio` existe → usar tal cual.
- Si no existe (~47 cursos) → `created_time` de Notion como aproximación + `imported = true` para
  marcar que la fecha es estimada.

## Notas: contenido y mapeo

- Conversión: bloques de la API de Notion → Tiptap JSON directo (no vía markdown).
- Fidelidad soportada: párrafos, negrita/itálica, links, listas, headers, code blocks, imágenes.
  Bloques Notion-only sin equivalente (callouts, toggles, tablas, embeds) se evalúan cuando
  aparezcan en datos reales — no se sobre-invierte de antemano.
- Imágenes: se descargan y suben a un bucket nuevo de Supabase Storage (`notes-images`), mismo
  patrón que `0004_course_icon.sql` (bucket + policy). Se reescribe la URL en el JSON de Tiptap.
- Links internos de Notion (apuntan a páginas no migradas) → se aplanan a texto plano. Links
  externos se preservan tal cual.
- `kind` → siempre `'note'` (sin evidencia de estructura tipo flashcard en Notion).
- `position` → orden por `created_time` ascendente dentro del curso.
- Contador `Etiquetas` (veces leída) → se descarta. No hay timestamps individuales de lectura en
  Notion para poblar `read_log` de forma real; inventar fechas ensuciaría las stats de repaso.

## Filas incompletas o vacías

Se vieron filas con nombre pero sin Área/Donde (ej. "Programación"), y Notion reporta 2 filas
totalmente vacías en la DB de 59. Política: **skip + reportar al final** la lista de filas
saltadas para revisión manual. No se inventan valores para campos faltantes.

## Schema drift entre cursos

Como cada curso tiene su propia DB inline de notas, las propiedades pueden no ser idénticas entre
cursos. Política: **best-effort** — el import de un curso usa lo que reconoce de su DB de notas y
sigue, en vez de abortar todo el import por un curso con propiedades distintas.

## Migración: todo, no parcial

Los 59 cursos completos, no solo los activos. Migración parcial descartada explícitamente.

## Idempotencia

Antes de cada corrida: `DELETE` de todo lo que tenga `imported = true` en `courses` y `notes`,
después reinsertar todo desde cero. No hay `notion_id`/unique constraint — se optó por
borrar-y-reinsertar en vez de upsert, ya que el import se corre pocas veces (setup inicial), no
como sync continuo.

## Ejecución y salvaguardas

- Script CLI one-off: `pnpm run import:notion`. No es feature de la app ni tiene UI.
- Antes de la corrida real: **dry-run** (loguea qué va a crear/actualizar sin escribir) +
  **backup de la DB**.

## Riesgo / cómo trabajarlo

- Es el feature con más chance de corromper datos → cuando se escriba, pasarlo por `/code-review`.

## Issues

- `issues/01-notion-parser-import-script.md` — parser + script de import. Código completo y con
  tests; **bloqueado para correr**: falta compartir la DB de los 59 cursos con la integración (hoy
  solo ve una fila suelta). Ver los Comments de ese issue para las divergencias de schema
  verificadas contra la API real.
