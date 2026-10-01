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
