"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  UserCheck, ScanLine, AlertTriangle, ShieldCheck, Clock, CheckCircle2,
  ChevronRight, Activity, ArrowRight,
} from "lucide-react"
import {
  useRadiologyStudiesStore, type RadiologyStudy,
} from "@/store/useRadiologyStudiesStore"
import { useAuthStore } from "@/store/useAuthStore"
import { RADIOLOGY_CATALOG, type Modality, type Priority } from "@/lib/radiologyCatalog"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { checkPrepReadiness } from "@/lib/radiologyAI"
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
const PRIORITY_TINT: Record<Priority, string> = {
  STAT: 'bg-red-100 text-red-700', Urgent: 'bg-amber-100 text-amber-700', Routine: 'bg-slate-100 text-slate-600',
  Trauma: 'bg-red-100 text-red-800', Stroke: 'bg-red-600 text-white', Critical: 'bg-red-700 text-white',
}

const fmtSlot = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'

const minsTo = (iso?: string) => iso ? Math.round((new Date(iso).getTime() - Date.now()) / 60000) : 0

export default function RadiologyArrivalPage() {
  const studies = useRadiologyStudiesStore(s => s.studies)
  const markArrived = useRadiologyStudiesStore(s => s.markArrived)
  const setContrastConsented = useRadiologyStudiesStore(s => s.setContrastConsented)
  const currentUser = useAuthStore(s => s.currentUser)
  const meName = currentUser?.name ?? 'Radiology desk'

  const [filter, setFilter] = useState<'all' | 'late' | 'soon'>('all')

  const scheduled = useMemo(() => {
    const sList = studies.filter(s => s.status === 'scheduled')
    const filtered = sList.filter(s => {
      if (filter === 'all') return true
      const m = minsTo(s.scheduledFor)
      if (filter === 'late') return m < 0
      if (filter === 'soon') return m >= 0 && m <= 30
      return true
    })
    return filtered.sort((a, b) =>
      new Date(a.scheduledFor ?? a.orderedAt).getTime() - new Date(b.scheduledFor ?? b.orderedAt).getTime()
    )
  }, [studies, filter])

  const arrived = useMemo(() => {
    return studies.filter(s => s.status === 'arrived')
      .sort((a, b) => new Date(b.arrivedAt ?? '').getTime() - new Date(a.arrivedAt ?? '').getTime())
  }, [studies])

  const onArrive = (study: RadiologyStudy, consentNow?: boolean) => {
    markArrived(study.id)
    if (consentNow) setContrastConsented(study.id, true)
    notifyAndAudit({
      to: 'radiology', type: 'system', priority: study.priority === 'STAT' ? 'high' : 'medium',
      title: `Patient arrived · ${study.patientName}`,
      body: `${study.patientName} (${study.patientId}) checked in for ${study.modality} ${study.name}. Ready for the modality tech.`,
      patientName: study.patientName,
      audit: { action: 'radiology_order', resource: 'radiology_study', resourceId: study.id, detail: `Patient arrived${consentNow ? ' · contrast consent captured at desk' : ''}`, userName: meName },
    })
    toast.success(`${study.patientName} checked in · tech notified`)
  }

  const lateCount = scheduled.filter(s => minsTo(s.scheduledFor) < 0).length
  const soonCount = scheduled.filter(s => { const m = minsTo(s.scheduledFor); return m >= 0 && m <= 30 }).length

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-[#0E7490]" />Arrival desk
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Check patients in when they arrive · capture contrast consent if not yet done · alert the tech
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
          {([
            { k: 'all', label: 'All scheduled', n: scheduled.length },
            { k: 'soon', label: 'Due in 30m', n: soonCount },
            { k: 'late', label: 'Late', n: lateCount },
          ] as const).map(t => (
            <button key={t.k} onClick={() => setFilter(t.k)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer",
                filter === t.k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {t.label} <span className="text-slate-400">{t.n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className={cn("rounded-xl border p-3", soonCount > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white')}>
          <p className="text-2xl font-bold text-amber-700">{soonCount}</p>
          <p className="text-xs font-semibold text-amber-700 mt-1">Due in next 30 minutes</p>
        </div>
        <div className={cn("rounded-xl border p-3", lateCount > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white')}>
          <p className="text-2xl font-bold text-red-700">{lateCount}</p>
          <p className="text-xs font-semibold text-red-700 mt-1">Late (past slot, not arrived)</p>
        </div>
        <div className="rounded-xl border border-[rgba(14,116,144,0.20)] bg-[rgba(14,116,144,0.07)] p-3">
          <p className="text-2xl font-bold text-[#0E7490]">{arrived.length}</p>
          <p className="text-xs font-semibold text-[#0E7490] mt-1">Currently checked in</p>
        </div>
      </div>

      {/* Scheduled queue */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2">Scheduled — awaiting arrival ({scheduled.length})</h2>
        {scheduled.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No scheduled studies</p>
            <p className="text-xs text-slate-400 mt-1">Book slots from the Scheduling desk.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {scheduled.map(s => {
              const c = RADIOLOGY_CATALOG[s.code]
              const eta = minsTo(s.scheduledFor)
              const late = eta < 0
              const soon = !late && eta <= 30
              const needsContrast = !!c?.contrast
              const consentMissing = needsContrast && !s.contrastConsented
              return (
                <motion.li key={s.id} layout
                  className={cn("rounded-xl bg-white border p-4",
                    late ? 'border-red-200 ring-1 ring-red-100'
                    : soon ? 'border-amber-200'
                    : 'border-slate-200')}>
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-bold text-slate-900">{s.patientName}</p>
                        <span className="text-[11px] font-bold text-slate-400">{s.patientId}</span>
                        <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded border", MODALITY_TINT[s.modality])}>{s.modality}</span>
                        <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded", PRIORITY_TINT[s.priority])}>{s.priority}</span>
                        {(() => { const issues = checkPrepReadiness(s).data; return issues.length
                          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-0.5"><AlertTriangle className="h-2.5 w-2.5" />AI: {issues.length} prep issue{issues.length > 1 ? "s" : ""}</span>
                          : <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">AI: prep ready</span> })()}
                        {late && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" />Late
                          </span>
                        )}
                        {consentMissing && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-700">Consent pending</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-slate-700 mt-1">{s.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />Slot: <b>{fmtSlot(s.scheduledFor)}</b>
                        {' · '}{late ? `${Math.abs(eta)}m late` : `in ${eta}m`}
                        {' · '}ordered by {s.doctorName}
                      </p>
                      {c?.preparation && (
                        <p className="text-[11px] text-[#0E7490] mt-1">
                          Prep: {c.preparation}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {consentMissing ? (
                        <button onClick={() => onArrive(s, true)}
                          className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer">
                          <ShieldCheck className="h-3.5 w-3.5" />Check in + consent
                        </button>
                      ) : (
                        <button onClick={() => onArrive(s)}
                          className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-[#0E7490] hover:bg-[#0B5A6E] text-white cursor-pointer">
                          <UserCheck className="h-3.5 w-3.5" />Check in
                        </button>
                      )}
                    </div>
                  </div>
                </motion.li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Recently arrived */}
      {arrived.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-700 mb-2">Currently checked in ({arrived.length})</h2>
          <ul className="space-y-2">
            {arrived.slice(0, 6).map(s => (
              <li key={s.id} className="rounded-xl bg-[rgba(14,116,144,0.07)]/40 border border-[rgba(14,116,144,0.20)] p-3 flex items-center gap-3">
                <UserCheck className="h-4 w-4 text-[#0E7490] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">{s.patientName} <span className="text-[11px] font-bold text-slate-400">{s.patientId}</span></p>
                  <p className="text-xs text-slate-500">{s.modality} {s.name} · arrived {Math.round((Date.now() - new Date(s.arrivedAt ?? '').getTime()) / 60000)}m ago</p>
                </div>
                <a href="/radiology/bench" className="text-[11px] font-bold text-[#0E7490] hover:underline flex items-center gap-0.5">
                  Modality bench <ArrowRight className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-[rgba(14,116,144,0.07)] border border-[rgba(14,116,144,0.20)] rounded-xl p-4">
        <p className="text-xs font-bold text-[#0B5A6E] flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3" />Pipeline downstream
        </p>
        <p className="text-[11px] text-[#0E7490] mt-1">
          Once checked in, the radiology tech sees the study on the Modality Bench (`/radiology/bench`),
          claims acquisition, uploads images, and the study moves to the Reading Room for the radiologist.
        </p>
      </div>
    </div>
  )
}
