# Spike: mandar un Web Push desde una Supabase Edge Function

Status: ready-for-human

## Qué

Probar que una Edge Function (Deno) firma y manda un push VAPID a una subscription real.
Candidatas: `npm:web-push` (usa crypto de Node, puede fallar en Deno) o `jsr:@negrel/webpush`
(nativo WebCrypto). Generar el par VAPID y cargar la private key como secret.

## Hecho cuando

- Un `curl` a la función hace aparecer una notificación en Android Chrome y en iOS PWA instalada.
- Elegida la lib, anotada en el spec.

Humano porque: necesita generar claves, `supabase secrets set` y dos dispositivos físicos.
