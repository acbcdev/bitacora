# Core Web Vitals visibles en dev

Status: needs-triage

## Qué

Agregar `web-vitals` (única dependencia nueva) y loguear LCP/INP/CLS/TTFB con `console.table`
**solo en `import.meta.env.DEV`**. Una función en `src/main.tsx` o `src/core/lib/vitals.ts`.

## Aceptación

- `pnpm dev` + navegar → tabla con las 4 métricas en consola.
- No corre en build de producción (verificar que el chunk no crece > 3 KB gz).

## Salida

Línea base escrita en `spec.md` (sección "Línea base") para decidir si hay split por ruta.
