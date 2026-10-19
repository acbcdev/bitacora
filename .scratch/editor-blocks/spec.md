# Editor: bloques nuevos (desplegable, ecuación, callout)

**Status:** ready-for-agent — grill 2026-10-18.

## Origen

El slash menu hoy ofrece: H1–H3, viñetas, numerada, to-do, cita, código, divisor, tabla, imagen
(`src/core/components/slash-menu.tsx`). Faltan los bloques que más se usan al **estudiar**:
contenido plegable, fórmulas y notas al margen. Vocabulario: **Desplegable**, **Ecuación**,
**Callout** (ver `CONTEXT.md`).

## Restricción de diseño (ADR 0018)

**El JSON de ProseMirror es la fuente de verdad; markdown es best-effort.** Nodo nuevo = persiste
solo en `notes.content` sin migración. En `tiptap-markdown.ts` cada nodo nuevo necesita su caso en
`block()`/`parseBlocks()` o degradar. Sin HTML embebido en el export.

## Scope, en orden de entrega

| #  | Bloque      | Cómo                                                                     |
| -- | ----------- | ------------------------------------------------------------------------ |
| 01 | Desplegable | `@tiptap/extension-details` (MIT). `> ` + espacio o `/desplegable`.       |
| 02 | Ecuación    | `@tiptap/extension-mathematics` + `katex@^0.18` (MIT). Cubre sub/super.   |
| 03 | Callout     | Nodo propio, 3 tipos (nota/aviso/tip) por ícono lucide, fondo gris suave.|

## Decisiones del grill

- **`> ` + espacio = Desplegable** (estilo Notion). La cita pierde su input rule y queda solo por
  `/cita`. Pegar markdown con `> ` sigue dando cita (parser ≠ input rule).
- **Abierto/cerrado del Desplegable no se guarda** (`persist: false`, default): plegar al leer no
  ensucia el doc ni dispara autosave (ADR 0021).
- **KaTeX import estático.** El editor ya vive en chunks `lazy()` (`Note`, `Notebook`,
  `NoteDialog`), así que KaTeX no toca main. Sin nodeView propio para lazy-load. Se reabre si el
  chunk del editor duele medido.
- **Input rules de Ecuación = defaults de la extensión** (`$$x$$` inline, `$$$x$$$` bloque). Sin
  `$x$` al tipear: "cuesta $5 y $10" se comería el texto.
- **Sub/superíndice no existe como formato**: se escribe como Ecuación (`H_2O`, `x^2`).
- **Callout ≠ cita**: nodo propio, no blockquote con attr. Sin color propio (ADR 0023): el tipo lo
  dice el ícono lucide (`Info` / `TriangleAlert` / `Lightbulb`), nunca emoji: `docs/design-system.md`
  "Íconos siempre SVG (lucide), nunca glifos" (review 2026-10-18).
- **No splitear `block-controls.tsx` antes.** Solo si el diff real lo toca, en ese mismo PR.

## Riesgos

- Flashcards (fuera de scope, van con el modo IA, `.scratch/ai-sidebar`): `extractText` de
  `supabase/functions/generate-flashcards` solo lee `node.text`; las Ecuaciones guardan el LaTeX en
  el attr `latex` → desaparecen del input al LLM. Emitir `$latex$` cuando se haga.
- PWA precachea ~2 MB; KaTeX suma ~80 KB gz al chunk del editor. Medir con `.scratch/web-metrics`.

## No hacer

- Links nota a nota (`[[`): spec propio si importa. Embed de video: descartado.
- Sin editor de ecuaciones WYSIWYG: LaTeX en texto, render en vivo.
- Sin columnas, bases de datos ni bloques sincronizados estilo Notion.
- Sin selector de ícono custom en el Callout.

## Comments

**Review 2026-10-18** (`/code-review` sobre `66c7680..c278a84`; se re-implementa):

- Commitear el spec ANTES de implementar: los commits siguieron este spec editado mientras en git
  seguían los drafts `needs-triage`.
- ADR 0018 tiene **tres** recorridos en `tiptap-markdown.ts` — `block()` (export), `plainBlock()`/
  `plainInline()` (extracto de Repaso) y `parseBlocks()` — cada nodo nuevo necesita caso en los tres.
  La implementación anterior olvidó el extracto plano para Ecuación (ver issue 02).
- Strings de nodo (`"details"`, `"callout"`…) repetidos entre `block-controls`, extensiones y
  `tiptap-markdown`: usar `Ext.name` o una constante exportada.
