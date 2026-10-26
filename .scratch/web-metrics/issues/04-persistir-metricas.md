# Persistir métricas (DECISIÓN, no implementar aún)

Status: wontfix

## Pregunta

¿Vale una tabla `metrics` en Supabase (RLS, solo el dueño) o alcanza con 01–03 + Lighthouse manual?
Persistir aporta tendencia en el tiempo y datos de dispositivo real (móvil, ver `.scratch/mobile`);
cuesta una migración, un `Store` method más (hoy son seis) y ruido en `localStore`.

## Criterio para decidir

Hacerlo solo si, con la línea base de 01, aparece una métrica cerca del umbral o sospecha de
regresión en móvil. Si todo está verde, cerrar como `wontfix`.

## Comments

**2026-10-26 (grill):** wontfix. Sentry persiste errores y Cloudflare Web Analytics persiste vitals
de dispositivo real. Una tabla propia sería migración + método de `Store` para lo mismo.
