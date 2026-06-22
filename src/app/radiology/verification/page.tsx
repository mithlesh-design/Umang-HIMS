"use client"

import { useMemo, useState } from "react"
import {
  ShieldCheck, ChevronDown, ChevronRight, CheckCircle, Stethoscope, Clock, ShieldAlert,
  Ban, UserCheck,
} from "lucide-react"
import {
  useRadiologyStudiesStore,
  type RadiologyStudy, type RadTech,
} from "@/store/useRadiologyStudiesStore"
import { RADIOLOGY_CATALOG, TEMPLATE_SECTIONS, type Priority } from "@/lib/radiologyCatalog"
import { useAuthStore } from "@/store/useAuthStore"
import { notifyAndAuditMany } from "@/lib/notifyAndAudit"
import { checkReportConsistency, isCriticalText } from "@/lib/radiologyAI"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const PRIORITY_STYLE: Record<Priority, string> = {
  STAT: "bg-red-100 text-red-700", Urgent: "bg-amber-100 text-amber-700", Routine: "bg-slate-100 text-slate-600",
  Trauma: "bg-red-100 text-red-800", Stroke: "bg-red-600 text-white", Critical: "bg-red-700 text-white",
}
const timeAgo = (iso?: string) => {
  if (!iso) return ""
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}
const isCriticalStudy = (s: RadiologyStudy) => isCriticalText(s.reportSections.impression) || isCriticalText(s.reportSections.findings)

export default function Verification() {
  const studies = useRadiologyStudiesStore(s => s.studies)
  const consultantVerify = useRadiologyStudiesStore(s => s.consultantVerify)
  const currentUser = useAuthStore(s => s.currentUser)
  const me: RadTech = { id: currentUser?.id ?? "RD-202", name: currentUser?.name ?? "Verifier" }

  const [expandedId, setExpandedId] = useState<string | null>(null)

  const pending = useMemo(
    () => studies.filter(s => s.status === "reported")
      .sort((a, b) => {
        const pri = { Critical: -3, Stroke: -2, Trauma: -1, STAT: 0, Urgent: 1, Routine: 2 } as const
        return pri[a.priority] - pri[b.priority]
      }),
    [studies]
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-[#0E7490]" /> Verification
        </h1>
        <p className="text-sm text-[#64748B] mt-1">Resident → consultant sign-off · AI consistency gate · releases to ordering doctor and patient</p>
      </div>

      <div className="space-y-2">
        {pending.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <ShieldCheck className="h-9 w-9 mb-2 opacity-40" />
            <p className="text-sm font-semibold">No reports pending verification</p>
          </div>
        )}
        {pending.map(s => {
          const isCritical = isCriticalStudy(s)
          return (
            <VerificationRow key={s.id} s={s}
              expanded={expandedId === s.id}
              onToggle={() => setExpandedId(id => id === s.id ? null : s.id)}
              onVerify={() => {
                // AI consistency gate — block release on inconsistent/missing impression.
                const consistency = checkReportConsistency(s)
                if (!consistency.data.ok) {
                  toast.error(`Release blocked: ${consistency.data.issues[0]}`)
                  setExpandedId(s.id)
                  return
                }
                consultantVerify(s.id, me)
                const action = isCritical ? 'radiology_critical_callback' : 'radiology_report_verified'
                notifyAndAuditMany(['doctor', 'patient'], {
                  type: isCritical ? 'critical_value' : 'system',
                  priority: isCritical ? 'critical' : 'medium',
                  title: `${s.name} verified${isCritical ? ' · CRITICAL' : ''} · ${s.patientName}`,
                  body: `${s.modality} ${s.name} for ${s.patientName} (${s.patientId}) verified and released by ${me.name}. Ordering doctor: ${s.doctorName}.${isCritical ? ' Critical impression — review immediately.' : ''}`,
                  patientName: s.patientName,
                  audit: { action, resource: 'radiology_study', resourceId: s.id, detail: `Verified ${s.modality} ${s.name} for ${s.patientId}${isCritical ? ' (critical)' : ''}`, userName: me.name },
                })
                toast.success(`${s.name} verified & released · ${s.doctorName} notified`)
              }} />
          )
        })}
      </div>
    </div>
  )
}

