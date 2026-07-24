# 01 — Query de la cola de repaso

Status: ready-for-agent

## Qué

Implementar la query que arma la cola (ver `spec.md`): notas de cursos `active`, no borradas,
ordenadas por `max(read_at)` ascendente con `nulls first`, `limit 3`.

## Aceptación

- Notas nunca leídas (sin filas en `read_log`) aparecen **primero** (`nulls first`).
- Excluye notas/cursos con `deleted_at`, y cursos que no estén `active`.
- No lee de ninguna columna de contador denormalizada (no existen — ADR 0003).
