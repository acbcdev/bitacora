# Edge Function `send-timer-push` + pg_cron

Status: ready-for-agent
Blocked by: 01, 02

## Qué

- `supabase/functions/send-timer-push/index.ts`: auth por header secreto (no JWT de usuario),
  `update push_subscriptions set fire_at = null, body = null where fire_at <= now() returning *`
  con service role (claim atómico), push a cada fila devuelta, borrar la fila si el push service
  responde 404/410.
- Migración: `cron.schedule` cada 30s → `net.http_post` a la función con el secreto (Vault),
  **sólo si** `exists (select 1 from push_subscriptions where fire_at <= now())`.

## Hecho cuando

- Una alarma con `fire_at` en el pasado se manda UNA vez y queda `fire_at` null (la fila sigue).
- Una subscription muerta (410) se borra.
- Sin alarmas vencidas, el job no invoca la función.
