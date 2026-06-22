import * as React from "react"
import { cn } from "@/lib/utils"

export type NeonBadgeVariant = "blue" | "teal" | "purple" | "orange" | "green" | "danger" | "warning" | "success" | "muted"

export interface NeonBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: NeonBadgeVariant
  dot?: boolean
  pulse?: boolean
}

const VARIANT_STYLES: Record<NeonBadgeVariant, string> = {
  blue:    "bg-blue-50   text-blue-700   border-blue-200",
  teal:    "bg-blue-50   text-blue-700   border-blue-200",
  purple:  "bg-blue-50 text-blue-700 border-blue-200",
  orange:  "bg-orange-50 text-orange-700 border-orange-200",
  green:   "bg-green-50  text-green-700  border-green-200",
  success: "bg-green-50  text-green-700  border-green-200",
  danger:  "bg-red-50    text-red-700    border-red-200",
  warning: "bg-amber-50  text-amber-700  border-amber-200",
  muted:   "bg-slate-50  text-slate-500  border-slate-100",
}

const DOT_STYLES: Record<NeonBadgeVariant, string> = {
  blue:    "bg-blue-500",
  teal:    "bg-blue-500",
  purple:  "bg-blue-500",
  orange:  "bg-orange-500",
  green:   "bg-green-500",
  success: "bg-green-500",
  danger:  "bg-red-500",
  warning: "bg-amber-500",
  muted:   "bg-slate-300",
}

export const NeonBadge = React.forwardRef<HTMLSpanElement, NeonBadgeProps>(
  ({ className, variant = "blue", dot, pulse, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide transition-all",
        VARIANT_STYLES[variant] ?? VARIANT_STYLES.muted,
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full flex-shrink-0",
            DOT_STYLES[variant] ?? DOT_STYLES.muted,
            pulse && "animate-pulse"
          )}
        />
      )}
      {children}
    </span>
  )
)
NeonBadge.displayName = "NeonBadge"
