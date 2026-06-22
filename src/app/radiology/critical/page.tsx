"use client"

import { useMemo, useState } from "react"
import {
  Siren, Phone, ArrowUpCircle, CheckCircle2, Clock, AlertTriangle, ShieldCheck,
} from "lucide-react"
import { useRadiologyStudiesStore, type RadiologyStudy } from "@/store/useRadiologyStudiesStore"
import { useAuthStore } from "@/store/useAuthStore"
import { detectFindings, isCriticalText, minsElapsed } from "@/lib/radiologyAI"
import { PRIORITY_META } from "@/lib/radiologyCatalog"
import { notifyAndAudit, notifyAndAuditMany } from "@/lib/notifyAndAudit"
import { StatCard } from "@/components/ui/stat-card"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// SLA: a critical finding must be communicated + acknowledged within 30 min.
const SLA_MIN = 30
const REPORTED_OR_LATER = new Set(["reported", "verified", "released"])

function isCritical(s: RadiologyStudy): boolean {
  if (isCriticalText(s.reportSections?.impression) || isCriticalText(s.reportSections?.findings)) return true
  if (s.aiFindings?.some(f => f.category === "critical")) return true
  // derive from AI if a report exists but findings not persisted
  if (REPORTED_OR_LATER.has(s.status)) return detectFindings(s).data.some(f => f.category === "critical")
  return false
}

