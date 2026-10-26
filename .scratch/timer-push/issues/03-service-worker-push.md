# Service worker custom con handler de `push` + suscripción al play

Status: ready-for-agent
Blocked by: 01, 02

## Qué

- `vite-plugin-pwa` de `generateSW` (default) a `injectManifest` con `src/sw.ts`: precache de
  workbox igual que hoy + `push` → `showNotification("Bitácora", { body, tag: "habit-timer" })` +
  `notificationclick` → enfocar/abrir la app.
- En `startTimer`: `await` del permiso; si queda `granted`, `getSubscription() ?? subscribe()` con
  `VITE_VAPID_PUBLIC_KEY`. Idempotente en cada play (se auto-repara si el browser rotó la
  subscription). La subscription se la pasa a `setTimerAlarm` (issue 05) — no hay
  `savePushSubscription` aparte.
- `finishTimer`: agregar `tag: "habit-timer"` a la notificación local (dedupe con el push).

## Hecho cuando

- El autoUpdate sigue andando (deploy nuevo → SW nuevo).
- Push de prueba del spike 01 se muestra vía este SW.
- Dos plays seguidos no crean dos subscriptions.
