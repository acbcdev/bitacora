# Spec — Lightbox para imágenes del Editor

**Status:** ready-for-agent
**Feature:** `editor-lightbox`
**Glosario:** `CONTEXT.md` — Note, Snapshot, Outline, Store (sin glosario nuevo — lightbox es UI, no dominio)
**Stack:** Tiptap `Image` + `shadcn/ui` `Dialog` + `Outline` (misma superficie)
**Origen:** `.scratch/backlog/to-grill-backlog.md` #1 — "carrusel para image en los editor cuando hay imagenes hacer mas grande y poder pasar"

## Problem Statement

Las notas pueden tener imágenes (importadas de Notion como nodos `image` con URL externa). Hoy el Editor solo las renderiza inline chicas, sin forma de ampliarlas ni pasar entre ellas. En notas con diagramas o screenshots, el usuario hace zoom del browser o descarga la imagen. Si la nota tiene varias imágenes, no hay navegación entre ellas. El Editor se usa en 3 superficies (Nota standalone, Nota en curso, dialog de Repaso) y ninguna tiene lightbox.

## Solution

Un lightbox overlay: click en cualquier imagen del Editor abre un `Dialog` fullscreen con la imagen ampliada, navegación `←`/`→` entre todas las imágenes de la nota, `Esc` para cerrar, y swipe en mobile. No es carrusel inline dentro del documento. La galería se deriva del `TiptapDoc` (colección de nodos `image`) y no toca el schema. Sin zoom/pan ni caption en v1; sin upload. Funciona en las 3 superficies porque vive en el `Editor` mismo, igual que `Outline`.

## User Stories

1. As a estudiante con una nota con 1 imagen, I want clickear la imagen y verla grande centrada con fondo dimmed, so that pueda leer el diagrama sin hacer zoom del browser.
2. As a estudiante con nota con 4 imágenes, I want dentro del lightbox pasar con `→`/`←` entre ellas sin cerrar, so that no tenga que cerrar y clickear la siguiente.
3. As a usuaria en mobile, I want swipe a la izquierda/derecha dentro del lightbox para pasar de imagen, so that sea usable con una mano.
4. As a usuario con teclado, I want `Esc` cierra, `←`/`→` navega, so that sea keyboard-first (ui-principles).
5. As a usuario en Nota standalone, Nota en curso, o dialog de Repaso, I want el mismo lightbox, so that no haya comportamiento inconsistente según dónde abrí la nota.
6. As a estudiante con nota sin imágenes, I want nada: el Editor no muestra trigger ni ocupa espacio, so that el chrome siga mínimo.
7. As a usuario que abre el lightbox y navega, I want el índice visible (ej. "2 / 4") para saber dónde estoy, so that no me pierda.
8. As a usuario con imagen rota (URL Notion-S3 expirada), I want ver placeholder + alt si existe, so that no quede modal vacío.
9. As a usuaria que hace click fuera del área de imagen (backdrop), I want que cierre igual que `Esc`, so that sea rápido salir.
10. As a estudiante que copia una nota con imágenes, I want que el paste siga funcionando (no confundir click imagen con selección), so that el lightbox no rompa el Editor.
11. As a developer, I want el lightbox no toque el documento Tiptap (no inserta nodos, no cambia `content`), so that no haya migración ni `onChange` espurio.

## Implementation Decisions

