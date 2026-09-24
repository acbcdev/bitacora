// Augment de window para QA manual — bitaPlaySound no existe en ningún type de DOM.
declare global {
  interface Window {
    bitaPlaySound?: () => void
  }
}

// Motor de sonido del cronómetro: Web Audio + vibración + fallback.
// Interface de una función (playDoneSound). El timer la llama; nadie más la conoce.
//
// Un solo AudioContext, desbloqueado dentro del gesto del usuario (autoplay policy): sin esto,
// el beep de finishTimer — que corre segundos/minutos después, fuera de la ventana de
// "transient activation" — quedaría silenciado.
let audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  // SAFETY: browsers sin Web Audio no definen el constructor; webkitAudioContext cubre Safari viejo.
  const Ctx =
    (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  audioCtx ??= new Ctx()
  // resume debe ocurrir dentro del gesto; si falla queda suspended y el beep
  // posterior se intentará de nuevo en playDoneSound()
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {})
  return audioCtx
}

// Desbloqueo dentro del gesto del usuario: si el timer sobrevivió a un reload, startTimer no
// se volvió a llamar en esta sesión y el ctx nunca se desbloqueó. Cualquier click lo desbloquea.
if (typeof document !== "undefined") {
  document.addEventListener("click", () => getAudioCtx(), { once: true, capture: true })
}

export function unlockSound() {
  getAudioCtx()
}

function beepWith(ctx: AudioContext) {
  const now = ctx.currentTime
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0, now + i * 0.18)
    gain.gain.linearRampToValueAtTime(0.25, now + i * 0.18 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.18 + 0.15)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now + i * 0.18)
    osc.stop(now + i * 0.18 + 0.16)
  }
}

// Fallback por si Web Audio está bloqueado: algunos browsers desbloquean <audio>
// distinto que AudioContext. No embebemos wav de 10kb: el oscilador ES el sonido,
// este fallback sólo intenta crear un AudioContext fresco por si el global quedó
// en estado cerrado/suspended.
function fallbackBeep() {
  try {
    // SAFETY: idem getAudioCtx — mismo par de constructores de Web Audio.
    const Ctx =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const c = new Ctx()
    const doBeep = () => beepWith(c)
    if (c.state === "suspended")
      c.resume()
        .then(doBeep)
        .catch(() => {})
    else doBeep()
  } catch {
    // El beep es mejor-effort: si Web Audio no se puede crear no hay nada que loggear.
  }
}

export function playDoneSound() {
  // Intento 1: Web Audio. Si está suspended, esperamos al resume — sin esto el
  // osc se schedula en un ctx suspendido y NUNCA suena (bug que viste: "no sonó").
  const ctx = getAudioCtx()
  if (!ctx) {
    fallbackBeep()
    return
  }
  const doVibrate = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      ;(navigator as Navigator & { vibrate?: (p: number[]) => void }).vibrate?.([200, 100, 200])
    }
  }
  if (ctx.state === "suspended") {
    ctx
      .resume()
      .then(() => {
        beepWith(ctx)
        doVibrate()
      })
      .catch(() => fallbackBeep())
    return
  }
  try {
    beepWith(ctx)
    doVibrate()
  } catch {
    fallbackBeep()
  }
}

if (typeof window !== "undefined") {
  // QA manual: window.bitaPlaySound() sin esperar 25 min.
  window.bitaPlaySound = playDoneSound
}
