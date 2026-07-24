# 02 — CRUD de nota

Status: ready-for-agent

## Qué

- Crear nota dentro de un curso: `title`, `content`, `position`, `course_id`.
- Editar título y contenido.
- Reordenar (`position`) dentro del curso.
- Borrar: **soft delete** (`deleted_at`), nunca `DELETE`.

## Aceptación

- `user_id` y `course_id` seteados en el insert.
- Queries filtran `deleted_at is null`.
- Una nota cuyo curso fue borrado (o `course_id` null) no rompe la UI.
