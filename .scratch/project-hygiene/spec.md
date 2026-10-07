# Project Hygiene

**Status:** auditado 2026-10-01. Riesgo/infraestructura, no features — nada de esto bloquea nada de `.scratch/*` salvo el flaky (rotea pre-commit).

## Origen

Auditoría de puntos a mejorar sobre sandbox limpio (lint ✅, typecheck ✅, 287/287 tests ✅ en 2ª corrida). Hallazgos ordenados por impacto.

## Resumen

| #   | Hallazgo                                                                        | Labor sugerida                   |
| --- | ------------------------------------------------------------------------------- | -------------------------------- |
| 01  | Test flaky en emoji-picker (falla 1 de 2 corridas)                              | bloquea pre-commit en falso      |
| 02  | Sin CI (no hay `.github/workflows`)                                             | `--no-verify` pasa desapercibido |
| 03  | Secretos de servicio (`SERVICE_ROLE`, `NOTION_TOKEN`) en el `.env` que lee Vite | riesgo de filtración             |
| 04  | `block-controls.tsx` 826 líneas y creciendo                                     | dividir                          |
| 05  | Pre-commit corre la suite completa (~30s)                                       | invita a `--no-verify`           |
| 06  | Cero e2e (sin Playwright)                                                       | flujos críticos solo en jsdom    |
| 07  | `preset-icons.ts` (1.5K) + `emojis.ts` (1.3K) en el bundle inicial              | import() dinámico                |
| 08  | main va 33 commits ahead de origin                                              | sin respaldo                     |
| 09  | Diff sin commitear grande (+399 en block-controls, ADRs sin trackear)           | acumulación                      |

## No hacer

- Nada de esto merece librería nueva ni refactor grande salvo 04 (y ese, solo si el próximo feature vuelve a tocar ese archivo).

## Decisiones (grill 2026-10-06)

Objetivo: dejar features pulidas ANTES de pushear. Push (08) es el cierre, no el arranque.

**Orden:** 01 → 05 → 02 → 06 → 08.

- **01:** `notebook-create-note` arreglado (SELECT_MS 1000). `outline` e `icon-picker` anotados sin causa probada, a atacar si reaparecen en CI.
- **09:** ya resuelto (git clean, ADRs y `.scratch/` trackeados). Cerrar.
- **08:** hoy 17 commits ahead (el "33" estaba viejo). Va al final; correr `pnpm test` a mano antes del push.
- **05:** se acepta el riesgo de pre-commit sin tests hasta el primer CI verde.
- **02:** workflow del issue casi tal cual; no se puede validar hasta el push.
- **03:** nadie lee `SERVICE_ROLE`/`NOTION_TOKEN` (import de Notion ya resuelto). Se reduce a borrar ambas del `.env` + revocar el token en Notion. Sin `.env.server`.
- **06:** se hace antes del push. Un solo spec, modo localStorage en puerto aparte (5199), fuera de CI. Ver issue.
- **07:** wontfix (ver issue). Medido: ambos módulos ~14.5 KB de 595 KB gzip.
- **04:** sin cambios, criterio del issue (solo si el próximo feature toca el archivo).

## Nota: recursos pesados candidatos a lazy (sin issue)

Medido en `pnpm build` 2026-10-06: **un solo chunk, 1.94 MB / 595 KB gzip**; PWA precachea ~2 MB.
Si el primer load empieza a doler, la palanca real es split por ruta (`React.lazy` por pantalla),
no por datos estáticos. No hacer hasta que duela.
