# Timer push (Alarma del Cronómetro con la app cerrada)

**Status:** ready-for-agent — grill 2026-10-25.

## Origen

En mobile (y a veces en desktop) la notificación "Terminaste tus N min" llega recién al volver a la
app. Causa: el auto-finish corre en JS del cliente (`use-habit-timer.ts`), y con la PWA en
background el OS **suspende el JS**. El fix de desktop (timeout al deadline, esquiva el intensive
throttling de Chrome) ya está; no cubre tab congelado ni mobile.

Descartado: **Notification Triggers** (`showTrigger` + `TimestampTrigger`) — es exactamente
"agendar local y matar al pausar", pero el origin trial terminó y nunca salió; solo con flag en
Chrome, cero en Safari/Firefox. Sin JS vivo, la única forma es que **alguien de afuera mande un
Web Push**.

## Diseño

```
play (permiso granted) ──► getSubscription() ?? subscribe()
                       ──► store.setTimerAlarm(sub, { fireAt: deadline, body })   upsert por endpoint
pausa / finish / cambio de hábito ──► store.setTimerAlarm(sub, null)              fire_at = null
signOut ──► delete push_subscriptions where endpoint = <este device>
pg_cron (cada 30s) ──► if exists(fire_at <= now()) ──► pg_net POST ──► Edge Function `send-timer-push`
   update ... set fire_at = null, body = null where fire_at <= now() returning *
   ──► web-push a cada fila devuelta; 404/410 del push service ──► borra esa fila
SW `push` ──► showNotification("Bitácora", { body, tag: "habit-timer" })
```

- **Alarma por device** (grill Q1): el Cronómetro vive en `localStorage`, es por device; la alarma
  también. Va keyeada por `endpoint`, en la misma fila que la subscription. Play en el celu no pisa
  la alarma del desktop, y el push sale sólo al device donde corre el timer. Sin subscription no
  hay alarma.
- **Mismo `tag: "habit-timer"`** en el push y en la notificación local de `finishTimer`: si la app
  estaba abierta y el cron también dispara, el OS reemplaza la notificación, no la duplica. La
  carrera finish-local vs cron NO importa.
- **`update ... returning`** en la función: claim atómico (row lock), dos corridas del cron nunca
  mandan dos veces, y la subscription queda para la próxima alarma.
- **Guard `exists` en el job** (grill Q4): la Edge Function sólo se invoca cuando hay una alarma
  vencida — unas pocas veces por día, no 86k/mes.
- El deadline lo calcula el cliente con la fórmula que ya existe para el timeout de desktop
  (`startedAt + (target − total) * 1000`) y las mismas guardas que `reached` (solo `good`, solo si
  venías por debajo). Sin deadline → `fire_at = null`.
- **Auto-finish clampeado al deadline** (grill Q2): si `reached` dispara tarde (app suspendida,
  reabrís después del push), se escribe hasta el deadline, no hasta `now`. Sin esto, abrir 2h
  después acredita meta + 2h.
- Suscribir en **cada** play con permiso `granted`, idempotente (grill Q3): se auto-repara si el
  browser rotó la subscription. Nada en Settings.
- **Supabase-only**, como flashcards: en modo local `setTimerAlarm` no-opea y queda el
  comportamiento actual.

## Tabla (RLS: solo el dueño, como todo)

| Tabla                | Columnas                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `push_subscriptions` | `endpoint` PK, `user_id`, `p256dh`, `auth`, `fire_at timestamptz` null, `body text` null, `created_at` |

## Store

Un método (grill Q7): `setTimerAlarm(sub: PushSubscription, alarm: { fireAt: Date; body: string } | null)`.
Upsert de la fila completa por `endpoint`; `null` = `fire_at`/`body` en null. El delete del device
vive en `auth.signOut` (grill Q6), no como método aparte.

## Decisiones que rompen CONTEXT.md (→ ADR 0027)

- CONTEXT.md dice "**una** función serverless". Pasa a dos + un cron. Sigue $0: pg_cron, pg_net
  y Edge Functions vienen en free tier; con el guard `exists` las invocaciones son despreciables
  (verificar el límite vigente en el pricing antes del ADR).
- VAPID private key en secrets de Supabase; public key en `VITE_VAPID_PUBLIC_KEY`.

## Límites conocidos (aceptados)

- Precisión ±30s (granularidad del cron).
- iOS: solo con la PWA **instalada** (16.4+). En Safari pestaña no hay push.
- Si el usuario niega el permiso, queda el toast al volver (igual que hoy).
- Supabase free se pausa por inactividad (CONTEXT.md): si está pausado, no hay push.

## No hacer

- Sin servicio de push de terceros (OneSignal, FCM directo): Web Push estándar alcanza.
- Sin notificaciones para otra cosa que el Cronómetro (recordatorios de hábitos, repaso) — otro feature.
- Sin UI de "dispositivos suscritos".
- Sin escritura server-side de `habit_log`: el dato entra al reabrir, como hoy.

## Issues

01 spike web-push desde Edge · 02 tabla + Store · 03 SW custom + suscripción · 04 función + cron ·
05 cablear el timer + clamp · 06 ADR + CONTEXT.md
