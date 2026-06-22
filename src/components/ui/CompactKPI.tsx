"use client"

/* CompactKPI — small, dense KPI tile used in the M2 dashboard hero strip.
 *
 * Replaces the loose KPI cards (24px padding, 32px gaps) with a tighter row
 * of pill-stat tiles. Used additively — large KPI cards still exist where
 * the hero needs more density of information per tile.
 *
 *   <CompactKPI label="OPD waiting" value={12} tone="warn" trend="+3" />
 *
 * Tone is a soft tint, never a loud background.
 */
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Tone = "neutral" | "info" | "ok" | "warn" | "danger"

const TONE: Record<Tone, { bg: string; ring: string; valueFg: string; labelFg: string; dot: string }> = {
  neutral: { bg: "bg-slate-50",   ring: "ring-slate-200/70",   valueFg: "text-slate-900", labelFg: "text-slate-500", dot: "bg-slate-400"  },
  info:    { bg: "bg-blue-50/70", ring: "ring-blue-200/70",    valueFg: "text-blue-900",  labelFg: "text-blue-700",  dot: "bg-blue-500"   },
  ok:      { bg: "bg-emerald-50/70", ring: "ring-emerald-200/70", valueFg: "text-emerald-900", labelFg: "text-emerald-700", dot: "bg-emerald-500" },
  warn:    { bg: "bg-amber-50/70", ring: "ring-amber-200/70",  valueFg: "text-amber-900", labelFg: "text-amber-700", dot: "bg-amber-500"  },
  danger:  { bg: "bg-rose-50/70",  ring: "ring-rose-200/70",   valueFg: "text-rose-900",  labelFg: "text-rose-700",  dot: "bg-rose-500"   },
}

interface CompactKPIProps {
  label: string
  value: string | number
  unit?: string
  trend?: string                 // e.g. "+3" / "-1.4%"
  tone?: Tone
  hint?: string
  icon?: ReactNode
  onClick?: () => void
  className?: string
}

export function CompactKPI({ label, value, unit, trend, tone = "neutral", hint, icon, onClick, className }: CompactKPIProps) {
  const t = TONE[tone]
  const Wrapper = onClick ? "button" : "div"
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={hint}
      className={cn(
        "rounded-[10px] ring-1 px-3 py-2 text-left flex items-center gap-2.5 transition-all",
        "min-w-[124px]",
        t.bg, t.ring,
        onClick ? "hover:ring-2 cursor-pointer active:scale-[0.98]" : "",
        className,
      )}
    >
      {icon ? <div className="flex-shrink-0 opacity-80">{icon}</div> : null}
      <div className="flex-1 min-w-0">
        <p className={cn("text-[10px] font-semibold uppercase tracking-wide leading-none mb-1.5", t.labelFg)}>
          {label}
        </p>
        <div className="flex items-baseline gap-1.5">
          <span className={cn("text-[18px] font-bold tabular-nums leading-none", t.valueFg)}>
            {value}
          </span>
          {unit ? <span className={cn("text-[11px] font-medium", t.labelFg)}>{unit}</span> : null}
          {trend ? (
            <span className={cn("text-[11px] font-semibold tabular-nums ml-auto", t.labelFg)}>{trend}</span>
          ) : null}
        </div>
      </div>
    </Wrapper>
  )
}

/** Strip of CompactKPI tiles. */
export function CompactKPIStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {children}
    </div>
  )
}
