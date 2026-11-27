import { MockLanguageModelV4 } from "ai/test"

type Opts = ConstructorParameters<typeof MockLanguageModelV4>[0]
type Gen = (o: never) => Promise<Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>>
// Parte del stream sin importar @ai-sdk/provider (no es dependencia directa del proyecto).
type Part =
  Awaited<ReturnType<MockLanguageModelV4["doStream"]>> extends { stream: ReadableStream<infer P> }
    ? P
    : never

// El núcleo usa streamText: este mock sigue hablando el formato `doGenerate` (una respuesta por
// llamada) y lo emite como stream. Las llamadas se registran en `doGenerateCalls`.
export class StreamedMock extends MockLanguageModelV4 {
  constructor(opts: NonNullable<Opts>) {
    super(opts)
    const src = opts.doGenerate as unknown
    let n = 0
    const next: Gen = Array.isArray(src)
      ? async () => src[Math.min(n++, src.length - 1)]
      : (src as Gen)
    this.doStream = async (options) => {
      this.doGenerateCalls.push(options)
      const r = await next(options as never)
      const parts: Part[] = [{ type: "stream-start", warnings: r.warnings }]
      r.content.forEach((c, i) => {
        const id = String(i)
        if (c.type === "text" || c.type === "reasoning") {
          parts.push(
            { type: `${c.type}-start`, id },
            { type: `${c.type}-delta`, id, delta: c.text },
          )
          parts.push({ type: `${c.type}-end`, id })
        } else parts.push(c as Part)
      })
      parts.push({ type: "finish", finishReason: r.finishReason, usage: r.usage })
      return {
        stream: new ReadableStream({
          start(ctl) {
            parts.forEach((p) => ctl.enqueue(p))
            ctl.close()
          },
        }),
      }
    }
  }
}
