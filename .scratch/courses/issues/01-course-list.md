# 01 — Lista de cursos

Status: ready-for-agent

## Qué

Pantalla que lista los cursos del usuario: nombre, `status`, `started_at`, `finished_at`.

## Aceptación

- Filtra `deleted_at is null` — los cursos borrados no aparecen.
- Muestra los 3 estados (`active` / `paused` / `done`) de forma distinguible.
- Ordena de forma estable (ej. `active` primero, luego por `created_at`).