export default function CriticalResults() {
  const studies = useRadiologyStudiesStore(s => s.studies)
  const logCallback = useRadiologyStudiesStore(s => s.logCallback)
  const ackResult = useRadiologyStudiesStore(s => s.ackResult)
  const startEscalation = useRadiologyStudiesStore(s => s.startEscalation)
  const ackEscalation = useRadiologyStudiesStore(s => s.ackEscalation)
  const me = useAuthStore(s => s.currentUser)
  const meName = me?.name ?? "Radiology"
  const [callbackFor, setCallbackFor] = useState<string | null>(null)
  const [recipient, setRecipient] = useState("")

  const criticals = useMemo(() => studies.filter(isCritical).sort((a, b) => {
    const at = new Date(a.reportedAt ?? a.orderedAt).getTime()
    const bt = new Date(b.reportedAt ?? b.orderedAt).getTime()
    return at - bt
  }), [studies])

  const open = criticals.filter(s => !s.acknowledgedAt)
  const acked = criticals.filter(s => s.acknowledgedAt)
  const slaBreached = open.filter(s => minsElapsed(s.reportedAt ?? s.orderedAt) > SLA_MIN)

  const findingLabel = (s: RadiologyStudy) => {
    const f = (s.aiFindings ?? detectFindings(s).data).find(x => x.category === "critical")
    return f?.label ?? (isCriticalText(s.reportSections?.impression) ? s.reportSections.impression : "Critical finding")
  }

  const onCallback = (s: RadiologyStudy) => {
    const to = recipient.trim() || s.doctorName || "ordering doctor"
    logCallback(s.id, meName, to)
    notifyAndAudit({
      to: "doctor", type: "critical_value", priority: "critical",
      title: `Critical radiology finding · ${s.patientName}`,
      body: `${s.name}: ${findingLabel(s)}. Verbal callback logged to ${to}. Acknowledge to close SLA.`,
      patientName: s.patientName,
      channels: ["in_app", "sms"],
      audit: { action: "radiology_critical_callback", resource: "radiology_study", resourceId: s.id, detail: `Callback to ${to} — ${findingLabel(s)}`, userName: meName },
    })
    setCallbackFor(null); setRecipient("")
    toast.success(`Callback logged to ${to}`)
  }

  const onEscalate = (s: RadiologyStudy) => {
    startEscalation(s.id)
    const level = (s.escalation?.level ?? 0) + 1
    notifyAndAuditMany(["doctor", "admin"], {
      type: "critical_value", priority: "critical",
      title: `Escalation L${level} · ${s.patientName}`,
      body: `Unacknowledged critical ${s.name} finding (${findingLabel(s)}) escalated to level ${level}.`,
      patientName: s.patientName,
      channels: ["in_app", "sms"],
      audit: { action: "radiology_critical_callback", resource: "radiology_study", resourceId: s.id, detail: `Escalated to L${level}`, userName: meName },
    })
    toast.warning(`Escalated to level ${level}`)
  }

  const onAck = (s: RadiologyStudy) => {
    ackResult(s.id)
    if (s.escalation) ackEscalation(s.id, meName)
    toast.success(`Acknowledged — SLA closed for ${s.patientName}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="h-9 w-9 rounded-xl flex items-center justify-center bg-red-50 text-red-600"><Siren className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#101828]">Critical Results</h1>
          <p className="text-sm text-[#667085]">Closed-loop communication · {SLA_MIN}-minute SLA · escalation ladder · acknowledgment capture</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open criticals" value={open.length} sub="awaiting acknowledgment" icon={AlertTriangle} color="red" />
        <StatCard label="SLA breached" value={slaBreached.length} sub={`> ${SLA_MIN} min open`} icon={Clock} color="amber" />
        <StatCard label="Acknowledged" value={acked.length} sub="loop closed" icon={CheckCircle2} color="green" />
        <StatCard label="Total flagged" value={criticals.length} sub="critical findings" icon={ShieldCheck} color="blue" />
      </div>

      {/* Board */}
      <div className="rounded-2xl border border-[#EAECF2] bg-white shadow-[var(--shadow-card)]">
        <div className="px-5 py-4 border-b border-[#EAECF2] flex items-center gap-2">
          <Siren className="h-4 w-4 text-red-600" />
          <h3 className="text-sm font-bold text-slate-900">Critical findings board</h3>
        </div>
        {criticals.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">No critical findings — all clear.</div>
        ) : (
          <div className="divide-y divide-[#F2F4F8]">
            {criticals.map(s => {
              const mins = minsElapsed(s.reportedAt ?? s.orderedAt)
              const breached = !s.acknowledgedAt && mins > SLA_MIN
              const pct = Math.min(100, (mins / SLA_MIN) * 100)
              return (
                <div key={s.id} className={cn("px-5 py-4", s.acknowledgedAt ? "bg-emerald-50/30" : breached ? "bg-red-50/40" : "")}>
                  <div className="flex items-start gap-3 flex-wrap">
                    <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0", s.acknowledgedAt ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
                      {s.acknowledgedAt ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14px] font-bold text-slate-900">{s.patientName}</p>
                        <span className={cn("text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded border", PRIORITY_META[s.priority].badge)}>{s.priority}</span>
                        <span className="text-[11px] text-slate-400">{s.name}</span>
                      </div>
                      <p className="text-[12.5px] font-semibold text-red-700 mt-0.5">{findingLabel(s)}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Reported {mins}m ago · Dr ordering: {s.doctorName}{s.callback ? ` · called ${s.callback.recipient} by ${s.callback.calledBy}` : ""}{s.escalation ? ` · escalated L${s.escalation.level}` : ""}</p>
                      {/* SLA timer */}
                      {!s.acknowledgedAt && (
                        <div className="mt-2 max-w-xs">
                          <div className="flex items-center justify-between text-[10px] font-semibold mb-0.5">
                            <span className={breached ? "text-red-600" : "text-slate-500"}>SLA {breached ? "BREACHED" : `${Math.max(0, SLA_MIN - mins)}m left`}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className={cn("h-full rounded-full", breached ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-[#0E7490]")} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                      {s.acknowledgedAt && <p className="text-[11px] font-semibold text-emerald-700 mt-1">Acknowledged · loop closed</p>}
                    </div>

                    {/* Actions */}
                    {!s.acknowledgedAt && (
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {callbackFor === s.id ? (
                          <div className="flex items-center gap-1.5">
                            <input autoFocus value={recipient} onChange={e => setRecipient(e.target.value)}
                              placeholder={s.doctorName} className="h-8 w-36 px-2 rounded-lg text-[12px] border border-[#EAECF2] focus:outline-none focus:border-[#0E7490]" />
                            <button onClick={() => onCallback(s)} className="h-8 px-3 rounded-lg text-[12px] font-semibold bg-[#0B5A6E] text-white hover:bg-[#172E6E] cursor-pointer">Log</button>
                          </div>
                        ) : (
                          <button onClick={() => { setCallbackFor(s.id); setRecipient("") }}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold bg-red-600 text-white hover:bg-red-700 cursor-pointer">
                            <Phone className="h-3.5 w-3.5" /> Log callback
                          </button>
                        )}
                        <div className="flex gap-1.5">
                          <button onClick={() => onEscalate(s)} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[12px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 cursor-pointer">
                            <ArrowUpCircle className="h-3.5 w-3.5" /> Escalate
                          </button>
                          <button onClick={() => onAck(s)} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[12px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Ack
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
