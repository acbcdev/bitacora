# Activar Cloudflare Web Analytics

Status: ready-for-human

## Qué

El deploy es **Vercel**, no Cloudflare Pages: no hay toggle. Va el snippet JS del beacon, sin
cookies, 0 deps. Código hecho: `initWebAnalytics()` en `src/core/lib/report.ts` lo inyecta solo
si `PROD` + `VITE_CF_BEACON_TOKEN` (mismo guard que Sentry).

## Manual (humano)

- Dashboard CF → Web Analytics → agregar sitio (dominio de Vercel) → copiar el token del snippet.
- Cargar `VITE_CF_BEACON_TOKEN` en las env vars de Vercel y redeployar.

## Aceptación

- Dashboard de CF muestra LCP/INP/CLS tras unos días de uso desde el celular.
- Verificar que las navegaciones SPA (cambio de ruta) se registren; si no, anotarlo acá.
- Con ad-blocker el beacon no carga (igual que Sentry): aceptado.
