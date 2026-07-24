# Feature: courses

**Blocked by:** foundation

Primer slice usable. Cargando 3–5 cursos activos a mano, la app **ya sirve** para trackear estado
y fechas. No depende de notas ni repaso.

## Scope

- Lista de cursos con `status` (`active` / `paused` / `done`), fechas (`started_at`,
  `finished_at`) y **progreso derivado**.
- Crear / editar / borrar curso. Borrar = **soft delete** (`deleted_at`), nunca `DELETE`.
- Progreso derivado: `notas leídas / total`, calculado con `COUNT(*)` sobre `read_log` (ADR 0003).
  Al inicio da 0/0 hasta que existan notas — está bien.

## Reglas de dominio

- Toda query filtra `deleted_at is null` (ADR 0002). Es el bug más fácil de olvidar → criterio de
  aceptación en cada issue.
- Borrar un curso **no toca sus notas** (quedan linkeadas, desaparecen de la UI por el JOIN).

## Fuera de scope

- Editor de notas (feature `notes`).
- Stats/gráficos de progreso (fuera del MVP, `CONTEXT.md`).

## Issues

- `01` lista de cursos
- `02` crear / editar / borrar (soft delete)
- `03` progreso derivado
