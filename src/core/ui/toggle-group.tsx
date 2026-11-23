import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"

import { cn } from "@/core/lib/utils"

// Segmented control: mismo chip que Tabs y los toolbars (`.chip`), activo = bg-muted.
function ToggleGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn("chip flex w-fit items-center gap-0.5 px-1", className)}
      {...props}
    />
  )
}

function ToggleGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex h-6 min-w-8 cursor-pointer items-center justify-center gap-1.5 rounded-pill px-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-[color,background-color] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 data-[state=on]:bg-muted data-[state=on]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
