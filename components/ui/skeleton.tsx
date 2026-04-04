import { cn } from "@/lib/utils"

/**
 * Skeleton loader component for loading states
 * Uses muted colors and smooth animations
 * Validates: Requirements 9.1, 9.3
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
