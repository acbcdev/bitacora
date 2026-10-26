# ADR: segunda función serverless + cron para la Alarma del Cronómetro

Status: needs-triage
Blocked by: 01

## Qué

ADR 0027 "Alarma del Cronómetro vía Supabase cron + Edge Function": por qué no Notification
Triggers (nunca salió), por qué no push de terceros, por qué alarma por device (el Cronómetro es
por device), guard `exists` en el cron y costo en free tier. Actualizar CONTEXT.md línea
"**una** función serverless" → dos + cron.
