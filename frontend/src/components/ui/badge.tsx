import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border px-3 py-1 text-center text-[0.68rem] font-bold leading-tight tracking-[0.16em] uppercase [&>svg]:size-3 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 transition-[color,box-shadow,background-color,border-color] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-primary/15 text-primary [a&]:hover:bg-primary/22",
        secondary:
          "border-secondary/20 bg-secondary/12 text-secondary [a&]:hover:bg-secondary/18",
        destructive:
          "border-destructive/20 bg-destructive/15 text-destructive [a&]:hover:bg-destructive/18 focus-visible:ring-destructive/20",
        outline:
          "border-border/80 text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
