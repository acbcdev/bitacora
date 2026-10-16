# ADR 0025 — Cola one-by-one: toda la cola congelada en el cliente, contenido de a una

**Status:** Accepted
**Fecha:** 2026-10-16
**Enmienda:** ADR 0012 y ADR 0020 — muere el batch de 3 y `loadMore()`; el resto de la Sesión de repaso sigue en pie.

## Contexto

Repaso servía un batch de 3 (`REVIEW_BATCH`) y al terminarlo mostraba "Batch terminado · Cargar más": un corte cada tres notas, leídas o salteadas. Además el título salía del Snapshot (instantáneo) y el extracto de `store.note(id)` (un roundtrip después), así que la card se pintaba en dos tiempos.

## Decisión

- La Sesión congela **toda** la Cola de repaso al entrar (`reviewQueue` sin límite) y la recorre de a una. Sin tope, sin pantalla de batch: el usuario corta cuando quiere. La pantalla de fin sólo aparece si se agota la cola.
- El contenido se pide **de a una** con `store.note(id)`, con prefetch de la siguiente. La card pinta título y extracto juntos desde la nota completa. Si la nueva todavía no llegó, queda la anterior visible.
- Vistas = el índice más alto alcanzado + 1 (`max`). Con la cola congelada, las notas vistas son siempre el prefijo `frozen[0..max]`: no hace falta un array `seen[]` aparte. La posición es `i / vistas`, oculta mientras `vistas === 1`. `←` baja el índice sin achicar `max` y sin pedir nada (las notas siguen en cache, query `["note", id]`). El prefetch no cuenta.
- Ver una nota ≠ marcarla leída: la idempotencia de marcar vive en `markedIds` (por sesión), no en las vistas. Volver con `←` a una nota salteada permite marcarla.
- Orden: el de la Cola de repaso, sin cambios (más vieja primero, nunca-leídas por `created_at`), flashcards incluidas.
- `DAILY_GOAL` queda como métrica de Hoy, no corta el flujo.

## Alternativas descartadas

- **RPC `review_queue(exclude_notebook_id, exclude_note_ids)`** (el diseño viejo de "Cola one-by-one"): el orden ya se deriva del Snapshot en el cliente (ADR 0011), así que un endpoint nuevo en dos adapters no aporta nada.
- **Re-derivar la cola en cada advance**: marcar leído reordena la cola abajo del usuario. Es el bug por el que ADR 0012 congela.
- **Intercalado forzado de notebooks**: el usuario prefiere el orden por `created_at` tal cual.
- **Columna `excerpt` / `content` en el Snapshot**: la primera es un agregado denormalizado (ADR 0003) y la segunda es el 99% del peso. El prefetch de 1 resuelve la latencia sin cambiar la DB.
- **`seen[]` como array (back-stack)**: con la cola congelada duplica `frozen` y el cache de react-query, y se puede desincronizar (borrar una flashcard, editar una nota). Sólo hace falta si la cola deja de estar congelada.
- **Paginar notas por API + cache local** (`.scratch/notes-pagination/issues/01`): no había problema de peso; el issue se descartó.
