# Issue 01: parser + script de import contra la API real de Notion

**Status:** needs-info — código completo, tests verdes. Bloqueado para correr: la integración
"notas" solo ve la fila "Aprendizaje" (`55c246b6-…`), no la DB de los 59 cursos. Falta compartir
esa DB con la integración.

Setup de Notion confirmado (token en `.env`, página "Aprendizaje" compartida con la integration).
Implementa el import completo descrito en `../spec.md`.

## Alcance

- Migración `notes-images` (bucket + policy, mismo patrón que `0004_course_icon.sql`).
- Extensión `@tiptap/extension-image` en el editor (StarterKit no incluye nodo `image`; sin esto
  las notas importadas con imágenes no renderizarían en la app — gap del spec original, no
  decisión nueva).
- `scripts/notion-import/`: script CLI one-off (`pnpm run import:notion`), fuera de `src/` (no es
  feature de la app).
  - Cliente Notion con rate limit (~3 req/s) y retry/backoff.
  - Descubrimiento de la DB "Curso Data" vía `search` de la API (no requiere ID manual).
  - Mapeo de propiedades de curso → `courses` (Tema+Área concatenados, `started_at` con la
    estrategia confirmada en el spec, skip+reporte de filas incompletas/vacías).
  - Por curso: ubicar su DB inline de notas (`child_database` en los children de la página del
    curso), leer sus notas ordenadas por `created_time` ascendente.
  - Conversión bloques Notion → Tiptap JSON (párrafos, negrita/itálica, links, listas, headers,
    code blocks, imágenes). Links internos → texto plano; externos preservados. Bloques sin
    equivalente: skip con log, no aborta el curso (best-effort, schema drift entre cursos).
  - Imágenes: descarga + reupload a `notes-images` dentro de la misma corrida (URLs de Notion
    expiran ~1h), URL reescrita en el JSON.
  - Auth de escritura: `SUPABASE_SERVICE_ROLE_KEY` (no hay sesión de browser en un script CLI) +
    `user_id` explícito, resuelto automáticamente vía `auth.admin.listUsers()` (app single-user;
    falla si hay más de 1 usuario).
  - Idempotencia: antes de escribir, `DELETE` explícito de `notes where imported = true` y
    `courses where imported = true` (sin cascada real entre las tablas — `notes.course_id` es
    `ON DELETE SET NULL`, no CASCADE).
  - Dry-run por default; `--write` para correr real. Antes de escribir, gate de confirmación
    interactiva de que se tomó backup (spec pide backup de la DB; sin credenciales de conexión
    directa en el repo, se gatea con confirmación explícita en vez de automatizar un pg_dump).
  - Reporte final: filas/cursos/notas saltadas, con motivo.

## Tests (TDD, seams puros)

- Conversión de rich text (marks, links internos vs externos).
- Conversión de bloques → nodos Tiptap (tipos soportados + fallback en no soportados).
- `started_at`/`imported` a partir de propiedades del curso.
- Mapeo de propiedades de curso (incluye policy de skip por campos faltantes).

## Fuera de alcance

- UI o feature de la app — es script one-off.
- Limpieza de imágenes huérfanas en el bucket entre corridas repetidas (corre pocas veces, YAGNI).
- Automatizar el backup de la DB (requiere credenciales de conexión que no viven en el repo).

## Comments

### Verificación contra la API real (2026-08-04)

Token y service_role key funcionan. `notion.search({})` devuelve **un solo objeto**: la página
`55c246b6-0510-4596-85c4-af9c538240f2` ("Aprendizaje"), que es una **fila** de la DB de cursos, no
la DB. Su data source padre (`acd2c80c-…`, database `51259437-…`) da `object_not_found`. El ID
`1095818c-5003-4e07-96ef-053d4ecc5a32` que pasó el usuario tampoco es accesible. **Hay que
compartir la DB de cursos con la integración "notas".**

Divergencias del spec encontradas en esa fila real (columnas reales vs. las del spec):

| Spec | Real | Acción |
|---|---|---|
| `Tema` (asumido single) | `Tema` **multi_select** | soportado, se juntan los valores con `, ` |
| `Fecha de inicio` | no existe; hay `Fecha` (**created_time**, no editable) | `started_at` sale de `created_time` → estimado para todos |
| `Fecha de finalización` | `Fecha End` (date) | mapeado a `finished_at` |
| — | `Tipo` (select, visto "Inactive") | **ignorado** por decisión del usuario |
| — | `Curso Data` (**relation**) | probablemente apunta a la DB real de los 59 cursos; sin acceso no se puede confirmar |

Otros hallazgos:
- El ícono de la fila real es un emoji (`👨‍🏫`). `CourseIcon` no renderizaba emoji (solo
  `lucide:` y `http`) — se agregó ese caso, si no la migración de íconos se perdía entera.
- Conflicto spec vs. CONTEXT.md resuelto: CONTEXT.md define `imported` como "fechas estimadas",
  pero la idempotencia borra por `imported = true`. Si los cursos con fecha real quedaran en
  `false`, el DELETE no los alcanzaría y la segunda corrida los **duplicaría**. Se usa
  `imported = true` para todo lo que viene de Notion; el matiz de fecha estimada va al reporte.

### Code review (2026-08-04)

Findings accionados:

- **Contenido anidado se perdía en silencio.** El `default:` de `blocks-to-tiptap.ts` preservaba
  el `rich_text` del bloque pero descartaba `children` — un toggle o un `column_list` perdía todo
  lo de adentro sin reportarlo. Ahora se **aplana**: el rich_text va como paragraph y los hijos se
  convierten al mismo nivel. Se pierde la envoltura visual, no el contenido.
- **`status` de los cursos importados → `'done'`** (decisión del usuario): es material ya
  estudiado. No afecta la cola de repaso.
- **`read_log` se destruye al re-correr.** El DELETE de `notes` cascadea a `read_log`
  (`0001_initial_schema.sql:34`), que CONTEXT.md declara que nunca se borra. Como el import se
  corre pocas veces y en la primera corrida no hay historial, se dejó el comportamiento y se
  agregó una advertencia explícita al gate de confirmación. Pendiente si el import se vuelve a
  correr con repasos ya acumulados.

Findings desestimados tras verificar:

- "Los 59 cursos entran `active` e inundan la cola de repaso" — **falso**. `review_queue()` no
  filtra por status (comentario explícito en `0003_derived_queries.sql:6`) y tiene `limit 3`. El
  glosario de CONTEXT.md ("Cola de repaso — notas de cursos `active`") está desactualizado contra
  la migración.
- "Un doc Tiptap con `content: []` rompe el editor" — **falso**, verificado con un test de render:
  Tiptap lo tolera. No se agregó normalización.

Riesgo abierto (no accionado): `findCoursesDataSource` (`index.ts:33`) toma el primer match de un
search difuso por nombre. Hoy no es ambiguo porque la integración ve poco; si se comparten más
DBs, conviene fijar el ID.
