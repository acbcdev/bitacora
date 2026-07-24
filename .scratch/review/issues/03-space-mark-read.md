# 03 — `Space` marca leído + siguiente; `J`/`K` saltar

Status: ready-for-agent

## Qué

Keybinds en la pantalla de repaso:

- `Space` → `insert into read_log (note_id, user_id, read_at)` de la nota actual, luego avanzar a
  la siguiente de la cola.
- `J` / `K` → navegar (siguiente / anterior) **sin** insertar en `read_log` (saltar sin contar).

## Aceptación

- `Space` inserta **exactamente una** fila en `read_log` por pulsación y avanza.
- `J`/`K` **no** tocan `read_log`.
- Marcar leído recalcula progreso/racha en la siguiente lectura (todo derivado — ADR 0003).

## Test (no negociable)

Es lógica no trivial con efecto en datos. Dejar **una** verificación runnable que falle si se
rompe: `Space` → cuenta filas de `read_log` +1 y la cola avanza; `J`/`K` → filas de `read_log`
sin cambio. Correr `/verify` antes de commitear este issue.
