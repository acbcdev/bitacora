import { playDoneSound } from "@/habits/sound"

// El seam de audio: con un ctx fake, playDoneSound es testeable sin montar la app.

function fakeCtx(state: AudioContextState = "running") {
  const oscillators: string[] = []
  return {
    state,
    currentTime: 0,
    resume: vi.fn().mockResolvedValue(undefined),
    createOscillator: () => ({
      type: "",
      frequency: { value: 0 },
      connect: (g: { connect: () => void }) => {
        oscillators.push("osc")
        return g
      },
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createGain: () => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn().mockReturnThis(),
    }),
    destination: {},
    oscillators,
  }
}

// Constructor fake de AudioContext (vi.fn no se puede usar con `new`).
function ctxCtor(ctx: object, count?: { n: number }): new () => AudioContext {
  return function Ctx() {
    if (count) count.n++
    return ctx as object
  } as unknown as new () => AudioContext
}

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
  vi.stubGlobal("navigator", {})
})

afterEach(() => vi.unstubAllGlobals())

test("sin Web Audio no explota: el beep es mejor-effort", () => {
  expect(() => playDoneSound()).not.toThrow()
})

test("ctx corriendo: schedula 3 osciladores (tres beeps)", async () => {
  const ctx = fakeCtx()
  const count = { n: 0 }
  vi.stubGlobal("AudioContext", ctxCtor(ctx, count))
  const { playDoneSound: beep } = await import("@/habits/sound")
  beep()
  expect(count.n).toBe(1)
  expect(ctx.oscillators).toHaveLength(3)
  expect(ctx.resume).not.toHaveBeenCalled()
})

test("ctx suspended: espera el resume antes de schedular", async () => {
  const ctx = fakeCtx("suspended")
  vi.stubGlobal("AudioContext", ctxCtor(ctx))
  const { playDoneSound: beep } = await import("@/habits/sound")
  beep()
  expect(ctx.oscillators).toHaveLength(0)
  await vi.waitFor(() => {
    expect(ctx.oscillators).toHaveLength(3)
  })
  // getAudioCtx ya intentó resume (y falló dentro del gesto); playDoneSound lo reintenta.
  expect(ctx.resume).toHaveBeenCalledTimes(2)
})

test("segunda llamada reusa el mismo ctx (un solo AudioContext)", async () => {
  const ctx = fakeCtx()
  const count = { n: 0 }
  vi.stubGlobal("AudioContext", ctxCtor(ctx, count))
  const { playDoneSound: beep } = await import("@/habits/sound")
  beep()
  beep()
  expect(count.n).toBe(1)
  expect(ctx.oscillators).toHaveLength(6)
})
