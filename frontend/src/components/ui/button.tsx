import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex min-w-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-transparent px-4 text-center text-sm font-semibold leading-tight tracking-[-0.01em] whitespace-normal transition-[transform,box-shadow,background-color,border-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-lift hover:-translate-y-0.5 hover:bg-primary/94",
        destructive:
          "bg-destructive text-destructive-foreground shadow-lift hover:-translate-y-0.5 hover:bg-destructive/92",
        outline:
          "border-border/80 bg-card/82 text-foreground shadow-panel hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card",
        secondary:
          "bg-secondary text-secondary-foreground shadow-lift hover:-translate-y-0.5 hover:bg-secondary/92",
        ghost: "bg-transparent text-muted-foreground shadow-none hover:bg-card/80 hover:text-foreground",
        link: "border-0 bg-transparent px-0 text-primary shadow-none underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 py-2.5 sm:px-5",
        sm: "min-h-10 px-3.5 py-2 text-xs",
        lg: "min-h-12 px-5 py-3 text-base sm:min-h-14 sm:px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
