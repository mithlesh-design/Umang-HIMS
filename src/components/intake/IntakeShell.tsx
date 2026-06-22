"use client"

import { motion, useReducedMotion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  stepNumber: number
  totalSteps: number
  title: string
  subtitle?: string
  onBack?: () => void
  ctaLabel: string
  onCta: () => void
  ctaDisabled?: boolean
  ctaLoading?: boolean
  children: React.ReactNode
}

/**
 * Fixed-height kiosk frame: header + content + footer always equal the frame
 * height, and the content area is `overflow-hidden` — it never scrolls. Each
 * step authors its body to fit the available space.
 */
export function IntakeShell({
  stepNumber, totalSteps, title, subtitle,
  onBack, ctaLabel, onCta, ctaDisabled, ctaLoading, children,
}: Props) {
  const reduce = useReducedMotion()
  const pct = Math.round((stepNumber / totalSteps) * 100)

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-slate-100 flex flex-col md:items-center md:justify-center">
      <div className="relative flex flex-col w-full h-[100dvh] bg-[#F2F2F7] overflow-hidden md:w-[440px] md:h-[880px] md:max-h-[calc(100dvh-2rem)] md:rounded-[40px] md:shadow-2xl md:border md:border-white/50">

        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-6 pb-3">
          <div className="flex justify-center mb-3">
            <img src="/Umang-logo.webp" alt="Umang HIMS" className="h-8 w-auto object-contain" />
          </div>
          <div className="flex items-center justify-between mb-2.5 min-h-[22px]">
            {onBack ? (
              <button onClick={onBack} className="text-[#0E7490] flex items-center gap-1 text-[15px] font-medium -ml-1 active:opacity-60 transition-opacity rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7490]">
                <ArrowLeft className="h-5 w-5" aria-hidden="true" /> Back
              </button>
            ) : <span className="w-14" />}
            <span className="text-[12px] font-semibold text-slate-400" aria-hidden="true">Step {stepNumber} of {totalSteps}</span>
            <span className="w-14" />
          </div>
          <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden" role="progressbar" aria-valuenow={stepNumber} aria-valuemin={1} aria-valuemax={totalSteps} aria-label={`Step ${stepNumber} of ${totalSteps}`}>
            <motion.div className="h-full rounded-full bg-[#0E7490]" initial={false} animate={{ width: `${pct}%` }} transition={reduce ? { duration: 0 } : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }} />
          </div>
          <h1 tabIndex={-1} className="text-[22px] leading-tight font-bold text-slate-900 tracking-tight mt-3.5 focus:outline-none">{title}</h1>
          {subtitle && <p className="text-[13.5px] text-slate-500 mt-0.5">{subtitle}</p>}
          <div aria-live="polite" className="sr-only">Step {stepNumber} of {totalSteps}: {title}</div>
        </div>

        {/* Content — strictly no scroll */}
        <main id="main-content" className="relative flex-1 min-h-0 overflow-hidden px-6 pt-1">
          {children}
        </main>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 pt-3 pb-6 bg-gradient-to-t from-[#F2F2F7] via-[#F2F2F7] to-transparent">
          <button
            onClick={onCta}
            disabled={ctaDisabled || ctaLoading}
            className={cn(
              "w-full h-14 rounded-2xl font-semibold text-[17px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7490] focus-visible:ring-offset-2",
              (ctaDisabled || ctaLoading) ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-[#0E7490] text-white shadow-[0_8px_20px_rgba(14,116,144,0.25)]"
            )}
          >
            {ctaLoading ? (
              <>
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="h-5 w-5 border-[3px] border-slate-400/30 border-t-slate-600 rounded-full" />
                Finalizing…
              </>
            ) : ctaLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
