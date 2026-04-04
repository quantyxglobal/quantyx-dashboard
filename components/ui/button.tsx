import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
        professional: "bg-professional text-professional-foreground hover:bg-professional/90 active:bg-professional/80 shadow-sm",
        hero: "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:shadow-lg hover:scale-105 active:scale-100",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90 active:bg-accent/80 font-semibold",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
        ghost: "hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
        link: "text-primary underline-offset-4 hover:underline active:text-primary/80",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
      },
      size: {
        sm: "h-11 rounded-md px-3 min-w-[44px] min-h-[44px]",
        default: "h-11 px-4 py-2 min-w-[44px] min-h-[44px]",
        lg: "h-12 rounded-md px-8 min-w-[44px] min-h-[44px]",
        xl: "h-14 rounded-lg px-10 text-base min-w-[44px] min-h-[44px]",
        icon: "h-11 w-11 min-w-[44px] min-h-[44px]",
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
  ({ className, variant, size, asChild, ...props }, ref) => {
    // Filter out asChild prop - it's not used in this implementation
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
