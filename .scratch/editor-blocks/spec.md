# Editor: bloques nuevos (ecuaciones, desplegables y más)

**Status:** needs-triage — borrador 2026-10-08, sin grill.

## Origen

El slash menu hoy ofrece: H1–H3, viñetas, numerada, to-do, cita, código, divisor, tabla, imagen
(`src/core/components/slash-menu.tsx`). Notion —de donde vienen las notas— tiene más. Faltan los
bloques que más se usan al **estudiar**: fórmulas y contenido plegable.

## Restricción de diseño (ADR 0018)

**El JSON de ProseMirror es la fuente de verdad; markdown es best-effort.** Nodo nuevo =
persiste solo en `notes.content` sin migración. En `tiptap-markdown.ts` cada nodo nuevo necesita
un caso en `block()`/`parseBlocks()` o degradar a texto. Aceptar pérdida en export, igual que
color/align.

## Candidatos, ordenados por valor de estudio

| #  | Bloque                  | Cómo                                                        | Costo         |
| -- | ----------------------- | ----------------------------------------------------------- | ------------- |
| 01 | Ecuaciones (inline + bloque) | `@tiptap/extension-mathematics` 3.31.4 MIT (verificado) + KaTeX | KaTeX ~75 KB gz → **lazy** |
| 02 | Desplegable (toggle)    | `@tiptap/extension-details` (MIT, 3.31.4 verificado)         | bajo          |
| 03 | Callout (nota/aviso)    | nodo propio chico o `blockquote` con attr `kind`             | bajo          |
| 04 | Subíndice / superíndice | `@tiptap/extension-subscript` / `superscript` (3.31.4 MIT verificado) (químico, físico) | trivial    |
| 05 | Links de nota a nota    | `[[` + `@tiptap/suggestion` (ya instalado); relaciona con `.scratch/ai-sidebar`? | medio |
| 06 | Embed de video          | `@tiptap/extension-youtube`                                  | bajo, dudoso  |

Recomendación de orden: **02 → 01 → 04 → 03**. 05 y 06 quedan como "ideas" hasta el grill.

## Riesgos

- KaTeX trae CSS y fuentes; el PWA precachea ~2 MB hoy → medir con `.scratch/web-metrics` antes y
  después. Cargar KaTeX con `import()` dinámico solo cuando aparece el primer nodo math.
- `block-controls.tsx` (826 líneas) ya es candidato a split (project-hygiene #04): si estos bloques
  lo tocan, dividirlo **primero**.
- Flashcards se generan desde el contenido de la nota (ADR 0010): definir cómo se manda una
  ecuación / un toggle cerrado a la Edge Function (¿LaTeX crudo? ¿contenido del toggle incluido?).

## No hacer

- Sin editor de ecuaciones WYSIWYG propio: LaTeX en texto, render en vivo.
- Sin columnas, sin bases de datos, sin sincronizados estilo Notion.
