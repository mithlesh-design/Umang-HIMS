"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Calendar, ScanLine, AlertTriangle, ShieldCheck, ChevronRight, X,
  CheckCircle2, Clock, Sparkles, Activity,
} from "lucide-react"
import {
  useRadiologyStudiesStore, type RadiologyStudy, type RadSource,
} from "@/store/useRadiologyStudiesStore"
import { useAuthStore } from "@/store/useAuthStore"
import { RADIOLOGY_CATALOG, type Modality, type Priority } from "@/lib/radiologyCatalog"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { predictNoShow, predictScanDuration } from "@/lib/radiologyAI"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const MODALITY_TINT: Record<Modality, string> = {
  XR: 'bg-[rgba(14,116,144,0.07)] text-[#0E7490] border-[rgba(14,116,144,0.20)]',
  CT: 'bg-[rgba(14,116,144,0.07)] text-[#0E7490] border-[rgba(14,116,144,0.20)]',
  MRI: 'bg-[rgba(14,116,144,0.07)] text-[#0E7490] border-indigo-200',
  US: 'bg-[rgba(14,116,144,0.07)] text-[#0E7490] border-[rgba(14,116,144,0.20)]',
  MAMMO: 'bg-[rgba(14,116,144,0.07)] text-[#0E7490] border-[rgba(14,116,144,0.20)]',
  NM: 'bg-amber-50 text-amber-700 border-amber-200',
}
const SOURCE_TINT: Record<RadSource, string> = {
  OPD: 'bg-[rgba(14,116,144,0.07)] text-[#0E7490]', IPD: 'bg-[rgba(14,116,144,0.07)] text-[#0E7490]',
  ICU: 'bg-red-50 text-red-700', OT: 'bg-[rgba(14,116,144,0.07)] text-[#0E7490]', ER: 'bg-orange-50 text-orange-700',
}
const PRIORITY_TINT: Record<Priority, string> = {
  STAT: 'bg-red-100 text-red-700', Urgent: 'bg-amber-100 text-amber-700', Routine: 'bg-slate-100 text-slate-600',
  Trauma: 'bg-red-100 text-red-800', Stroke: 'bg-red-600 text-white', Critical: 'bg-red-700 text-white',
}
const PRIORITY_RANK: Record<Priority, number> = { Critical: -3, Stroke: -2, Trauma: -1, STAT: 0, Urgent: 1, Routine: 2 }

const minsAgo = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60000)

// Slot generator — next available slots over the next 4 hours in 15-min steps.
function makeSlots(): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = []
  const start = new Date()
  // Round up to the next 15-min mark.
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15)
  start.setSeconds(0); start.setMilliseconds(0)
  for (let i = 0; i < 16; i++) {
    const d = new Date(start.getTime() + i * 15 * 60000)
    out.push({
      iso: d.toISOString(),
      label: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    })
  }
  return out
}