function VerificationRow(props: {
  s: RadiologyStudy
  expanded: boolean
  onToggle: () => void
  onVerify: () => void
}) {
  const { s, expanded } = props
  const cat = RADIOLOGY_CATALOG[s.code]
  const tmpl = cat ? TEMPLATE_SECTIONS[cat.template] : []
  const minsElapsed = Math.round((Date.now() - new Date(s.orderedAt).getTime()) / 60000)
  const isCritical = isCriticalStudy(s)
  const consistency = checkReportConsistency(s)
  const blocked = !consistency.data.ok

  return (
    <div className={cn("rounded-xl bg-white ring-1 overflow-hidden", isCritical ? "ring-red-200" : "ring-slate-200/70")}>
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <span className={cn("flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-lg", PRIORITY_STYLE[s.priority])}>{s.priority}</span>

        <button onClick={props.onToggle} className="flex-1 min-w-0 text-left cursor-pointer">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900 truncate">{s.patientName}</span>
            <span className="text-[11px] font-bold text-slate-400">{s.patientId}</span>
            <span className="text-[12px] font-bold text-[#0E7490]">{s.name}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[rgba(14,116,144,0.12)] text-[#0E7490]">{s.modality}</span>
            {s.residentReadBy && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#0B5A6E]/[0.08] text-[#0B5A6E] flex items-center gap-0.5">
                <UserCheck className="h-3 w-3" />Resident read
              </span>
            )}
            {isCritical && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-0.5">
                <ShieldAlert className="h-3 w-3" />CRITICAL
              </span>
            )}
            {blocked && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-0.5">
                <Ban className="h-3 w-3" />Consistency
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1">
            <Stethoscope className="h-3 w-3" />read by {s.readingBy?.name ?? "—"}
            <span className="text-slate-400 mx-1">·</span>
            <Clock className="h-3 w-3" />{minsElapsed}m elapsed · reported {timeAgo(s.reportedAt)}
          </p>
        </button>

        <button onClick={props.onVerify}
          className={cn("flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer whitespace-nowrap", blocked ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300" : "text-white")}
          style={blocked ? undefined : { background: "linear-gradient(135deg,#16A34A,#0B5A6E)", boxShadow: "0 2px 8px rgba(22,163,74,0.25)" }}>
          {blocked ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}{blocked ? "Resolve to release" : "Consultant verify & release"}
        </button>
        <button onClick={props.onToggle} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer text-slate-400">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-2">
          {/* AI consistency gate */}
          <div className={cn("rounded-lg ring-1 p-2.5 flex items-start gap-2", blocked ? "bg-amber-50 ring-amber-200" : "bg-emerald-50 ring-emerald-200")}>
            {blocked ? <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" /> : <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />}
            <div>
              <p className={cn("text-[12px] font-bold", blocked ? "text-amber-800" : "text-emerald-800")}>
                AI consistency check {blocked ? "— release blocked" : "— passed"}
              </p>
              {blocked
                ? <ul className="text-[11.5px] text-amber-700 list-disc ml-4 mt-0.5">{consistency.data.issues.map((i, k) => <li key={k}>{i}</li>)}</ul>
                : <p className="text-[11.5px] text-emerald-700">Findings ↔ impression are consistent and required sections complete.</p>}
            </div>
          </div>
          {tmpl.map(sec => {
            const value = s.reportSections[sec.key] ?? ""
            if (!value) return null
            return (
              <div key={sec.key} className="bg-white rounded-lg ring-1 ring-slate-200/70 p-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">{sec.label}</p>
                <p className="text-[12px] text-slate-700 whitespace-pre-wrap">{value}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
