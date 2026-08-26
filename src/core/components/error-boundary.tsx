import * as React from "react"
import { TriangleAlert } from "lucide-react"
import { Button } from "@/core/ui/button"

type FallbackProps = { error: Error; reset: () => void }

type Props = {
  children: React.ReactNode
  fallback?: React.ReactNode | ((props: FallbackProps) => React.ReactNode)
  onError?: (error: Error, info: React.ErrorInfo) => void
}

// Class component — no hay hook para esto: React sólo expone el boundary vía
// getDerivedStateFromError / componentDidCatch en una clase.
export class ErrorBoundary extends React.Component<
  Props,
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error, info)
    console.error(error, info.componentStack)
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children

    const error = this.state.error ?? new Error("Error desconocido")
    const { fallback } = this.props

    if (fallback) {
      return typeof fallback === "function"
        ? (fallback as (p: FallbackProps) => React.ReactNode)({ error, reset: this.reset })
        : fallback
    }

    return <ErrorFallback error={error} reset={this.reset} />
  }
}

export function ErrorFallback({ error, reset }: FallbackProps) {
  return (
    <div
      role="alert"
      className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center"
    >
      <div className="flex max-w-md flex-col items-center gap-4">
        <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert size={20} />
        </span>
        <h2 className="text-lg font-semibold tracking-tight">Algo salió mal</h2>
        <p className="text-sm text-muted-foreground">
          Ocurrió un error inesperado. Podés reintentar o recargar la página.
        </p>
        {error.message && (
          <pre className="max-w-full overflow-auto rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            {error.message}
          </pre>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={reset}>
            Reintentar
          </Button>
          <Button onClick={() => window.location.reload()}>Recargar página</Button>
        </div>
      </div>
    </div>
  )
}
