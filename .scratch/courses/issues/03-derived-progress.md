# 03 — Progreso derivado

Status: ready-for-agent

## Qué

Mostrar por curso: `notas leídas / total`. Nada se guarda — todo se deriva (ADR 0003).

- **Total** = `COUNT` de notas del curso con `deleted_at is null`.
- **Leídas** = notas del curso con al menos una fila en `read_log`.

## Aceptación

- No hay columna `progress` ni `read_count` en la DB — todo sale de queries agregadas.
- Curso sin notas → 0/0 sin romper.
- Notas borradas (`deleted_at`) no cuentan en el total.
