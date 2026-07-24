# 02 — Crear / editar / borrar curso (soft delete)

Status: ready-for-agent

## Qué

- Crear curso: nombre, `status` inicial, `started_at` opcional.
- Editar: nombre, status, fechas. Pasar a `done` setea `finished_at`.
- Borrar: **soft delete** → set `deleted_at = now()`. Nunca `DELETE` (ADR 0002).

## Aceptación

- Borrar un curso lo saca de la lista pero **no borra sus notas** (siguen en DB con su `course_id`).
- `user_id` se setea en el insert (RLS lo exige).
- No existe ningún path que ejecute un `DELETE` real sobre `courses`.
