# 03 — RLS policies

Status: ready-for-agent

## Qué

RLS habilitado en las 3 tablas, con policy `auth.uid() = user_id` para select/insert/update/delete.

El aislamiento de datos depende 100% de esto (ADR 0001) — es requisito, no extra.

## Aceptación

- RLS **enabled** en `courses`, `notes`, `read_log`.
- Un usuario solo ve/modifica sus propias filas (`user_id = auth.uid()`).
- Verificado: sin sesión, las 3 tablas devuelven 0 filas.
