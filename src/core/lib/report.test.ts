import * as Sentry from "@sentry/react"
import { toast } from "sonner"
import { onMutationError } from "@/core/lib/report"

vi.mock("@sentry/react", () => ({ captureException: vi.fn() }))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

test("una mutation fallida se reporta a Sentry y sigue mostrando el toast", () => {
  const e = new Error("violates row-level security")
  onMutationError(e)
  expect(Sentry.captureException).toHaveBeenCalledWith(e)
  expect(toast.error).toHaveBeenCalledWith("violates row-level security")
})
