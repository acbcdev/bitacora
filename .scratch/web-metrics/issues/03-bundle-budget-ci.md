# Presupuesto de bundle en CI

Status: needs-triage
Blocked by: 01

## Qué

Paso en `.github/workflows/ci.yml` que corre `pnpm build` y falla si el JS gzip principal supera
el presupuesto (propuesta: 650 KB; hoy 595 KB). Script de shell de pocas líneas leyendo `dist/assets`,
sin plugin de Vite.

## Aceptación

- CI rojo si se pasa del presupuesto; el mensaje dice cuánto y cuál es el límite.
- Número del presupuesto vive en un solo lugar.
