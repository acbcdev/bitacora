import { copyImage, downloadImage, fetchBlob } from "@/core/components/editor-lightbox-utils"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

test("fetchBlob rechaza si la respuesta no es ok", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }))
  await expect(fetchBlob("https://x/a.png")).rejects.toThrow("HTTP 404")
})

test("downloadImage crea <a download> con blob URL y la revoca", async () => {
  const blob = new Blob(["x"], { type: "image/jpeg" })
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => blob }))
  URL.createObjectURL = vi.fn(() => "blob:fake")
  URL.revokeObjectURL = vi.fn()
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
  vi.useFakeTimers()
  await downloadImage("https://x/a", "foto")
  expect(click).toHaveBeenCalled()
  expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1000)
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake")
})

test("copyImage pasa una promesa a ClipboardItem y no convierte PNG", async () => {
  const png = new Blob(["x"], { type: "image/png" })
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => png }))
  const items: Record<string, unknown>[] = []
  vi.stubGlobal(
    "ClipboardItem",
    vi.fn(function (d: Record<string, unknown>) {
      items.push(d)
    }),
  )
  const write = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal("navigator", { clipboard: { write } })
  await copyImage("https://x/a.png")
  expect(write).toHaveBeenCalledOnce()
  expect(items[0]["image/png"]).toBeInstanceOf(Promise)
  await expect(items[0]["image/png"]).resolves.toBe(png)
})
