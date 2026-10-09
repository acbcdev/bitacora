# E2E mínimo: smoke del flujo crítico

**Status:** done

## Problema

Cero tests e2e (sin Playwright). Los flujos críticos — login, autosave de nota
(escribir → recargar → está), sesión de repaso — solo están cubiertos por tests de
componente en jsdom, que no ven el autoSave real (tiptap + debounce + store).

## Fix esperado

Un solo smoke e2e, no una suite:

1. `pnpm add -D playwright` (o `@playwright/test`) + config con un solo proyecto (chromium).
2. Un spec: login → crear nota → escribir texto → esperar autosave → recargar → el texto está.
3. Correrlo manual (`pnpm e2e`), no en pre-commit. En CI solo si es estable contra Supabase
   (necesita credenciales de test — decidir ahí si vale la pena o queda local-only).

No agregar más specs hasta que el smoke pruebe su valor.

## Decisiones (grill 2026-10-06)

- **Modo local** (ADR 0011): el spec siembra `bita-storage=local` en `localStorage`
  (`page.addInitScript`). Sin login, sin credenciales, sin cuenta de test. El paso "login" del
  fix esperado se cae.
- **Aislamiento:** `webServer` en puerto propio (`pnpm dev --port 5198 --strictPort`,
  `reuseExistingServer: false`). `localStorage` es por origen y Playwright usa contexto vacío:
  no toca la sesión del dev server normal.
- **Límite aceptado:** cubre editor → draft → `localStore.save` (código compartido, ADR 0015/0021).
  NO cubre `supabaseStore` (red, RLS, target congelado de ADR 0009).
- Local-only, fuera de CI y de pre-commit. Un solo spec.
