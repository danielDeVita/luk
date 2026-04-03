import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-[1.2rem] border border-border/80 bg-background/72 px-4 py-3 text-sm font-medium shadow-sm transition-[background-color,border-color,box-shadow] outline-none placeholder:text-muted-foreground/90 focus-visible:ring-2 focus-visible:ring-ring/60 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
