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

// Cada sonido es una tabla de notas [freq Hz, inicio s, duración s, onda, volumen]: el oscilador
// ES el sonido, sin assets. La elección vive en localStorage ("bita-sound"), como bita-radius.
type Note = [number, number, number, OscillatorType?, number?]

export const SOUNDS = {
  beep: {
    label: "Beep",
    notes: [
      [880, 0, 0.15],
      [880, 0.18, 0.15],
      [880, 0.36, 0.15],
    ],
  },
  campana: {
    label: "Campana",
    notes: [
      [1318.5, 0, 1.1, "sine", 0.3],
      [2637, 0, 0.5, "sine", 0.08],
    ],
  },
  gota: {
    label: "Gota",
    notes: [
      [1200, 0, 0.12],
      [800, 0.12, 0.3],
    ],
  },
  acorde: {
    label: "Acorde",
    notes: [
      [523.25, 0, 0.4, "triangle"],
      [659.25, 0.12, 0.4, "triangle"],
      [783.99, 0.24, 0.6, "triangle"],
    ],
  },
  alarma: {
    label: "Alarma",
    notes: [
      [740, 0, 0.12, "square", 0.1],
      [988, 0.15, 0.12, "square", 0.1],
      [740, 0.3, 0.12, "square", 0.1],
      [988, 0.45, 0.12, "square", 0.1],
    ],
  },
  off: { label: "Off", notes: [] },
} satisfies Record<string, { label: string; notes: Note[] }>

export type SoundId = keyof typeof SOUNDS

export function getSound(): SoundId {
  const id = localStorage.getItem("bita-sound")
  return id && id in SOUNDS ? (id as SoundId) : "beep"
}

export function setSound(id: SoundId) {
  localStorage.setItem("bita-sound", id)
}

function beepWith(ctx: AudioContext) {
  const now = ctx.currentTime
  const notes = SOUNDS[getSound()].notes as Note[]
  // La melodía suena 3 veces: cada copia se desplaza lo que dura la melodía + 0.4s de pausa.
  const span = Math.max(...notes.map(([, s, d]) => s + d)) + 0.4
  const all = [0, 1, 2].flatMap((r) =>
    notes.map(([f, s, ...rest]): Note => [f, s + r * span, ...rest]),
  )
  for (const [freq, start, dur, wave = "sine", vol = 0.25] of all) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = wave
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, now + start)
    gain.gain.linearRampToValueAtTime(vol, now + start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.01, now + start + dur)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now + start)
    osc.stop(now + start + dur + 0.01)
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
  // Off = silencio total: ni tono ni vibración.
  if (getSound() === "off") return
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
