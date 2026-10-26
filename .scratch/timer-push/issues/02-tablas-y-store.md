# Tabla `push_subscriptions` + `store.setTimerAlarm`

Status: ready-for-agent

## Qué

- Migración `0015_timer_push.sql`: `push_subscriptions(endpoint PK, user_id default auth.uid(),
  p256dh, auth, fire_at timestamptz null, body text null, created_at)`, RLS solo-dueño.
- Store (seam único, ninguna pantalla importa supabase-js): **un** método,
  `setTimerAlarm(sub, alarm: { fireAt, body } | null)` — upsert por `endpoint` de la fila completa;
  `null` deja `fire_at`/`body` en null.
- `auth.signOut` borra la fila del endpoint de este device (si hay subscription) antes de cerrar
  sesión: otra cuenta en el mismo browser chocaría con RLS y la vieja seguiría recibiendo alarmas.
- `localStore`: `setTimerAlarm` no-op.
- Tests de RLS en `supabase/tests/` como las tablas existentes.

## Hecho cuando

- Otro usuario no ve ni pisa la fila de un endpoint ajeno (test RLS).
- `setTimerAlarm` dos veces con el mismo endpoint deja UNA fila; con `null` queda `fire_at` null.
- `signOut` deja el endpoint sin fila.
