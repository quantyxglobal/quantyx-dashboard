import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
// Updated status icons - removed Archive
import { Clock, FileText, CheckCircle, AlertCircle, LucideIcon } from "lucide-react"

// Status icon mapping for case status badges
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Status-specific variants using design system colors
        PENDING: "border-transparent bg-accent/10 text-accent-foreground hover:bg-accent/20",
        IN_PROGRESS: "border-transparent bg-primary/10 text-primary hover:bg-primary/20",
        UNDER_REVIEW: "border-transparent bg-orange-500/10 text-orange-700 dark:text-orange-400 hover:bg-orange-500/20",
        COMPLETED: "border-transparent bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20",
        DELIVERED: "border-transparent bg-purple-500/10 text-purple-700 dark:text-purple-400 hover:bg-purple-500/20",
        ON_HOLD: "border-transparent bg-gray-500/10 text-gray-700 dark:text-gray-400 hover:bg-gray-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// Icon mapping for status badges
const statusIcons: Record<string, LucideIcon> = {
  PENDING: Clock,
  IN_PROGRESS: FileText,
  UNDER_REVIEW: AlertCircle,
  COMPLETED: CheckCircle,
  DELIVERED: CheckCircle,
  ON_HOLD: Clock,
}

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  icon?: LucideIcon | boolean
}

function Badge({ className, variant, icon, children, ...props }: BadgeProps) {
  // Determine which icon to use
  let IconComponent: LucideIcon | null = null
  
  if (icon === true && variant && typeof variant === 'string' && variant in statusIcons) {
    // Auto-select icon based on variant
    IconComponent = statusIcons[variant]
  } else if (typeof icon === 'function') {
    // Use provided icon component
    IconComponent = icon
  }

  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {IconComponent && <IconComponent className="h-3 w-3" />}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }
