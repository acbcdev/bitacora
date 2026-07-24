# Handoff — pulpo (app de gestión de estudio)

**Fecha:** 2026-07-23
**Repo:** `/Users/acbc/Dev/projects/pulpo` — git init hecho, **cero commits, cero archivos**. Greenfield total.
**Estado:** diseño cerrado vía `/grill-me` (17 preguntas). Nada de código escrito todavía.

> No hay PRD/ADR/plan en disco — este doc ES la única fuente de la spec. Al empezar a implementar, considerá volcarla a un `README.md` en el repo.

---

## Problema que resuelve

El usuario ya usa Notion para notas de cursos y funciona bien para **escribir**. Lo que Notion NO hace y duele:

- No trackea cuándo empezó un curso, cuánto tardó, cuál está pausado/abandonado
- Contadores de repaso por nota los lleva a mano
- No hay cola de "qué leo hoy" (lee 2–3 notas/día como hábito)
- La interfaz lo hace **sentirse lento** — pocos shortcuts, mucho mouse

**Volumen:** 59 cursos, ~25 notas por curso ≈ **1.500 notas**, crecimiento lento (una nota por clase).
Dato clave: son datos CHICOS. Sin FTS, sin scoring, sin índices exóticos.

---

## Spec cerrada

**Stack:** Vite + React + **Tiptap** (MIT) + **Supabase** (Postgres + Auth + RLS) → **PWA** en Cloudflare Pages. $0, sin servidores propios.

### Schema

```sql
courses(id, user_id, name, status, started_at, finished_at, deleted_at, created_at)
  -- status: 'active' | 'paused' | 'done'
notes(id, user_id, course_id, title, content, position, deleted_at, created_at)
read_log(id, user_id, note_id, read_at)
```

- FK real: `course_id uuid references courses(id) on delete set null`
- **Soft delete**: `deleted_at timestamptz` en `courses` y `notes`. La app NUNCA hace `DELETE`. Toda query filtra `.is('deleted_at', null)`.
- Borrar curso NO toca sus notas (quedan linkeadas, desaparecen de UI por el JOIN, se restauran juntas).
- `read_log` nunca se borra — es el historial de hábito.
- Cleanup manual, después, desde el SQL editor: `delete from notes where deleted_at < now() - interval '30 days'` (idem courses). Sin cron, sin Edge Function.
- RLS: `auth.uid() = user_id` en las tres tablas.

### Todo derivado, nada guardado

Progreso del curso (`notas leídas / total`), `read_count` por nota, racha diaria, "leídas hoy" → todo sale de `COUNT(*)` sobre `read_log`.

### Cola de repaso

```sql
select * from notes n
join courses c on c.id = n.course_id
where c.status = 'active' and n.deleted_at is null and c.deleted_at is null
order by (select max(read_at) from read_log where note_id = n.id) asc nulls first
limit 3;
```

### Pantallas (3, y solo 3)

1. **Repaso** — la que abre 2–3×/día. Nota grande. `Space` = marcar leído (insert en `read_log`) + siguiente. `J/K` = saltar sin contar.
2. **Cursos** — lista con estado, progreso derivado, fechas.
3. **Nota** — editor Tiptap.

**Auth:** magic link (default Supabase, cero código).

### Orden de construcción

1. Supabase: schema + RLS + magic link
2. Cursos CRUD (carga manual de 3–5 activos) → **ya usable**
3. Editor de notas (Tiptap)
4. Repaso + `Space` → **loop diario andando**
5. **Botón export a `.md`** ← NO negociable
6. Importer de Notion (los 59 cursos) ← bloqueado, ver abajo

### Fuera del MVP (decisión explícita, no olvido)

`goals`/metas · stats y gráficos · búsqueda · tags · offline-first · sync engine

`goals` se diseñó y se descartó a propósito: se mira 1×/semana, es una tabla + CRUD de 2h **después** de que el loop diario ande.

---

## Decisiones descartadas (NO reabrir sin razón nueva)

