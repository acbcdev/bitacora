# Lightbox de imagen: preview extendido

**Status:** to-do
**Origen:** grill 2026-10-05 · `src/core/components/editor-lightbox.tsx`
**ADR:** ninguno todavía (no hay decisión dura; si el helper de blob crece, ADR 0022)

## Problema

El lightbox solo navega (`←` `→` `Esc`, swipe). Usa `w-auto` + `max-*`, que **achica** pero nunca
**agranda**: una imagen chica (ej. tabla de ~570px) flota en tamaño natural dentro del overlay.
No hay zoom, ni acciones, ni forma de descubrir atajos.

## Decidido en el grill

- **Fit:** la imagen escala hacia arriba hasta llenar el viewport, con tope **2×** (no pixelar).
- **Zoom:** click o `Z` alterna fit ↔ 100%. `+` `-` `0` por pasos y reset. Pan (scroll/arrastre)
  solo cuando hay zoom. Rueda: `ctrl+wheel` / pinch de trackpad = zoom; wheel normal = pan.
- **Navegación:** `←` `→` circular (ya existe), **`1`–`8` salta a la imagen N** (ignora N > count), **`9` salta a la última** (como ctrl+9 en tabs),
  swipe en mobile (ya existe).
- **Toolbar:** pill flotante **abajo-centro**. Zoom −/+/fit con indicador `%`, descargar, copiar. El contador `1 / 3` queda arriba.
- **Atajos de acciones:** `D` descargar, `O` abrir original, `C` copiar. Sin modificadores:
  el lightbox es modal. `cmd/ctrl+C` no se intercepta (copiar texto del alt).
- **Hints:** tooltip con el atajo en cada botón de la toolbar.
- **Alt:** se mantiene debajo de la imagen.
- **Descargar y copiar comparten `fetchBlob(src)`:** los `src` son URL pública de Supabase
  (`notes-images`, cross-origin → `<a download>` solo no sirve) o data URL (`localStore`).
  - Descargar: `blob → URL.createObjectURL → <a download>`.
  - Copiar: `blob → (si no es PNG: canvas → PNG) → navigator.clipboard.write(ClipboardItem)`.
  - Si fetch o clipboard fallan: **toast de error**, nunca fallo silencioso.

## Afuera (YAGNI)

- Strip de thumbnails (3 imágenes por nota; chrome sobre chrome).
- Rotar.
- Pinch-to-zoom en mobile (choca con el swipe horizontal).

## Tareas

- [ ] Fit-to-viewport con tope 2× (CSS/`object-contain`, sin JS si se puede)
- [ ] Estado de zoom (`fit` | escala) + pan; reset al cambiar de imagen y al cerrar
- [ ] Teclas: `Z` `+` `-` `0` `1`–`9` `D` `O` `C` en el `onKey` existente (`useEffectEvent`)
- [ ] `fetchBlob` + `downloadImage` + `copyImage` en `editor-lightbox-utils.ts` (con fallback PNG)
- [ ] Toolbar pill + tooltips con atajos (`src/core/ui`, shadcn Tooltip si ya está instalado)
- [ ] Toast de error en descarga/copia fallida
- [ ] Verificar con `curl -I` que el bucket `notes-images` responde `access-control-allow-origin`
- [ ] Tests (`editor-lightbox.test.tsx`): `1`–`9` salta/ignora fuera de rango, `Z` alterna zoom,
      reset al cambiar imagen, `D`/`C` llaman helpers y toastean en error, `O` abre `src`

## Riesgos

- `ClipboardItem` solo acepta `image/png` → conversión por canvas para JPG/WebP.
- Safari exige que `clipboard.write` ocurra dentro del gesto del usuario: pasar la **promesa** del
  blob a `ClipboardItem`, no hacer `await fetch` antes.
- `C` y `1`–`9` no deben dispararse si el foco está en un input (hoy no hay ninguno en el lightbox).

## Verificación

`pnpm test src/core/components` + `pnpm test` baseline verde + prueba manual con imagen chica,
imagen enorme, 1 imagen (sin `1/N` ni nav) y 3 imágenes.

## Comments