- **Overlay, no inline:** `Dialog` de Radix vía `shadcn/ui` (mismo que `Drialog`/`Dropover` pattern). Botón invisible no: el `img` mismo es trigger vía `editorProps.handleClickOn` o `NodeView` wrapper con `onClick`. Se recolectan todas las imágenes del `TiptapDoc` al abrir: `doc.content` traversal `type === "image"` → array `{src, alt}`. Índice inicial es la imagen clickeada. Sin extensión Tiptap nueva, sin `NodeView` complejo.
- **Componente en el Editor:** El lightbox vive en `Editor` (como `Outline`: fuera del `contenteditable` pero dentro del host). Así aparece en las 3 superficies que renderizan nota sin duplicar. No es feature del `Dialog` de Repaso ni del page de Nota.
- **Navegación:** `←`/`→` (y `j`/`k` opcional) ciclan `index = (i+1) % length` con wrap. `Esc` y click backdrop cierran. Swipe horizontal con `touchstart`/`touchend` delta > 40px. No se usa `Carousel` de shadcn para mantener dependencia mínima; es un `DialogContent` con `img` centrada y botones prev/next absolutos.
- **Contenido:** `src` es URL externa de Notion-S3 (no se re-hostea). No hay `store.upload*` en v1. Si `src` falla, mostrar fallback `alt` o icono. No hay zoom/pan ni caption editada; si el nodo trae `alt`, se muestra como texto pequeño debajo.
- **Accesibilidad:** `Dialog` ya trae focus trap y `aria`. Botones prev/next con `aria-label`. Imagen con `alt`. Navegación por teclado testeable.
- **Estilos:** Fondo `bg-background/80 backdrop-blur`, imagen `max-h-[90vh] max-w-[90vw] object-contain` centrada. Índice `mono-dim` arriba. Botones con `variant="ghost"` y `size="icon"`.
- **Sin schema change:** `notes.content` sigue `TiptapDoc` con `type: "image"`. No se añade `gallery` ni `caption`. No se toca `markdownToDoc` ni `blocks-to-tiptap`.
- **Seam elegido:** Uno solo — **Editor** (`tiptap-host` + `Dialog`). Es el seam más alto de UI: todas las notas pasan por él. No se añade seam nuevo (no se extrae `ImageGallery` separado en v1).

## Testing Decisions

- **Qué hace un buen test:** Comportamiento externo: click en imagen abre modal con esa imagen, `→` muestra la siguiente, `Esc` cierra, swipe cambia. No testear clases de `Dialog` ni internals de `handleClickOn`.
- **Qué se testea:**
  - Integración Editor: `editor.test.tsx` — render `Editor` con `TiptapDoc` con 2 imágenes, `userEvent.click` en `img`, verifica `Dialog` visible con `src` correcto, `fireEvent.keyDown("ArrowRight")` verifica segunda imagen, `Esc` cierra. Prior art: `editor.test.tsx` (paste markdown, focusEnd, outline) + `drialog.test.tsx` (swap Dialog/Drawer) + `command-palette.test.tsx`.
  - Unit lightbox: si se extrae `Lightbox` puro, test de navegación circular `0→1→0`, swipe threshold, índice `2/4`. Sin necesidad de Tiptap si se testea aislado con props `images`.
  - Visual: no snapshot de imagen; solo `src` y `alt`.
- **Seam de test:** `render` de `Editor` con `content` sintético (sin Store ni Snapshot). No se necesita `renderApp` completo.
- **Out of test:** `lowlight`, `Outline`, `CodeBlockView` — no se tocan.

## Out of Scope

- Carrusel inline dentro del documento (tira horizontal). Descartado en grill 2026-08-30 Q6=A.
- Zoom/pan (pinch, `+`/`−`, draggable). v2 si se pide para diagramas chicos.
- Caption editable o `figure` con `figcaption`. Solo `alt` read-only si existe.
- Upload de imágenes nuevas desde la app (requiere `Store.upload*` + bucket `course-icons` o nuevo). Hoy solo URLs Notion.
- Descarga / share / copy-image desde lightbox.
- Teclado `j`/`k` si colisiona con `Review` (`J`/`K` mueve notas). Se deja `←`/`→` solo en v1.
- Indicador de thumbnails strip (solo índice textual en v1).

## Further Notes

- Si una nota tiene 0 imágenes, el Editor no registra `handleClickOn` para imágenes (no-op).
- El lightbox debe coexistir con `Outline` (que vive en mismo host). `Dialog` es portal, así que no compite por `z-index` del `ProseMirror`.
- Verificar cuántas notas tienen >1 imagen antes de prometer galería: si son pocas, el prev/next rara vez se usa pero no molesta. Si son muchas, considerar thumbnails en v2.
- Alternativa rechazada: `Tiptap` extension `Image` con `NodeView` + `Carousel` inline. Más código, toca schema, rompe mobile y no sirve para 1 imagen.
