# ADR 0027 — Agente BYOK: el loop y la key viven en el browser

**Status:** Accepted (2026-11-16). Reemplaza la parte "la AI vive en una Edge Function / key
server-side" de ADR 0010 (§3 y su sección de la key). Las flashcards como `notes` (§1-2) siguen vigentes.

El **Agente** es BYOK: el usuario trae su **Proveedor** y su key, la app no paga tokens. Por eso
el loop LLM ↔ tools corre **100% en el cliente**: las tools ejecutan vía `Store` (cualquier adapter,
con RLS y la siembra de cache intactas), el browser llama **directo** al Proveedor sin proxy propio,
y la key vive en `localStorage`, por dispositivo, y no sale del browser salvo hacia el Proveedor. El
loop usa el AI SDK (`ai` + `@ai-sdk/anthropic` + `@ai-sdk/openai-compatible`), cargado con `import()`
al abrir el Agente.

ADR 0010 ponía la key en el server porque era **la key del dueño**: en el bundle era facturación
abierta. Una key BYOK es del usuario, en su propio browser, con su propio límite de gasto. Esa
razón ya no aplica.

## Considered Options

- **Loop en un server (Worker / Edge Function)**: un server no llega al `localhost` del usuario, así
  que mata los modelos locales. Además obliga a reimplementar el `Store` del lado server y deja
  afuera el modo local.
- **Proxy `/api` en el Worker** (por las regresiones de CORS de OpenAI): la key del usuario pasaría
  por infra propia y no sirve para locales. Se agrega el día que un Proveedor rompa CORS de verdad,
  no antes. OpenRouter cubre a OpenAI mientras tanto.
- **Key en Supabase, cifrada por usuario**: si el cifrado usa una clave que tiene el browser, es
  teatro; si no, hace falta un server que descifre. El modo local no tiene cuenta.
- **Adapters a mano** (Anthropic + OpenAI-compat): 0 KB extra, pero el parseo de tool-calls en
  streaming de dos formatos y el loop multi-step quedan como código propio.

## Consecuencias

- El riesgo de la key es XSS: es el mismo modelo que cualquier web app BYOK.
- Hay que configurar la key en cada dispositivo.
- `supabase/functions/generate-flashcards/` queda muerta (sin llamador desde `efe19b4`) y se borra;
  con eso la app vuelve a no tener superficie server-side.
- El Worker de Cloudflare sigue siendo solo assets.
- `Store.save(entity, input, { create })`: nuevo parámetro opcional para altas con id elegido por el
  cliente. Los Borradores del Agente crean notebooks/notas con el id que el modelo ya vio, y ese
  tiene que ser el definitivo; antes `save` con `id` era siempre una edición. Sin la flag nada cambia.
- Un turno que solo crea (notebooks, notas, hábitos) no se puede deshacer: el Agente no tiene tool
  de borrado, así que las creaciones no tienen inversa y quedan fuera de la pila de undo. Solo se
  deshacen las ediciones (reaplican `before`).
