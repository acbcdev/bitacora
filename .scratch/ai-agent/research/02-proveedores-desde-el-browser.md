# Research 02: Proveedores y modelos desde una web app

Ticket: `.scratch/ai-agent/issues/02-proveedores-desde-el-browser.md`. Fecha: 2026-11-12.
Contexto: PWA https en Cloudflare, agent loop en el browser, BYOK.

Leyenda: **[doc]** fuente oficial · **[comm]** foro/issue/blog · **[medido]** lo corrí yo · **[inferido]** sin fuente directa, verificar.

## 1. Proveedores cloud llamados directo desde el browser

| Proveedor | ¿Browser-direct OK? | Notas / fuente |
|---|---|---|
| Anthropic (`api.anthropic.com`) | **Sí**, con opt-in | Requiere header `anthropic-dangerous-direct-browser-access: true`; sin él responde 401 "CORS requests must set 'anthropic-dangerous-direct-browser-access' header". SDK oficial lo agrega con `dangerouslyAllowBrowser`. `@ai-sdk/anthropic` **NO** lo agrega solo (grep del dist, v4.0.102) → pasarlo en `createAnthropic({ headers })`. No encontré página oficial que defina el header; anuncio vía [Simon Willison 2024-08](https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access) [comm] + [medido] |
| OpenAI (`api.openai.com`) | **Sí en la práctica, no garantizado** | El API responde CORS (por eso `dangerouslyAllowBrowser` del SDK existe y apps BYOK funcionan). Pero hubo **dos regresiones** donde el preflight rompió: Chat Completions [2025-10-15](https://community.openai.com/t/chat-completions-api-endpoint-down-blocked-any-web-browser-request/1362527) y Responses [2026-01-29](https://community.openai.com/t/has-the-cors-policy-changed-responses-api/1372791); OpenAI las trató como bug y las arregló. No hay compromiso documentado de soportar browser [comm] |
| OpenRouter | **Sí**, el más amigable | Tiene [OAuth PKCE](https://openrouter.ai/docs/use-cases/oauth-pkce) pensado para apps client-side: el usuario se loguea y la app recibe una key ligada a SU cuenta (sin copiar/pegar key), guardada "en el browser del usuario" [doc]. CORS no está documentado explícitamente, pero el flujo PKCE de la doc corre en `window` y llama al API desde el browser [inferido de doc]. Headers opcionales `HTTP-Referer` / `X-OpenRouter-Title` ([overview](https://openrouter.ai/docs/api-reference/overview)) |
| Google Gemini (`generativelanguage.googleapis.com`) | **Sí con fetch directo, ojo con SDKs** | Google [recomienda proxy](https://ai.google.dev/gemini-api/docs/api-key) para apps client-side (riesgo de key) pero no lo bloquea [doc]. Reportes: el endpoint OpenAI-compat falla preflight si mandás headers `x-stainless-*` del SDK de OpenAI ([thread](https://discuss.ai.google.dev/t/gemini-api-cors-error-with-openai-compatability/58619)); el SDK JS de Interactions rompió preflight por un header `api-revision` (2026-07, [thread](https://discuss.ai.google.dev/t/interactions-api-javascript-sdk-403-error-when-running-in-browser-but-raw-fetch-request-works/173241)) [comm]. Usar el endpoint nativo con `x-goog-api-key` |
| Ollama (local) | Sí con config | Ver §2. Default solo permite origins `127.0.0.1`/`0.0.0.0` → hay que setear `OLLAMA_ORIGINS` ([FAQ](https://docs.ollama.com/faq)) [doc] |
| LM Studio (local) | Sí con config | Toggle "Enable CORS" en Developer → Server Settings, o `lms server start --cors` ([CLI docs](https://lmstudio.ai/docs/cli/server-start)) [doc]. Expone API OpenAI-compatible |

Conclusión: los 4 cloud se pueden pegar desde el browser. Anthropic y OpenRouter lo soportan explícito; OpenAI y Gemini funcionan pero con historial de regresiones de CORS → el Agente debe mostrar error claro ("el Proveedor rechazó la llamada desde el browser") y no asumir que es la key.

Riesgo de key: con BYOK la key es del usuario y vive en su browser (localStorage/IndexedDB). El riesgo real es XSS en bitacora → exfiltración. No es el riesgo "key del dueño en el bundle" que protegía ADR 0010.

## 2. Modelos locales (`http://localhost`) desde una página https

Dos capas independientes: **(a) mixed content** (https → http) y **(b) CORS + permiso de red local**.

### (a) Mixed content
- Spec + [MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content): `http://localhost` / `http://127.0.0.1` son origins potencialmente confiables → **no son mixed content** [doc].
- **Chrome / Firefox**: siguen la spec, fetch a `http://localhost:11434` desde https no se bloquea por mixed content [doc + conocido].
- **Safari**: históricamente bloqueaba. [WebKit 279249](https://bugs.webkit.org/show_bug.cgi?id=279249) (localhost bloqueado en Safari 18) se arregló en 2025-03 (`291988@main`). Pero [171934](https://bugs.webkit.org/show_bug.cgi?id=171934) (loopback IPs como `127.0.0.1`) sigue abierto según Anne van Kesteren (2025-03-24). **Usar `http://localhost`, no `127.0.0.1`, y testear en Safari real** — incertidumbre alta.

### (b) Permiso de red local
- **Chrome — Local Network Access (LNA)**: prompt de permiso desde **Chrome 142** (oct 2025) ([blog](https://developer.chrome.com/blog/local-network-access)); WebSockets desde ~147; permiso dividido en `local-network` y `loopback-network` (~145) ([guía](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access)) [doc]. Para una página pública pegándole a localhost:
  - Pasar `fetch(url, { targetAddressSpace: 'loopback' })`.
  - Disparar la primera request desde un **user gesture** (botón "Conectar con Ollama") para que aparezca el prompt; consultar `navigator.permissions.query({ name: 'loopback-network' })` antes.
  - Los preflights PNA (`Access-Control-Allow-Private-Network`) están **deprecados**, no hacen falta. Sí hace falta CORS normal (`Access-Control-Allow-Origin`) → `OLLAMA_ORIGINS`.
  - Reportes de terceros dicen que el opt-out enterprise se elimina en Chrome 156 (~oct 2026) [comm, no verificado].
- **Firefox**: implementa LNA con prompt; Mozilla dice rollout gradual **desde Firefox 151**, cubre local y loopback ([KB](https://support.mozilla.org/en-US/kb/control-personal-device-local-network-permissions-firefox), [policy](https://firefox-admin-docs.mozilla.org/reference/policies/localnetworkaccess/)) [doc, fecha exacta no verificada]. Bug conocido: si el usuario clickea "Block", no vuelve a preguntar al recargar ([1](https://bugzilla.mozilla.org/show_bug.cgi?id=2021626), cerrado).
- **Safari**: no encontré prompt de red local para web; la traba es mixed content (arriba).

### Config del lado del usuario
- **Ollama**: `OLLAMA_ORIGINS=https://<dominio-de-bitacora>` (macOS: `launchctl setenv OLLAMA_ORIGINS ...` + reiniciar app; Linux: systemd `Environment=`; Windows: env var de usuario) ([FAQ](https://docs.ollama.com/faq)).
- **LM Studio**: activar CORS (UI o `--cors`).
- La app tiene que explicar estos pasos en la UI de config del Proveedor; es la fricción más grande del camino local.

## 3. Librería de tool-calling uniforme en el browser

**Vercel AI SDK (`ai` + `@ai-sdk/*`)** es la opción madura. `streamText({ model, tools, stopWhen: stepCountIs(n) })` corre el loop multi-step; los providers usan `fetch`, así que **corre client-side sin server route** (las docs muestran route handlers porque asumen key del dueño, no porque lo requiera). Providers: `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `@openrouter/ai-sdk-provider`, `@ai-sdk/openai-compatible` (Ollama `/v1`, LM Studio). Versiones actuales: `ai@7.0.170`, providers v4.

Bundle **[medido]** con esbuild `--bundle --minify --platform=browser`, gzip -9 (exportando los símbolos, sin tree-shaking fino → cota superior):

| Import | min | gzip |
|---|---|---|
| `ai` (`streamText`, `tool`) | 412 KB | ~110 KB |
| + `zod` + `@ai-sdk/anthropic` | 944 KB | ~215 KB |
| + openai, google, openrouter, openai-compatible | 1.47 MB | ~346 KB |

Consistente con [reportes de bloat](https://blog.hyperknot.com/p/til-vercel-ai-sdk-the-bloat-king) y [thread v5](https://community.vercel.com/t/increased-bundle-size-after-upgrading-ai-sdk-to-v5/23025) [comm]. Mitigación obvia: `import()` dinámico al abrir el Agente → costo cero en el first load; o cargar solo el provider elegido.

Alternativas:
- **Fetch a mano**: Anthropic Messages + OpenAI-compatible Chat Completions cubren casi todo (OpenRouter, Ollama, LM Studio y Gemini tienen endpoint OpenAI-compat). Dos adapters ≈ pocos KB. Más código propio (streaming SSE, normalizar tool calls), pero cero dependencia.
- **xsAI** (`moeru-ai/xsai`): clon minimalista OpenAI-compat, muy chico [comm, no medido].
- **TanStack AI**: más nuevo, API parecida ([migración](https://tanstack.com/ai/v0/docs/migration/migration-from-vercel-ai)) [no evaluado].

## 4. Modelos locales con tool-calling confiable (piso aproximado)

Incertidumbre alta — leaderboards de terceros con fechas inconsistentes; fuente canónica [BFCL](https://gorilla.cs.berkeley.edu/leaderboard.html) (no la pude leer directo).
- Familia **Qwen** (Qwen3 / Qwen3.5) domina los slots open-weight de BFCL a mediados de 2026 ([resumen](https://d-central.tech/local-llm-agent-capability/)) [comm].
- Closed models siguen ~5 pts arriba en BFCL ([callsphere](https://callsphere.ai/blog/tool-use-benchmarks-2026-bfcl-v3-tau-bench-results)) [comm].
- Piso práctico **[inferido]**: <7B falla seguido en multi-step (args mal formados, loops); ~8-14B anda para 1-2 tools simples; **~20-35B (p. ej. Qwen3 ~30B MoE, gpt-oss-20b)** es el piso razonable para un loop con varias tools y aprobación. Requiere que el runtime soporte tools (Ollama marca los modelos con capability `tools`, [catálogo](https://ollama.com/search?c=tools)).
- Implicancia: el Agente necesita degradar con gracia (ver "Piso de capacidad del modelo" en el map): validar args con zod y devolver el error al modelo para reintento.

## 5. ¿Cabe el snapshot de ~1.500 notas en contexto?

Estimación: 1.500 notas × 400 palabras = **600k palabras**. ~1.3 tokens/palabra en inglés, ~1.5-1.7 en español → **~0.8-1.0M tokens** solo de texto plano. Si se manda Tiptap JSON crudo, 3-5× más.

- Ventanas típicas [inferido, verificar por modelo]: frontier cloud 200k-1M; Gemini hasta ~1-2M; locales 8k-128k (y Ollama usa `num_ctx` chico por default).
- Aún donde "cabe" (1M), cuesta ~1M tokens de input **por turno** (pagado por el usuario con BYOK) y degrada atención.
- **Veredicto: snapshot completo NO es viable.** Viable: índice chico en el system prompt (59 notebooks con id+título ≈ 1-2k tokens) + tools de lectura (`list_notes(notebookId)`, `read_note(id)`, `search_notes(query)`). Un índice de las 1.500 notas (id+título ≈ 15-25 tokens c/u) son ~25-40k tokens: OK para cloud, demasiado para locales.
