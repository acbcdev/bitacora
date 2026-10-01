# E2E mínimo: smoke del flujo crítico

**Status:** needs-triage

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
