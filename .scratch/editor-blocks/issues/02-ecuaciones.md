# Ecuación (inline y bloque)

Status: ready-for-agent

## Qué

`@tiptap/extension-mathematics` + `katex@^0.18` (el peer range no cubre 0.19). Import estático:
cae en el chunk lazy del editor. Input rules default: `$$x$$` inline, `$$$x$$$` bloque. `/ecuacion`
inserta bloque.

## Aceptación

- Escribir `$$e^{i\pi}+1=0$$` renderiza; clic edita el LaTeX; error de sintaxis muestra el texto,
  no rompe.
- `pnpm build`: katex fuera del chunk main. Medir antes/después con `.scratch/web-metrics`.
- Export `.md` emite `$…$` / `$$…$$`.
- Parse al pegar: `$$…$$` en línea propia = bloque; `$…$` inline solo con regla pandoc (sin espacio
  tras el `$` de apertura ni antes del cierre, sin dígito tras el cierre). Test: "cuesta $5 y $10"
  queda texto. Round-trip en tests.

## Comments

**Review 2026-10-18** — errores de la implementación anterior:

- **Bug (ADR 0018):** `plainInline()` solo lee `n.text` y `plainBlock()` no tiene caso `blockMath`
  → las Ecuaciones DESAPARECEN del extracto de las tarjetas de Repaso. Emitir el `latex` del attr.
- **Bug round-trip:** export escribe `$$latex$$` en una línea, pero `BLOCK_MATH_RE`
  (`/^\$\$([^$]+)\$\$\s*$/`) parsea línea por línea → LaTeX multilínea (`\begin{aligned}…`) no vuelve
  como bloque. Colapsar `\n` al exportar (o parser multilínea). Test con LaTeX multilínea.
- Falta la medición `pnpm build` antes/después con `.scratch/web-metrics` (la estructura lazy estaba
  bien, pero sin número).
- `@tiptap/extension-mathematics` quedó pinneado exacto (`3.31.3`) vs `^` del resto, sin razón.
- `window.prompt("LaTeX")` duplicado en `editor.tsx` y `slash-menu.tsx`: un solo helper.
- `$$x$$` en medio de una línea al pegar queda texto literal — confirmar que es lo esperado.
