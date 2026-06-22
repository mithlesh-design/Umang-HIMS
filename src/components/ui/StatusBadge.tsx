import { cn } from "@/lib/utils"

type Variant = 'success' | 'danger' | 'warning' | 'blue' | 'teal' | 'muted' | 'purple'

interface StatusBadgeProps {
  variant: Variant
  children: React.ReactNode
  dot?: boolean
  className?: string
}

const VARIANT_CLASSES: Record<Variant, string> = {
  success: 'bg-green-50  text-green-700  border-green-200',
  danger:  'bg-red-50    text-red-700    border-red-200',
  warning: 'bg-amber-50  text-amber-700  border-amber-200',
  blue:    'bg-blue-50   text-blue-700   border-blue-200',
  teal:    'bg-blue-50   text-blue-700   border-blue-200',
  muted:   'bg-slate-50  text-slate-600  border-slate-200',
  purple:  'bg-blue-50 text-blue-700 border-blue-200',
}

const DOT_CLASSES: Record<Variant, string> = {
  success: 'bg-green-500',
  danger:  'bg-red-500',
  warning: 'bg-amber-500',
  blue:    'bg-blue-500',
  teal:    'bg-blue-500',
  muted:   'bg-slate-400',
  purple:  'bg-blue-500',
}

export function StatusBadge({ variant, children, dot, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", DOT_CLASSES[variant])} />
      )}
      {children}
    </span>
  )
}
