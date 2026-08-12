# Feature: Outline de la nota (rail de headings)

**Status:** ready-for-agent
**Blocked by:** ninguno

Resultado del grill del 2026-08-11 (`/grill-with-docs`). Un rail de ticks en el margen derecho de
la nota que muestra sus headings, marca en cuál estás y deja saltar a cualquiera con un click.

## Problem Statement

Las notas reales son largas y muy seccionadas: sobre las **919 notas** del import de Notion
(`scripts/notion-import/.out/notes.csv`), la mediana tiene **6 headings**, el p90 tiene **17** y la
más larga **56**. El 48% tiene 7 o más. Tamaño de nota: p50 7 KB, máximo 28 KB (hasta 194 bloques).

Hoy no hay forma de ver la estructura de una nota ni de saltar a una sección: solo scroll. En
Repaso —la pantalla que se abre 2–3×/día— eso significa scrollear a ciegas una nota de 25 bloques
para encontrar la parte que querés releer.

## Solution

Un componente `Outline` montado dentro de `Editor`, así aparece en las **3 superficies** donde se
renderiza una nota completa, con una sola integración:

1. `/note/:id` (scroll = `<main>`, `app.tsx:209`)
2. `/course/:id/:noteId` (scroll = `#note-pane` en md+, `<main>` en mobile, `course.tsx:130`)
3. Dialog de Repaso (scroll = div interno `max-h-[85vh]`, read-only, `note-dialog.tsx:101`)

Idle: ticks. Hover/focus: panel con los títulos encima del texto. Click: scroll a esa sección.

## Datos que decidieron el diseño

Medidos sobre las 919 notas del import, no estimados:

| Métrica | Valor | Qué decide |
|---|---|---|
| Notas sin headings | 21% | El outline no se renderiza siempre |
| Con 1 heading | 6% | Umbral: `< 2` headings → no renderiza (27% de las notas) |
| Con 2–6 | 25% | — |
| Con 7+ | 48% | El panel necesita scroll propio |
| Mediana / p90 / max headings | 6 / 17 / 56 | 56 ticks × 8px = 448px: entran hasta en el dialog de 85vh |
| Niveles usados | solo h1, h2, h3 | h4–h6 no existen en datos reales |
| Notas que usan **solo h3** | 160 | Filtrar por nivel tiene costo — ver "Cambio post-implementación" |

## User Stories

1. Como usuario, quiero ver de un vistazo cuántas secciones tiene la nota abierta, para saber si es
   larga antes de empezar a scrollear.
2. Como usuario, quiero ver en qué sección estoy mientras scrolleo, para no perderme en una nota de
   50 secciones.
3. Como usuario, quiero ver los títulos de las secciones al pasar el mouse por el rail, sin tener
   que clickear nada.
4. Como usuario, quiero saltar a una sección clickeándola, para releer una parte puntual en Repaso
   sin scrollear a ciegas.
5. Como usuario, quiero que el outline funcione igual en el dialog de Repaso que en la pantalla
   Nota, para no aprender dos comportamientos.
6. Como usuario, quiero que en las notas cortas o sin secciones no aparezca nada, para no tener
   chrome inútil en pantalla.
7. Como usuario, quiero que clickear el outline mientras escribo no me mueva el cursor ni me
   ensucie el undo, para no perder dónde estaba escribiendo.

## Implementation Decisions

**`src/core/components/outline.tsx` (nuevo):**

- Props: `host: RefObject<HTMLElement>` (el contenedor del editor) y una señal de rescaneo
  (`version: number` o similar) que dispara `Editor` en cada `update`.
- **Fuente de los headings: el DOM.** `host.current.querySelectorAll("h1, h2")` → lista de
  `{ el, level, text }`. Da el elemento al que scrollear sin mapear posiciones de ProseMirror. Ver
  `docs/adr/0007-outline-desde-el-dom.md`.
- **Rescaneo:** debounce 300ms sobre la señal de `Editor`. No hace falta `MutationObserver`: el
  editor ya avisa cuando cambia el contenido.
- `headings.length < 2` → devuelve `null`.
- **Anclaje: `sticky`, nunca `fixed`.** Un div `sticky top-[20vh] h-0` (arranca arriba y crece
  hacia abajo, como el rail de Notion — centrarlo se comía media pantalla) que va **primero** en el
  wrapper, antes de `EditorContent`. `sticky` no puede subir por encima de su posición natural en
  el flujo: si el rail va después del contenido queda pegado abajo para siempre. `h-0` para no
  ocupar espacio del documento.
- **Ticks:** `<button>` por heading, uniformemente espaciados (gap ~8px), ancho por nivel
  (h1 `w-6`, h2 `w-4`), alto 1–2px. Activo `bg-foreground`, resto
  `bg-muted-foreground/40`.
- **Panel:** hermano de los ticks, `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`.
  CSS puro, sin estado ni timers. `max-h-[70vh] overflow-y-auto`, ancho fijo (~240px), abre
  **encima del texto** (a 1280px de viewport quedan ~170px de margen contra un texto de `80ch`,
  `index.css:51` — no alcanza para el panel al costado). Al abrirse, `scrollIntoView` del ítem
  activo dentro del panel.
- **Activo:** un `IntersectionObserver` sobre los headings; gana el último que cruzó el borde
  superior. Misma lógica editando que leyendo — una sola fuente de verdad.
