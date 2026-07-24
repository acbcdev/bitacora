# 02 — Migración de schema (3 tablas + FK)

Status: ready-for-agent

## Qué

Una migración con las 3 tablas del schema frozen (ver `CONTEXT.md`):

```sql
courses(id, user_id, name, status, started_at, finished_at, deleted_at, created_at)
  -- status: 'active' | 'paused' | 'done'
notes(id, user_id, course_id, title, content, position, deleted_at, created_at)
read_log(id, user_id, note_id, read_at)
```

- FK: `notes.course_id uuid references courses(id) on delete set null`.
- `deleted_at timestamptz` en `courses` y `notes` (soft delete, ADR 0002). `read_log` no tiene
  `deleted_at` — nunca se borra.
- `user_id` en las 3 tablas (para RLS, issue 03).

## Aceptación

- Las 3 tablas existen con la FK y las columnas exactas de arriba.
- `read_log` no tiene columna de borrado.
