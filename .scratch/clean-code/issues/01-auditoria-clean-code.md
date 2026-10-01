# Auditoría clean-code: hallazgos con evidencia

**Status:** ready-for-agent

## Objetivo

Producir la lista de hallazgos de legibilidad/simplicidad sobre el código propio, **sin tocar código**. Este issue
alimenta el backlog real del goal: cada hallazgo nace como issue propio (02, 03, …) o queda marcado `wontfix` con su
razón. Sin auditoría no hay refactor — "está desprolijo" no arranca nada.

## Pasos

1. **Estado de partida** (registra la salida en el issue): `pnpm lint`, `pnpm typecheck`, `pnpm test`. Si algo arranca
   rojo, ese hallazgo va primero.
2. **Pasada por el orden del spec** (`src/core/store/` → `src/core/components/` → pantallas). Por archivo de >250 líneas
   en `core/components`, nombre qué mezcla (menú de bloques, tabla, imagen — patrón del hygiene #04).
3. Cada hallazgo con: archivo + símbolo, evidencia (duplicación real / nombre que miente / responsabilidad mezclada /
   código muerto / abstracción de una sola implementación), y labor sugerida de una línea.
4. Clasificar: `ready-for-agent` si es mecánico y previsible; `needs-triage` si cambia firmas o cruza el seam `Store`.

## Criterio

- Cero diffs de código en este issue — solo el informe.
- Hallazgo sin evidencia concreta → `wontfix`, no entra a issues.
- Los hallazgos ya vivos en `.scratch/project-hygiene/` (p.ej. #04 block-controls) se referencian, no se duplican.

## Comentarios

- (pendiente — se registra la salida de lint/typecheck/test en la primera corrida)
