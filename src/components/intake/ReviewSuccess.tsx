"use client"

import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { AlertTriangle, Pencil, CheckCircle, QrCode, Share2, Video, CalendarDays, Building2 } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { NeonBadge } from "@/components/ui/neon-badge"
import { triageScore, consultFee, DURATION_OPTIONS, type IntakeForm, type StepId } from "@/lib/intake/data"
import { cn } from "@/lib/utils"

function fmtDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date().toISOString().slice(0, 10)
  if (iso === today) return 'Today'
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ── Review ───────────────────────────────────────────────────────────
function Row({ label, onEdit, children }: { label: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center justify-between mb-0.5">
        <p className="text-[11px] uppercase text-slate-400 font-semibold tracking-wide">{label}</p>
        <button onClick={onEdit} className="text-[#0E7490] text-[12px] font-semibold flex items-center gap-1 active:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7490] rounded">
          <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
        </button>
      </div>
      {children}
    </div>
  )
}

function Chips({ items, accent }: { items: string[]; accent?: boolean }) {
  if (!items.length) return <span className="text-slate-400 text-[14px]">—</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(i => <span key={i} className={cn("px-2 py-0.5 text-[12px] font-medium rounded-md", accent ? "bg-[rgba(14,116,144,0.07)] text-[#0E7490]" : "bg-slate-100 text-slate-700")}>{i}</span>)}
    </div>
  )
}

export function ReviewStep({ form, onEdit }: { form: IntakeForm; onEdit: (id: StepId) => void }) {
  const triage = triageScore(form.symptoms, form.symptomDurations)
  const isVideo = form.consultationType === 'video'
  const durationLabel = (s: string) => {
    const d = form.symptomDurations[s]
    return d ? DURATION_OPTIONS.find(o => o.value === d)?.label : undefined
  }
  return (
    <div className="h-full overflow-y-auto pr-1 space-y-2.5">
      <div className="bg-white rounded-[16px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] divide-y divide-slate-100">
        <Row label="Patient" onEdit={() => onEdit('about')}>
          <p className="text-[15px] text-slate-900 font-medium">{form.name || '—'} <span className="text-slate-400 font-normal text-[13px]">· {form.age || '—'} yrs · {form.gender || '—'}</span></p>
          <p className="text-[13px] text-slate-500">{form.phone || '—'}</p>
        </Row>
        <Row label="Consultation" onEdit={() => onEdit('consultType')}>
          <p className="text-[15px] text-slate-900 font-medium flex items-center gap-1.5">
            {isVideo ? <Video className="h-4 w-4 text-[#0E7490]" /> : <Building2 className="h-4 w-4 text-[#0E7490]" />}
            {isVideo ? 'Online video' : 'In-person visit'}
          </p>
          {isVideo && <p className="text-[13px] text-slate-500 mt-0.5">{form.slotDoctor} · {fmtDate(form.slotDate)} {form.slotTime}</p>}
        </Row>
        <Row label="Symptoms" onEdit={() => onEdit('symptoms')}>
          {form.symptoms.length === 0
            ? <span className="text-slate-400 text-[14px]">—</span>
            : <div className="flex flex-wrap gap-1.5">
                {form.symptoms.map(s => {
                  const dur = durationLabel(s)
                  return (
                    <span key={s} className="flex items-center gap-1 px-2 py-0.5 text-[12px] font-medium rounded-md bg-slate-100 text-slate-700">
                      {s}
                      {dur && <span className="text-slate-400 font-normal">· {dur}</span>}
                    </span>
                  )
                })}
              </div>
          }
        </Row>
      </div>

      <div className={cn("flex items-center justify-between px-4 py-2.5 rounded-[14px]",
        triage.variant === 'danger' ? 'bg-red-50' : triage.variant === 'warning' ? 'bg-amber-50' : triage.variant === 'orange' ? 'bg-orange-50' : 'bg-green-50')}>
        <span className="flex items-center gap-2.5">
          <AlertTriangle className={cn("h-5 w-5", triage.color)} aria-hidden="true" />
          <span className="text-[14px] font-bold text-slate-900">AI Priority Match</span>
        </span>
        <NeonBadge variant={triage.variant} dot pulse className="px-3 py-1">{triage.level}</NeonBadge>
      </div>

      {form.dishaConsent && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[rgba(14,116,144,0.07)] rounded-[14px]">
          <QrCode className="h-5 w-5 text-[#0E7490] flex-shrink-0" aria-hidden="true" />
          <p className="text-[13px] text-[#0B5A6E] font-medium truncate">Family link will be created{form.familyPhone ? ` · ${form.familyPhone}` : ''}</p>
        </div>
      )}
      <p className="text-[12.5px] text-slate-400 px-1">Next: confirm &amp; pay the consultation fee.</p>
    </div>
  )
}

