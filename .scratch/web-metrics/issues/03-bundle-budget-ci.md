# Presupuesto de bundle en CI

Status: ready-for-agent
Blocked by: 01

## Qué

Paso en `.github/workflows/ci.yml` que corre `pnpm build` y falla si algún chunk vigilado supera
su presupuesto gzip. Script de shell de pocas líneas leyendo `dist/assets` (glob por prefijo, los
nombres llevan hash), sin plugin de Vite.

Chunks: `index-*` (entrada) y `note-body-*` (tiptap). Límite = tamaño medido **con Sentry dentro**
(lo anota 01) + ~15%. Pre-Sentry (2026-10-25): `index` 174 KB gz, `note-body` 348 KB gz.

## Aceptación

- CI rojo si se pasa del presupuesto; el mensaje dice cuánto y cuál es el límite.
- Número del presupuesto vive en un solo lugar.
