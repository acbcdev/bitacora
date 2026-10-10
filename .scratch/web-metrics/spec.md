# Web metrics (rendimiento + datos de uso)

**Status:** needs-triage — borrador 2026-10-08, sin grill.

## Origen

Hoy no se mide nada: cero `web-vitals`, cero `PerformanceObserver`, cero analytics (grep en `src/`).
`project-hygiene` midió el bundle a mano (1 chunk, 1.94 MB / 595 KB gzip) y dejó el split por ruta
como "no hacer hasta que duela". Sin números reales, "duele" es una sensación. CONTEXT.md dice que
la app tiene que **sentirse rápida** → hay que medirlo.

## Dos ejes (no mezclar)

| Eje          | Pregunta                                       | Dónde se guarda          |
| ------------ | ---------------------------------------------- | ------------------------ |
| Rendimiento  | ¿Qué tan rápida va? (LCP, INP, CLS, TTFB, save) | consola/dev + tabla chica |
| Uso          | ¿Qué hago realmente? (pantallas, repasos, search) | ya está en `read_log` (ADR 0003) |

## Principios

- **Uso personal, 1 usuario.** Nada de Sentry/PostHog/GA. Un servicio de terceros es overkill y
  filtra datos de estudio. Si hace falta persistir: tabla en Supabase con RLS, como todo lo demás.
- **Datos CHICOS** (CONTEXT.md). Sin pipelines, sin agregaciones exóticas.
- Primero **ver** (dev overlay / consola), después persistir, solo si lo visto lo justifica.
- Medir lo que el usuario siente: abrir nota, autosave, cola de repaso, cambio de pantalla.

## Alcance candidato (ver issues)

1. Core Web Vitals en dev (`web-vitals` 6.2.3, Apache-2.0, ~2 KB) → `console.table`.
2. `performance.mark/measure` en flujos propios (abrir nota, guardar, snapshot).
3. Tamaño de bundle trackeado en CI (falla si crece > X%).
4. Tiempo de `snapshot` y tamaño de payload de Supabase (el seam `Store` es el punto único).
5. Persistir métricas (decisión abierta).

## No hacer

- Sin servicio externo. Sin cookies/consent banner (no hay terceros).
- Sin dashboard propio hasta que haya datos que justifiquen uno.
- Sin split por ruta como parte de este feature: este feature **decide** si hace falta.

## Preguntas abiertas (para grill)

- ¿Persistir en Supabase o basta consola + Lighthouse CI manual?
- ¿Cuál es el presupuesto? (propuesta: LCP < 2.0s, INP < 200ms, bundle gz < 650 KB)
- ¿Medir también `localStore` (modo e2e) o solo `supabaseStore`?