// ── Success ──────────────────────────────────────────────────────────
export function SuccessStep({ form, token, familyToken, wait }: { form: IntakeForm; token: number; familyToken: string | null; wait: number }) {
  const router = useRouter()
  const isVideo = form.consultationType === 'video'
  const triage = triageScore(form.symptoms, form.symptomDurations)
  const dotColor = triage.variant === 'danger' ? '#DC2626' : triage.variant === 'warning' ? '#D97706' : triage.variant === 'orange' ? '#EA580C' : '#16A34A'
  const paidLabel = form.payer === 'cashless' ? `Cashless · ${form.insurer || 'insurance'}` : `Paid ₹${consultFee(form)}${form.payMethod === 'counter' ? ' · at counter' : ''}`
  const first = form.name ? `, ${form.name.split(' ')[0]}` : ''

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-slate-100 flex md:items-center md:justify-center">
      <div className="relative flex flex-col w-full h-[100dvh] bg-[#F2F2F7] overflow-hidden md:w-[440px] md:h-[880px] md:max-h-[calc(100dvh-2rem)] md:rounded-[40px] md:shadow-2xl md:border md:border-white/50">
        <div className="flex-1 min-h-0 overflow-hidden px-6 flex flex-col items-center justify-center text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5, duration: 0.6 }}
            className="h-[84px] w-[84px] rounded-full flex items-center justify-center bg-green-50 border-[7px] border-green-100 mb-4">
            <CheckCircle className="h-10 w-10 text-green-500" aria-hidden="true" />
          </motion.div>

          {isVideo ? (
            <>
              <h2 className="text-[30px] leading-tight font-bold text-slate-900 tracking-tight">Video consult booked</h2>
              <p className="text-[15px] font-medium text-slate-500 mt-1 mb-5">All set{first} — {paidLabel}</p>
              <div className="w-full bg-white rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-4 mb-5 text-left">
                <div className="flex items-center gap-3">
                  <span className="h-11 w-11 rounded-2xl bg-[rgba(14,116,144,0.07)] flex items-center justify-center flex-shrink-0"><Video className="h-5.5 w-5.5 text-[#0E7490]" /></span>
                  <div>
                    <p className="text-[15px] font-bold text-slate-900">{form.slotDoctor || 'Your doctor'}</p>
                    <p className="text-[13px] text-slate-500 flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {fmtDate(form.slotDate)} · {form.slotTime}</p>
                  </div>
                </div>
                <p className="text-[12.5px] text-slate-400 mt-3">We&apos;ll notify you when your doctor is ready — join the call from your dashboard.</p>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-[44px] leading-none font-bold text-slate-900 tracking-tight">#{token}</h2>
              <p className="text-[15px] font-medium text-slate-500 mt-1 mb-5">Check-in complete{first} — {paidLabel}</p>
              <div className="w-full bg-white rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex divide-x divide-slate-100 mb-5">
                <div className="flex-1 px-3 py-3.5">
                  <p className="text-[11px] uppercase text-slate-400 font-semibold tracking-wide mb-1">Priority</p>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: dotColor }} />
                    <p className={cn("text-[15px] font-bold", triage.color)}>{triage.level}</p>
                  </div>
                </div>
                <div className="flex-1 px-3 py-3.5">
                  <p className="text-[11px] uppercase text-slate-400 font-semibold tracking-wide mb-1">Est. wait</p>
                  <p className="text-[18px] font-bold text-slate-900">~{wait} <span className="text-[12px] text-slate-500 font-medium">min</span></p>
                </div>
              </div>
            </>
          )}

          {familyToken && (
            <div className="w-full bg-white rounded-[20px] p-4 shadow-[0_4px_16px_rgba(0,0,0,0.05)] mb-5 flex items-center gap-4">
              <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}/family-track/${familyToken}`} size={84} level="M" className="rounded-md flex-shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5"><QrCode className="h-4 w-4 text-[#0E7490]" /> Family tracking</p>
                <p className="text-[11px] text-slate-400 mt-0.5 mb-2">Scan for live status. No medical data.</p>
                <button onClick={() => { const url = `${window.location.origin}/family-track/${familyToken}`; if (navigator.share) navigator.share({ title: 'Patient Status', url }); else navigator.clipboard.writeText(url) }}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#0E7490] active:opacity-60">
                  <Share2 className="h-3.5 w-3.5" /> Share with family
                </button>
              </div>
            </div>
          )}

          <button onClick={() => router.push('/patient/dashboard')} className="w-full h-14 rounded-2xl font-semibold text-[17px] text-white bg-[#0E7490] hover:bg-[#0B5A6E] transition-all shadow-[0_4px_14px_rgba(14,116,144,0.25)] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7490]">
            Go to My Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
