# Lazy-load de datos de iconos/emojis (import() dinámico)

**Status:** wontfix

## Problema

`src/notebooks/preset-icons.ts` (1533 líneas) y `src/notebooks/emojis.ts` (1339 líneas)
son ~2.9K líneas de datos estáticos en el bundle inicial. Ambos solo los consume el
icon/emoji picker, que no renderiza en la pantalla inicial (ni en la mayoría de pantallas).

## Fix esperado

En el picker que los importa, cambiar el import estático por `import()` dinámico
(Vite genera chunk aparte y lo resuelve al abrir el picker por primera vez):

- `const { presets } = await import("./preset-icons")` en el efecto/handler de apertura.
- Verificar que nada más importe esos módulos estáticamente (`grep -rn "preset-icons\|emojis" src`).
- Confirmar en `pnpm build` que aparecen chunks separados y el main baja.

Riesgo bajo: son datos puros sin side effects.

## Cierre (grill 2026-10-06)

Won't-do. Premisa falsa: `notebook-icon.tsx` importa `PRESET_ICONS` en el render de listas, así que
no es lazy-able. Emojis: 8.5 KB gzip (1.4% del bundle), y `icon-picker` los usa sincrónico.
