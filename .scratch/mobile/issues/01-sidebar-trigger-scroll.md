# Sidebar trigger mobile: se pierde al scrollear

**Status:** needs-triage

## Problema

En mobile el `SidebarTrigger` (`src/app.tsx:239`, `mt-2 ml-2 md:hidden`) vive dentro de `<main>`
**sin `fixed` ni `sticky`**: al scrollear la pantalla queda arriba y hay que volver al tope para
abrir el sidebar. En desktop no importa (teclado/sidebar siempre visible); en mobile es el único
acceso a notebooks/navegación.

El comentario en `app.tsx` lo explica a propósito:

> En flujo normal, no fixed: así no se pisa con el h1 de cada pantalla.

O sea: hacerlo fixed le pisa el h1 de cada pantalla. Hay que decidir dónde vive el trigger cuando
hay scroll:

1. **`fixed` arriba con fondo/backdrop** — cubre el h1 al scrollear (o lo desplaza con padding).
2. **FAB flotante** (abajo a la derecha) — no pisa nada, pero agrega chrome.
3. **Región sticky fina** arriba de la pantalla que colapsa al scrollear.

Requiere decidir también si aparece siempre o con scroll hacia arriba (patrón header que
reaparece).

## Nota

Es el único fix mobile con dolor confirmado antes del trial de `.scratch/mobile/spec.md`. No
bloquea el trial — con esto ya se puede probar el loop en el celu.
