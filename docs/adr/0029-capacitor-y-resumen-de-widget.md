# ADR 0029 — Capacitor + Resumen de widget como cache de solo lectura

**Status:** Accepted (2026-11-26). No reabre ADR 0004: la app sigue **online-only**.

La app se empaqueta en iOS y Android con **Capacitor** para tener notificaciones, sonido y widgets
(una PWA no llega a ninguno de los tres). El `dist/` se **embebe** en la app (sin `server.url`, sin
live updates): un cambio de UI en producción pide nuevo build nativo. Los plugins se cargan con
`import()` detrás de `Capacitor.isNativePlatform()`, así la web no los descarga.

Los widgets (hábitos, repaso, stats; varios tamaños cada uno) son Swift/Kotlin **sin lógica de
dominio**: leen un **Resumen de widget** — JSON que la app arma con `buildWidgetSummary(snapshot, now)`
(`src/core/widget/summary.ts`, función pura que **compone** `derive.ts`, sin matemática nueva) y
escribe vía un puente nativo a storage compartido (App Group / SharedPreferences). Lleva su `day`:
si no coincide con hoy, el widget muestra "abrí la app" en vez de números viejos. Es cache de solo
lectura, **no** fuente de verdad ni sync: Supabase manda.

## Considered Options

- **Fetch nativo desde el widget**: más fresco, pero reimplementa racha / cumplimiento /
  `frozenTarget` en Swift **y** Kotlin (ADR 0003 existe para no derivar en dos lugares). Y en iOS el
  widget tiene ~40-70 refrescos/día, así que "tiempo real" no existe igual.
- **`@capacitor/background-runner`** (JS en background, reusa `derive.ts`): mínimo 15 min, sin
  garantía en iOS, auth en un runner aislado sin `localStorage`. **Diferido** a una fase 4, solo si
  el desfase desktop→celular molesta de verdad.
- **React Native / Tauri Mobile**: reescribir UI; Tiptap no existe en RN.

## Consecuencias

- El widget se refresca al instante cuando algo cambia **en la app** y al volver a primer plano;
  cambios hechos desde desktop aparecen cuando se abre la app.
- Login por **OTP de 6 dígitos** (`verifyOtp`) en vez de magic link: el link del mail abriría el
  navegador, no la app.
- Notificaciones **solo locales**, reprogramadas al abrir (cancelan la de hoy si ya se cumplió).
  Un solo sonido custom por canal, dos canales. Solo dos momentos, nada más:
  1. **Timer terminó**: alarma programada en el `deadline` de `use-habit-timer` al dar play,
     cancelada al pausar. Solo hábitos `good` con meta. Sin cuenta viva en el lock screen.
  2. **Recordatorio diario**: una hora global (Ajustes, `localStorage`; `Habit` no tiene hora),
     solo los días en que algún hábito tiene ese día en `days` (más Repaso si hay meta de
     lectura). Se programan 7 días en cada apertura. Cuerpo genérico de un pool rotativo en voseo
     (el texto queda congelado al programar, así que sin nombres ni conteos).
  Hora por hábito, segundo aviso y "racha en peligro" quedan fuera hasta que un caso real los pida.
- Al cambiar de día el Resumen de widget queda stale y los widgets dicen "abrí la app" hasta abrirla
  (tocar el recordatorio la abre). La salida si molesta es el Background Runner.
- Distribución: Android por APK firmado, sin costo; iOS con cuenta Apple Developer de pago. Por eso
  los widgets Android van antes que los de iOS.
- Puente nativo propio mínimo: `WidgetBridge.setSummary(json)` escribe en storage compartido y
  recarga los widgets (un archivo Swift, uno Kotlin).
- Sesión de Supabase y key BYOK (ADR 0027) siguen en `localStorage` del WebView; si el SO lo
  evicta, re-login y re-pegar la key. Se verifica en dispositivo real.
