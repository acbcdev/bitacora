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
  arpegio: {
    label: "Arpegio",
    notes: [
      [523.25, 0, 0.2, "sine"],
      [659.25, 0.1, 0.2, "sine"],
      [783.99, 0.2, 0.2, "sine"],
      [1046.5, 0.3, 0.5, "sine"],
    ],
  },
  cristal: {
    label: "Cristal",
    notes: [
      [2093, 0, 0.8, "sine", 0.12],
      [3136, 0.08, 0.6, "sine", 0.08],
      [4186, 0.16, 0.4, "sine", 0.05],
    ],
  },
  pulso: {
    label: "Pulso",
    notes: [
      [220, 0, 0.25, "sawtooth", 0.12],
      [220, 0.3, 0.25, "sawtooth", 0.12],
    ],
  },
  victoria: {
    label: "Victoria",
    notes: [
      [523.25, 0, 0.12, "square", 0.1],
      [523.25, 0.14, 0.12, "square", 0.1],
      [523.25, 0.28, 0.12, "square", 0.1],
      [659.25, 0.42, 0.5, "square", 0.1],
    ],
  },
  moneda: {
    label: "Moneda",
    notes: [
      [987.77, 0, 0.08, "square", 0.1],
      [1318.5, 0.08, 0.45, "square", 0.1],
    ],
  },
  powerup: {
    label: "Power-up",
    notes: [
      [392, 0, 0.07, "square", 0.1],
      [494, 0.07, 0.07, "square", 0.1],
      [587, 0.14, 0.07, "square", 0.1],
      [784, 0.21, 0.07, "square", 0.1],
      [988, 0.28, 0.07, "square", 0.1],
      [1175, 0.35, 0.07, "square", 0.1],
      [1568, 0.42, 0.3, "square", 0.1],
    ],
  },
  oneup: {
    label: "1-UP",
    notes: [
      [659.25, 0, 0.09, "square", 0.1],
      [783.99, 0.09, 0.09, "square", 0.1],
      [1318.5, 0.18, 0.09, "square", 0.1],
      [1046.5, 0.27, 0.09, "square", 0.1],
      [1174.7, 0.36, 0.09, "square", 0.1],
      [1568, 0.45, 0.3, "square", 0.1],
    ],
  },
  secreto: {
    label: "Secreto",
    notes: [
      [784, 0, 0.1, "square", 0.1],
      [740, 0.11, 0.1, "square", 0.1],
      [622, 0.22, 0.1, "square", 0.1],
      [440, 0.33, 0.1, "square", 0.1],
      [415, 0.44, 0.1, "square", 0.1],
      [659, 0.55, 0.1, "square", 0.1],
      [831, 0.66, 0.1, "square", 0.1],
      [1047, 0.77, 0.35, "square", 0.1],
    ],
  },
  gameover: {
    label: "Game over",
    notes: [
      [523.25, 0, 0.2, "square", 0.1],
      [392, 0.25, 0.2, "square", 0.1],
      [329.6, 0.5, 0.2, "square", 0.1],
      [261.6, 0.75, 0.6, "square", 0.1],
    ],
  },
  ding: {
    label: "Ding",
    notes: [[1568, 0, 0.7, "sine", 0.3]],
  },
  marimba: {
    label: "Marimba",
    notes: [
      [523.25, 0, 0.25, "triangle", 0.3],
      [659.25, 0.15, 0.25, "triangle", 0.3],
      [523.25, 0.3, 0.25, "triangle", 0.3],
      [783.99, 0.45, 0.5, "triangle", 0.3],
    ],
  },
  zen: {
    label: "Cuenco",
    notes: [
      [220, 0, 2, "sine", 0.3],
      [440, 0, 1.4, "sine", 0.12],
      [660, 0, 0.9, "sine", 0.06],
    ],
  },
  sonar: {
    label: "Sonar",
    notes: [
      [1000, 0, 0.5, "sine", 0.3],
      [1000, 0.7, 0.2, "sine", 0.1],
    ],
  },
  burbuja: {
    label: "Burbuja",
    notes: [
      [400, 0, 0.06, "sine", 0.3],
      [600, 0.06, 0.06, "sine", 0.3],
      [900, 0.12, 0.1, "sine", 0.3],
    ],
  },
  laser: {
    label: "Láser",
    notes: [
      [2000, 0, 0.05, "sawtooth", 0.08],
      [1500, 0.05, 0.05, "sawtooth", 0.08],
      [1000, 0.1, 0.05, "sawtooth", 0.08],
      [600, 0.15, 0.05, "sawtooth", 0.08],
      [300, 0.2, 0.15, "sawtooth", 0.08],
    ],
  },
  tada: {
    label: "Tada",
    notes: [
      [392, 0, 0.12, "triangle", 0.3],
      [523.25, 0.12, 0.12, "triangle", 0.3],
      [523.25, 0.3, 0.8, "triangle", 0.3],
      [659.25, 0.3, 0.8, "triangle", 0.3],
      [783.99, 0.3, 0.8, "triangle", 0.3],
    ],
  },
  nivel: {
    label: "Nivel",
    notes: [
      [330, 0, 0.1, "square", 0.1],
      [392, 0.1, 0.1, "square", 0.1],
      [523, 0.2, 0.1, "square", 0.1],
      [659, 0.3, 0.1, "square", 0.1],
      [784, 0.4, 0.1, "square", 0.1],
      [1047, 0.5, 0.5, "square", 0.1],
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

// Osciladores en vuelo: al cambiar de sonido en settings cortamos el anterior.
const active = new Set<OscillatorNode>()

function stopActive() {
  for (const o of active) {
    try {
      o.stop()
    } catch {
      // ya terminó
    }
  }
  active.clear()
}

function beepWith(ctx: AudioContext, repeats: number) {
  stopActive()
  const now = ctx.currentTime
  const notes = SOUNDS[getSound()].notes as Note[]
  // La melodía suena `repeats` veces (3 al terminar el timer, 1 en el preview de settings): cada copia se desplaza lo que dura la melodía + 0.4s de pausa.
  const span = Math.max(...notes.map(([, s, d]) => s + d)) + 0.4
  const all = Array.from({ length: repeats }, (_, r) => r).flatMap((r) =>
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
    active.add(osc)
    osc.addEventListener("ended", () => active.delete(osc))
  }
}

// Fallback por si Web Audio está bloqueado: algunos browsers desbloquean <audio>
// distinto que AudioContext. No embebemos wav de 10kb: el oscilador ES el sonido,
// este fallback sólo intenta crear un AudioContext fresco por si el global quedó
// en estado cerrado/suspended.
function fallbackBeep(repeats: number) {
  try {
    // SAFETY: idem getAudioCtx — mismo par de constructores de Web Audio.
    const Ctx =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const c = new Ctx()
    const doBeep = () => beepWith(c, repeats)
    if (c.state === "suspended")
      c.resume()
        .then(doBeep)
        .catch(() => {})
    else doBeep()
  } catch {
    // El beep es mejor-effort: si Web Audio no se puede crear no hay nada que loggear.
  }
}

// once = preview de settings: una sola pasada y sin vibración.
export function playDoneSound(once = false) {
  const repeats = once ? 1 : 3
  // Off = silencio total: ni tono ni vibración.
  if (getSound() === "off") return
  // Intento 1: Web Audio. Si está suspended, esperamos al resume — sin esto el
  // osc se schedula en un ctx suspendido y NUNCA suena (bug que viste: "no sonó").
  const ctx = getAudioCtx()
  if (!ctx) {
    fallbackBeep(repeats)
    return
  }
  const doVibrate = () => {
    if (!once && typeof navigator !== "undefined" && "vibrate" in navigator) {
      ;(navigator as Navigator & { vibrate?: (p: number[]) => void }).vibrate?.([200, 100, 200])
    }
  }
  if (ctx.state === "suspended") {
    ctx
      .resume()
      .then(() => {
        beepWith(ctx, repeats)
        doVibrate()
      })
      .catch(() => fallbackBeep(repeats))
    return
  }
  try {
    beepWith(ctx, repeats)
    doVibrate()
  } catch {
    fallbackBeep(repeats)
  }
}

if (typeof window !== "undefined") {
  // QA manual: window.bitaPlaySound() sin esperar 25 min.
  window.bitaPlaySound = () => playDoneSound()
}
