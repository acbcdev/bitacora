# Ecuaciones LaTeX (inline y bloque)

Status: needs-triage

## Qué

`@tiptap/extension-mathematics` + KaTeX. Inline con `$…$`, bloque con `$$…$$` y `/ecuacion`.
KaTeX y su CSS se cargan con `import()` dinámico al primer nodo math (no al bundle inicial).

## Aceptación

- Escribir `$e^{i\pi}+1=0$` renderiza; clic edita el LaTeX; error de sintaxis muestra el texto, no rompe.
- Build: KaTeX en chunk aparte; main no crece > 5 KB gz.
- Export `.md` emite `$…$` / `$$…$$` (round-trip incluido en tests).
- Decidir y testear qué ve `generateFlashcards` (LaTeX crudo).

## Verificar antes de empezar

`@tiptap/extension-mathematics` 3.31.4 MIT (verificado 2026-10-08). Falta confirmar la licencia de KaTeX (MIT) y su peso real en `pnpm build`.
