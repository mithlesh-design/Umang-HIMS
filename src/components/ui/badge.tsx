import * as React from "react"
import { cn } from "@/lib/utils"

export type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted"
  | "purple"
  | "teal"
  | "orange"

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: "sm" | "md"
  dot?: boolean
  pulse?: boolean
  icon?: React.ElementType
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  default:  "bg-slate-100 text-slate-700 border-slate-200",
  primary:  "bg-blue-50   text-blue-700   border-blue-200",
  success:  "bg-green-50  text-green-700  border-green-200",
  warning:  "bg-amber-50  text-amber-700  border-amber-200",
  danger:   "bg-red-50    text-red-700    border-red-200",
  info:     "bg-sky-50    text-sky-700    border-sky-200",
  muted:    "bg-slate-50  text-slate-500  border-slate-100",
  purple:   "bg-blue-50 text-blue-700 border-blue-200",
  teal:     "bg-blue-50   text-blue-700   border-blue-200",
  orange:   "bg-orange-50 text-orange-700 border-orange-200",
}

const DOT_STYLES: Record<BadgeVariant, string> = {
  default: "bg-slate-400",
  primary: "bg-blue-500",
  success: "bg-green-500",
  warning: "bg-amber-500",
  danger:  "bg-red-500",
  info:    "bg-sky-500",
  muted:   "bg-slate-300",
  purple:  "bg-blue-500",
  teal:    "bg-blue-500",
  orange:  "bg-orange-500",
}

export function Badge({
  variant = "default",
  size = "sm",
  dot,
  pulse,
  icon: Icon,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        VARIANT_STYLES[variant] ?? VARIANT_STYLES.default,
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full flex-shrink-0",
            DOT_STYLES[variant] ?? DOT_STYLES.default,
            pulse && "animate-pulse"
          )}
        />
      )}
      {Icon && <Icon className="h-3 w-3 flex-shrink-0" />}
      {children}
    </span>
  )
}