export default function RadiologySchedulePage() {
  const studies = useRadiologyStudiesStore(s => s.studies)
  const schedule = useRadiologyStudiesStore(s => s.schedule)
  const setContrastConsented = useRadiologyStudiesStore(s => s.setContrastConsented)
  const currentUser = useAuthStore(s => s.currentUser)
  const meName = currentUser?.name ?? 'Radiology Scheduler'

  const [modalityFilter, setModalityFilter] = useState<'all' | Modality>('all')
  const [bookingStudy, setBookingStudy] = useState<RadiologyStudy | null>(null)
  const [slotIso, setSlotIso] = useState<string>('')
  const [consentTicked, setConsentTicked] = useState(false)
  const [prepConfirmed, setPrepConfirmed] = useState(false)

  const slots = useMemo(() => makeSlots(), [])

  const ordered = useMemo(() => {
    return studies.filter(s => s.status === 'ordered')
      .filter(s => modalityFilter === 'all' || s.modality === modalityFilter)
      .sort((a, b) => {
        const ap = PRIORITY_RANK[a.priority]; const bp = PRIORITY_RANK[b.priority]
        if (ap !== bp) return ap - bp
        return new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime()
      })
  }, [studies, modalityFilter])

  const byModality = useMemo(() => {
    const m: Record<Modality, number> = { XR: 0, CT: 0, MRI: 0, US: 0, MAMMO: 0, NM: 0 }
    for (const s of studies) if (s.status === 'ordered') m[s.modality]++
    return m
  }, [studies])

  const openBooking = (s: RadiologyStudy) => {
    setBookingStudy(s)
    setSlotIso(slots[0]?.iso ?? '')
    setConsentTicked(false)
    setPrepConfirmed(false)
  }

  const cat = bookingStudy ? RADIOLOGY_CATALOG[bookingStudy.code] : undefined
  const needsContrast = cat?.contrast ?? false
  const prepText = cat?.preparation
  const canBook = !!bookingStudy && !!slotIso && (!needsContrast || consentTicked) && (!prepText || prepConfirmed)

  const confirm = () => {
    if (!bookingStudy || !slotIso) return
    schedule(bookingStudy.id, slotIso)
    if (needsContrast && consentTicked) {
      setContrastConsented(bookingStudy.id, true)
    }
    const when = new Date(slotIso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    notifyAndAudit({
      to: 'patient', type: 'system', priority: 'medium',
      title: `${bookingStudy.modality} ${bookingStudy.name} booked · ${when}`,
      body: `Your ${bookingStudy.modality} ${bookingStudy.name} is scheduled at ${when}. ${prepText ? `Preparation: ${prepText}` : ''} Please arrive 10 minutes before.`,
      patientName: bookingStudy.patientName,
      audit: { action: 'radiology_order', resource: 'radiology_study', resourceId: bookingStudy.id, detail: `Scheduled for ${when}${needsContrast ? ' · contrast consent obtained' : ''}`, userName: meName },
    })
    toast.success(`${bookingStudy.patientName} scheduled · ${when}${needsContrast && consentTicked ? ' · contrast consented' : ''}`)
    setBookingStudy(null)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-[#0E7490]" />Scheduling desk
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Assign slots · prep instructions · contrast consent · the patient becomes "scheduled" and shows on arrival desk
          </p>
        </div>
        <Select value={modalityFilter} onChange={e => setModalityFilter(e.target.value as 'all' | Modality)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200">
          <option value="all">All modalities</option>
          {(['XR', 'CT', 'MRI', 'US', 'MAMMO'] as Modality[]).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </Select>
      </div>

      {/* Modality KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {(['XR', 'CT', 'MRI', 'US', 'MAMMO'] as Modality[]).map(m => (
          <div key={m} className={cn("rounded-xl border p-3", MODALITY_TINT[m])}>
            <p className="text-2xl font-bold">{byModality[m]}</p>
            <p className="text-xs font-semibold mt-1">{m} ordered</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2">Awaiting scheduling ({ordered.length})</h2>
        {ordered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">All orders booked</p>
            <p className="text-xs text-slate-400 mt-1">Every new order is assigned to a slot.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {ordered.map(s => {
              const c = RADIOLOGY_CATALOG[s.code]
              const orderedMins = minsAgo(s.orderedAt)
              return (
                <li key={s.id} className="rounded-xl bg-white border border-slate-200 p-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-bold text-slate-900">{s.patientName}</p>
                        <span className="text-[11px] font-bold text-slate-400">{s.patientId}</span>
                        <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded border", SOURCE_TINT[s.source])}>{s.source}</span>
                        {s.wardBed && <span className="text-[11px] text-slate-500">· {s.wardBed}</span>}
                        <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded border", MODALITY_TINT[s.modality])}>{s.modality}</span>
                        <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded", PRIORITY_TINT[s.priority])}>{s.priority}</span>
                        {(() => { const ns = Math.round(predictNoShow(s).data.risk * 100); return ns >= 35 ? <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">No-show {ns}%</span> : null })()}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[rgba(14,116,144,0.07)] text-[#0E7490] border border-[rgba(14,116,144,0.20)]">AI ~{predictScanDuration(s)}m</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-700 mt-1">{s.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Ordering: {s.doctorName} · ordered {orderedMins}m ago · TAT {s.expectedTATmin}m
                      </p>
                      {s.clinicalQuestion && (
                        <p className="text-xs text-slate-600 mt-1.5 italic">"{s.clinicalQuestion}"</p>
                      )}
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {c?.contrast && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 flex items-center gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" />Contrast required
                          </span>
                        )}
                        {c?.preparation && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[rgba(14,116,144,0.12)] text-[#0E7490]">
                            Prep: {c.preparation.length > 40 ? c.preparation.slice(0, 40) + '…' : c.preparation}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => openBooking(s)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer transition-all"
                      style={{ background: 'linear-gradient(135deg,#0B5A6E,#0E7490)', boxShadow: '0 2px 8px rgba(14,116,144,0.25)' }}>
                      <Calendar className="h-3.5 w-3.5" />Book slot
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="bg-[rgba(14,116,144,0.07)] border border-[rgba(14,116,144,0.20)] rounded-xl p-4">
        <p className="text-xs font-bold text-[#0B5A6E] flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3" />After scheduling
        </p>
        <p className="text-[11px] text-[#0E7490] mt-1">
          The patient is notified with the slot + prep. At the slot time, the arrival desk (`/radiology/arrival`)
          marks them checked-in, then the tech claims the study on the bench.
        </p>
      </div>

      {/* Booking modal */}
      <AnimatePresence>
        {bookingStudy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setBookingStudy(null)}>
            <motion.div initial={{ scale: 0.97, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 6 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
              onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Book slot · {bookingStudy.patientName}</h2>
                  <p className="text-xs text-slate-500">{bookingStudy.modality} {bookingStudy.name}</p>
                </div>
                <button onClick={() => setBookingStudy(null)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />Slot
                  </p>
                  <div className="grid grid-cols-4 gap-1.5 max-h-44 overflow-y-auto">
                    {slots.map(s => (
                      <button key={s.iso} type="button" onClick={() => setSlotIso(s.iso)}
                        className={cn("py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border",
                          slotIso === s.iso ? 'bg-[#0E7490] text-white border-[#0E7490] ring-2 ring-blue-200' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50')}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {prepText && (
                  <div className="rounded-lg border border-[rgba(14,116,144,0.20)] bg-[rgba(14,116,144,0.07)] p-3">
                    <p className="text-[11px] font-bold text-[#0E7490] mb-1.5 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />Preparation instructions
                    </p>
                    <p className="text-xs text-slate-700">{prepText}</p>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input type="checkbox" checked={prepConfirmed} onChange={e => setPrepConfirmed(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#0E7490] focus:ring-[#0E7490] cursor-pointer" />
                      <span className="text-[11px] font-bold text-[#0E7490]">Prep counselled to patient</span>
                    </label>
                  </div>
                )}

                {needsContrast && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-[11px] font-bold text-amber-700 mb-1.5 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />Contrast consent required
                    </p>
                    <p className="text-xs text-slate-700">
                      IV contrast required for this study. Confirm screening (renal function, prior reactions, asthma) and capture written consent before scan.
                    </p>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input type="checkbox" checked={consentTicked} onChange={e => setConsentTicked(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer" />
                      <span className="text-[11px] font-bold text-amber-700">Contrast consent obtained</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex gap-2 px-5 py-4 border-t border-slate-100">
                <button onClick={() => setBookingStudy(null)}
                  className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
                  Cancel
                </button>
                <button onClick={confirm} disabled={!canBook}
                  className="flex-1 h-10 rounded-xl bg-[#0E7490] hover:bg-[#0B5A6E] text-white text-sm font-bold cursor-pointer disabled:opacity-50">
                  Confirm booking
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