| Descartado | Por qué |
|---|---|
| Plugin de Obsidian | Usuario eligió app propia web |
| Editor.js | Es la misma arquitectura de bloques de Notion — reconstruiría lo que odia. Sin markdown, lock-in de JSON propio |
| CodeMirror 6 | Ofrecido como alternativa más liviana; usuario eligió Tiptap (WYSIWYG) |
| Electron | 150MB, sin razón en 2026 |
| **Offline-first / sync engine** | Usuario solo **repasa** en el celu, online. Supabase/Turso/D1 como "offline-first" fue investigado: Supabase y D1 **no lo traen**, Turso sí (`@tursodatabase/sync-wasm`, beta). Nada de esto se necesita |
| Turso / D1 | Ninguno trae auth. Turso desde browser expondría el token = DB entera comprometida. Supabase gana por auth + RLS = **cero backend propio** |
| VPS / server propio | Usuario lo rechazó explícitamente |
| SQLite local / Dexie / IndexedDB | Muerto al elegir backend hosted |
| FK soft (sin constraints) | Se argumentó: sin FK, notas huérfanas desaparecen de la UI silenciosamente. Se acordó `ON DELETE SET NULL` + soft delete |
| Migración parcial de Notion | Usuario quiere migrar **todo** (los 59 cursos), no solo los activos |

**Tiptap pricing (verificado):** el editor es **MIT y gratis para siempre**. Lo pago es Tiptap Cloud (colaboración, comentarios, AI, hosting de documentos) — nada de eso se usa acá. El usuario preguntó por esto; si vuelve a surgir, la respuesta ya está.

**Supabase free tier:** 500MB DB (sobra 100× para ~1.500 notas markdown), 50k MAU. Se pausa a los 7 días sin actividad — no-issue en una app de uso diario.

---

## Bloqueante único

El **paso 6 (importer)** necesita el export real de Notion. Se le pidió al usuario:

```
Notion → DB de cursos → ••• → Export
Format: Markdown & CSV · Include content: Everything · Create folders for subpages: ON
```

Estructura conocida: **una DB de cursos; cada curso contiene una DB inline de notas.** Exporta como carpeta por curso + `.csv` de propiedades + un `.md` por nota. Los nombres de columnas reales **no se conocen todavía** — no escribir el parser adivinando.

Sugerencia dada: exportar UN curso típico alcanza para diseñar el parser (2MB vs 200MB).

**Pendiente sin resolver:** los 59 cursos probablemente **no tienen `started_at`** en ningún lado. Propuesta hecha, sin confirmar: usar el `created_time` de Notion como aproximación + flag `imported=true` para marcar fechas estimadas.

**Los pasos 1–5 no dependen de esto. Se puede arrancar ya.**

---

## Próximo paso

El usuario fue preguntado "**¿arranco con el paso 1 (schema + RLS + auth)?**" e invocó `/handoff` en vez de responder. **Confirmar antes de escribir código.**

---

## Contexto del usuario (importante para el tono)

- `~/.claude/CLAUDE.md`: **spanglish**, directo/confrontacional, sin filtro. Si el usuario se equivoca → explicar POR QUÉ con evidencia. Si el agente se equivoca → reconocerlo con pruebas. Nunca acordar sin verificar ("dejame verificar" + chequear código/docs). Siempre proponer alternativas con tradeoffs.
- **Simplicity first**: mínimo código que resuelve el problema. Nada especulativo.
- Hooks activos en sesión: **ponytail** (full) + **caveman** (full).
- El usuario ya empujó dos veces hacia over-engineering (offline-first, sync engines). Se lo frenó con datos. **Esperar que vuelva a pasar** — sostener la línea con evidencia, no con opinión.

## Suggested skills

- **`ponytail`** — ya activo por hook. Mantener. El riesgo principal de este proyecto es scope creep hacia sync/stats/goals antes de que el loop diario funcione.
- **`caveman`** — ya activo por hook (prosa terse, sustancia técnica intacta).
- **`claude-api`** — solo si aparece cualquier feature de IA. Hoy no hay ninguna en scope.
- **`verify`** — antes de commitear el flujo de repaso (`Space` → `read_log` → siguiente nota). Es lógica no trivial con efecto en datos.
- **`code-review`** — sobre el importer de Notion cuando se escriba: es el código con más riesgo de corromper 1.500 notas.
- **`init`** — cuando haya estructura real, generar `CLAUDE.md` del repo.
- **NO usar** `dataviz` en el MVP — stats y gráficos están explícitamente fuera de scope.

## Sensible

Nada de credenciales en esta conversación. Cuando se configure Supabase: la `anon key` va en `.env` (es pública por diseño, protegida por RLS), la `service_role key` **nunca** en el cliente ni en el repo. `.gitignore` con `.env` desde el primer commit.