- **Click:** `el.scrollIntoView({ behavior: "smooth", block: "start" })`. Nada más: no mueve el
  caret, no toca el documento. `onMouseDown` con `preventDefault` para no robarle el foco al editor.
- **`prefers-reduced-motion`:** cae a `behavior: "auto"`.
- **Responsive:** `hidden md:block` — en touch no hay hover y no hay margen.
- Focus mode: aparece normalmente (es lectura pura, es donde más sirve).
- h3–h6: no entran al rail (ver "Cambio post-implementación").

**`src/core/components/editor.tsx`:**

- Pasa de devolver `<EditorContent>` pelado a `<div className="relative"><Outline .../><EditorContent .../></div>`.
  El `Outline` va **fuera** del `contenteditable` — adentro de `.ProseMirror` sería contenido
  editable del documento.
- `ref` al wrapper para pasárselo al `Outline` como `host`.
- Emite la señal de rescaneo: en `onUpdate` (ya existe) y en el `useEffect` de `setContent` del
  modo lectura (`editor.tsx:84-86`) — en read-only `setContent` no dispara `onUpdate`.
- No cambia ninguna prop pública: las 3 superficies lo reciben sin tocar `note.tsx`,
  `course.tsx` ni `note-dialog.tsx`.

**`src/index.css`:**

- `scroll-margin-top` en `.tiptap-host .ProseMirror h1/h2/h3` (~1rem) para que el heading no quede
  pegado al borde superior del scroller después del salto.

## Testing Decisions

Un solo archivo, `src/core/components/outline.test.tsx`, mismo criterio que `editor.test.tsx`
(comportamiento observable, sin fixtures pesadas):

- N headings en el host → N ticks.
- 1 heading → no renderiza nada.
- Click en el tick k → llama `scrollIntoView` del heading k (spy sobre el elemento).
- El ítem activo refleja lo que reporta el `IntersectionObserver`.

`IntersectionObserver` no existe en jsdom — confirmar si ya hay un stub en `src/test/setup.ts`
(el spec de `keyboard-shortcuts` lo dejó anotado como pendiente); si no, agregarlo ahí, no por
archivo.

## Out of Scope

- **Teclado.** Se grilló y se descartó a propósito: el outline es orientación pasiva + salto
  ocasional con click. Regla 1 de `ui-principles.md` promete shortcut para las acciones
  **frecuentes**, y saltar de sección no está probado como frecuente. Se evaluaron y descartaron:
  par `o`/`mod+o` (patrón de `f`/`mod+f`), grupo "Secciones" en la ⌘K palette (necesita que el
  Shell sepa qué nota está abierta: contexto o registry nuevo), y tecla dedicada + J/K adentro del
  panel. **Se reabre si el uso real muestra que terminás clickeando el rail seguido.**
- **Minimapa proporcional** (ticks posicionados según dónde cae el heading en la altura real del
  doc). Descartado: obliga a medir `offsetTop` y recalcular en cada resize/edición. El rail es una
  lista de espaciado uniforme.
- ~~**Filtrar niveles**~~ — revertido en la implementación, ver "Cambio post-implementación".
- **Ventana alrededor del activo** en el panel (±6 ítems). Descartado: perdés la vista global justo
  en las notas de 56 secciones, que son las que más la necesitan.
- **Mover el caret al saltar.** Descartado: acopla el outline al editor de Tiptap y no aplica en el
  dialog read-only.
- **Auto-hide del rail** (aparece al scrollear, se desvanece a los 1.5s). Descartado: timer +
  estado + listener de scroll para ahorrar unos ticks de 1px.

## Cambio post-implementación (2026-08-11): el rail muestra solo h1/h2

Decisión del usuario después de ver el rail andando, contra la recomendación del spec original.
Medido de nuevo sobre el mismo snapshot (`scripts/notion-import/.out/notes.csv`, 919 notas):

| | |
|---|---|
| Headings por nivel | h1 954 · h2 3045 · **h3 2905 (42%)** |
| Notas con outline hoy (≥2 headings) | 673 |
| Notas que pierden el rail al filtrar | **222** (160 usan solo h3 · 62 caen bajo el umbral de 2) |

O sea: 1 de cada 3 notas con outline se queda sin rail. Se acepta a cambio de un rail más limpio
en las 451 restantes. Se evaluó y se descartó la variante adaptativa
(`top.length >= 2 ? top : todos los niveles`) — es la vuelta atrás si esto molesta en uso real.

## Further Notes

- **Excepción consciente a la regla 4 de `ui-principles.md`** ("no agregar animaciones que metan
  latencia percibida"): el salto es `smooth`, no instantáneo, porque la animación *es* el feedback
  de cuánto te moviste. Se compensa respetando `prefers-reduced-motion`. Si al usarlo se siente
  lento en las notas de 28 KB, cambiar a instantáneo es una palabra.
- El glosario de `CONTEXT.md` no tenía término para esto. Se agregó **Outline** — no "TOC", no
  "índice", no "minimapa".
- Los números de este spec salen de `scripts/notion-import/.out/notes.csv` (snapshot del import de
  Notion). Si el uso real cambia el perfil de las notas —notas nuevas más cortas, por ejemplo—, el
  umbral de `< 2` headings y el `max-h-[70vh]` del panel son los dos que hay que revisar.
