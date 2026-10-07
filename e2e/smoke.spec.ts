import { expect, test } from "@playwright/test"

// Editor -> draft -> autosave (800 ms, ADR 0015/0021) -> localStore. Modo local (ADR 0011): sin login.
// No cubre supabaseStore.
test("escribir en una nota, recargar y el texto persiste", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("bita-storage", "local"))

  await page.goto("/notebooks?new=1")
  await page.getByPlaceholder("Nombre del notebook").fill("Smoke")
  await page.getByRole("button", { name: "Crear notebook" }).click()
  await page.getByText("Smoke").first().click()

  await page.getByRole("button", { name: "Nueva nota" }).click()
  const editor = page.locator(".tiptap")
  await editor.click()
  await page.keyboard.type("texto de smoke")
  await expect(editor).toContainText("texto de smoke")

  await page.waitForTimeout(1500) // > debounce de 800 ms
  await page.reload()

  await expect(page.locator(".tiptap")).toContainText("texto de smoke")
})
