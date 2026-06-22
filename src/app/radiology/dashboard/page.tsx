"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ScanLine, Users, AlertTriangle, Phone, CheckCircle, Clock, Hourglass,
  Sparkles, ArrowRight, ShieldCheck, FileText, ClipboardList, PackageCheck,
  Calendar, UserCheck, Send, Activity, ChevronRight,
} from "lucide-react"
import {
  useRadiologyStudiesStore, type RadiologyStudy, type StudyStatus,
} from "@/store/useRadiologyStudiesStore"
import { useAuthStore } from "@/store/useAuthStore"
import { type Modality } from "@/lib/radiologyCatalog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { notifyAndAudit, notifyAndAuditMany } from "@/lib/notifyAndAudit"

const MOD_LABELS: Record<Modality, string> = {
  XR: "X-Ray", CT: "CT", MRI: "MRI", US: "Ultrasound", MAMMO: "Mammo", NM: "Nuclear",
}
const ACTIVE_STATUSES: StudyStatus[] = ["ordered", "scheduled", "arrived", "acquiring", "acquired", "reading", "reported"]
const CALLBACK_WINDOW_MS = 24 * 3600_000
const CRITICAL_RE = /\b(haemorrhage|hemorrhage|bleed|pneumothorax|tamponade|stroke|infarct|free air|pe\b|pulmonary embolism|bi-?rads (4|5|6)|lung-?rads (4|4a|4b|4x)|pi-?rads (4|5))\b/i

const timeAgo = (iso?: string) => {
  if (!iso) return ""
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}
const minsElapsed = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60000)
const hasCritical = (s: RadiologyStudy) =>
  CRITICAL_RE.test(s.reportSections.impression ?? "") ||
  CRITICAL_RE.test(s.reportSections.findings ?? "")

export default function RadiologyOverview() {
  const studies = useRadiologyStudiesStore(s => s.studies)
  const logCallback = useRadiologyStudiesStore(s => s.logCallback)
  const currentUser = useAuthStore(s => s.currentUser)
  const meName = currentUser?.name ?? "RIS"

  const [callbackId, setCallbackId] = useState<string | null>(null)
  const [callbackTo, setCallbackTo] = useState("")

  const m = useMemo(() => {
    const orderedOnly = studies.filter(s => s.status === "ordered")
    const scheduledOnly = studies.filter(s => s.status === "scheduled")
    const arrivedOnly = studies.filter(s => s.status === "arrived")
    const ordered = studies.filter(s => s.status === "ordered" || s.status === "scheduled")
    const onBench = studies.filter(s => s.status === "arrived" || s.status === "acquiring")
    const acquired = studies.filter(s => s.status === "acquired")
    const reading = studies.filter(s => s.status === "reading")
    const reported = studies.filter(s => s.status === "reported")
    const released = studies.filter(s => s.status === "released")
    const releasedToday = released.filter(s => s.releasedAt && new Date(s.releasedAt).toDateString() === new Date().toDateString())
    const callbackCutoff = Date.now() - CALLBACK_WINDOW_MS
    const criticalPendingCallback = released.filter(s =>
      !s.callback && hasCritical(s) && s.releasedAt && new Date(s.releasedAt).getTime() >= callbackCutoff
    )
    const tatBreaches = studies.filter(s =>
      ACTIVE_STATUSES.includes(s.status) && minsElapsed(s.orderedAt) > s.expectedTATmin
    )
    const overOverdue = studies.filter(s =>
      ACTIVE_STATUSES.includes(s.status) && minsElapsed(s.orderedAt) > 2 * s.expectedTATmin
    )
    const pipeline: Record<Modality, Record<StudyStatus, number>> = {} as Record<Modality, Record<StudyStatus, number>>
    for (const mm of ["XR", "CT", "MRI", "US", "MAMMO", "NM"] as Modality[]) {
      pipeline[mm] = {
        ordered: 0, scheduled: 0, arrived: 0, acquiring: 0, acquired: 0,
        reading: 0, reported: 0, verified: 0, released: 0, cancelled: 0,
      }
    }
    for (const s of studies) {
      if (ACTIVE_STATUSES.includes(s.status)) pipeline[s.modality][s.status]++
    }
    const wlMap: Record<string, number> = {}
    for (const s of studies) {
      if (s.status === "acquiring" && s.acquiringBy) wlMap[s.acquiringBy.name] = (wlMap[s.acquiringBy.name] ?? 0) + 1
      if (s.status === "reading" && s.readingBy) wlMap[s.readingBy.name] = (wlMap[s.readingBy.name] ?? 0) + 1
    }
    const techLoad = Object.entries(wlMap).sort((a, b) => b[1] - a[1])
    return {
      kpis: {
        ordered: ordered.length,
        orderedOnly: orderedOnly.length,
        scheduledOnly: scheduledOnly.length,
        arrivedOnly: arrivedOnly.length,
        onBench: onBench.length,
        pendingRead: acquired.length + reading.length,
        pendingVerify: reported.length,
        releasedToday: releasedToday.length,
        critPending: criticalPendingCallback.length,
        tatBreaches: tatBreaches.length,
      },
      pipeline, criticalPendingCallback, reported, techLoad, overOverdue,
    }
  }, [studies])

  const onLogCallback = (id: string, patient: string) => {
    const recipient = callbackTo.trim() || "ordering doctor"
    logCallback(id, meName, recipient)
    setCallbackId(null); setCallbackTo("")
    notifyAndAudit({
      to: 'doctor', type: 'critical_value', priority: 'critical',
      title: `Critical imaging callback · ${patient}`,
      body: `Radiology notified ${recipient} of critical finding for ${patient}.`,
      patientName: patient,
      audit: { action: 'radiology_critical_callback', resource: 'radiology_study', resourceId: id, detail: `Callback to ${recipient}`, userName: meName },
    })
    toast.success(`Callback logged for ${patient} to ${recipient} · SLA closed`)
  }

  // M9-C — TAT escalation: surface stuck studies in a single page.
  function escalateRadiologyTat() {
    const overdue = m.kpis.tatBreaches ?? 0
    if (overdue === 0) { toast(`No TAT breaches right now`); return }
    notifyAndAuditMany(['doctor', 'admin'], {
      type: 'system', priority: 'high',
      title: `${overdue} radiology TAT breach${overdue === 1 ? '' : 'es'}`,
      body: `${overdue} stud${overdue === 1 ? 'y is' : 'ies are'} past TAT. Pulling on-call radiologist.`,
      audit: { action: 'radiology_critical_callback', resource: 'radiology_tat', detail: `${overdue} TAT breaches escalated`, userName: meName },
    })
    toast.success(`Escalated ${overdue} TAT breach${overdue === 1 ? '' : 'es'} · admin + doctor notified`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">RIS Command Center</h1>
          <p className="text-sm text-[#64748B] mt-1">Radiology incharge command center · pipeline by modality · critical-finding SLA · AI exception triage</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/radiology/inbox" className="flex items-center gap-1.5 text-xs font-bold text-[#0E7490] bg-[rgba(14,116,144,0.07)] hover:bg-[rgba(14,116,144,0.14)] px-3 py-2 rounded-xl"><ClipboardList className="h-3.5 w-3.5" />Open Inbox</Link>
          <Link href="/radiology/bench" className="flex items-center gap-1.5 text-xs font-bold text-[#0E7490] bg-[rgba(14,116,144,0.07)] hover:bg-[rgba(14,116,144,0.14)] px-3 py-2 rounded-xl"><ScanLine className="h-3.5 w-3.5" />Open Bench</Link>
          <Link href="/radiology/reading" className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl"
            style={{ background: "linear-gradient(135deg,#0B5A6E,#0E7490)", boxShadow: "0 2px 8px rgba(14,116,144,0.25)" }}>
            <FileText className="h-3.5 w-3.5" />Reading Room
          </Link>
        </div>
      </div>

      {/* Enterprise command surfaces */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { href: "/radiology/ai-command", label: "AI Command Center", sub: "Queue · forecast · assistant", icon: Sparkles, accent: "#0B5A6E" },
          { href: "/radiology/critical", label: "Critical Results", sub: "Closed-loop · SLA", icon: AlertTriangle, accent: "#DC2626" },
          { href: "/radiology/analytics", label: "Analytics", sub: "TAT · utilization · revenue", icon: Activity, accent: "#0E9F6E" },
          { href: "/radiology/distribution", label: "Distribution", sub: "Deliver · patient summary", icon: Send, accent: "#0E7490" },
        ].map(({ href, label, sub, icon: Icon, accent }) => (
          <Link key={href} href={href} className="group flex items-center gap-3 rounded-2xl border border-[#EAECF2] bg-white p-3.5 hover:border-[#D0D5DD] hover:shadow-[var(--shadow-card-hover)] transition-all">
            <span className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accent}14`, color: accent }}><Icon className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-slate-900 truncate">{label}</p>
              <p className="text-[11px] text-slate-500 truncate">{sub}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300 ml-auto group-hover:text-[#0B5A6E] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </Link>
        ))}
      </div>

      {/* M13.2 — Order-to-release pipeline.
          Seven chevron-linked stages mirroring the actual radiology journey.
          Each stage shows live counts + a direct nav button so the right
          person can jump straight into their next action. */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#0E7490]" />Order-to-release journey
          </h2>
          <p className="text-[11px] text-slate-500">Order → schedule → arrival → bench → read → verify → release</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 items-stretch">
          {[
            { label: 'Ordered',     sub: 'Needs slot',       count: m.kpis.orderedOnly,    color: 'border-amber-200 bg-amber-50',     icon: ClipboardList, fg: 'text-amber-700',     href: '/radiology/schedule', cta: 'Book slot' },
            { label: 'Scheduled',   sub: 'Awaiting arrival', count: m.kpis.scheduledOnly,  color: 'border-[rgba(14,116,144,0.20)] bg-[rgba(14,116,144,0.07)]',       icon: Calendar,      fg: 'text-[#0E7490]',      href: '/radiology/arrival',  cta: 'Check in' },
            { label: 'Arrived',     sub: 'Ready for scan',   count: m.kpis.arrivedOnly,    color: 'border-[rgba(14,116,144,0.20)] bg-[rgba(14,116,144,0.07)]',       icon: UserCheck,     fg: 'text-[#0E7490]',      href: '/radiology/bench',    cta: 'Acquire' },
            { label: 'Acquired',    sub: 'Pending read',     count: m.kpis.pendingRead,    color: 'border-[rgba(14,116,144,0.20)] bg-[rgba(14,116,144,0.07)]',   icon: ScanLine,      fg: 'text-[#0E7490]',    href: '/radiology/reading',  cta: 'Read' },
            { label: 'Reported',    sub: 'Pending verify',   count: m.kpis.pendingVerify,  color: 'border-[rgba(14,116,144,0.20)] bg-[rgba(14,116,144,0.07)]',       icon: ShieldCheck,   fg: 'text-[#0E7490]',      href: '/radiology/verification', cta: 'Verify' },
            { label: 'Released',    sub: 'Today',            count: m.kpis.releasedToday,  color: 'border-emerald-200 bg-emerald-50', icon: Send,          fg: 'text-emerald-700',   href: '/radiology/inbox',    cta: 'View inbox' },
            { label: 'Critical CB', sub: 'Awaiting callback',count: m.kpis.critPending,    color: m.kpis.critPending > 0 ? 'border-red-300 bg-red-50 ring-2 ring-red-100' : 'border-slate-200 bg-white', icon: Phone, fg: m.kpis.critPending > 0 ? 'text-red-700' : 'text-slate-400', href: '#critical-callback', cta: 'Log callback' },
          ].map((s, i, arr) => (
            <Link key={s.label} href={s.href}
              className={cn("relative rounded-xl border p-3 hover:shadow-md transition flex flex-col gap-1 cursor-pointer group", s.color)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <s.icon className={cn("h-4 w-4 flex-shrink-0", s.fg)} />
                  <p className={cn("text-xs font-bold truncate", s.fg)}>{s.label}</p>
                </div>
                {i < arr.length - 1 && <ChevronRight className="absolute -right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 hidden lg:block" />}
              </div>
              <p className={cn("text-2xl font-bold leading-none", s.fg)}>{s.count}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{s.sub}</p>
              <p className={cn("text-[10px] font-bold mt-1 inline-flex items-center gap-0.5 group-hover:underline", s.fg)}>
                {s.cta} <ArrowRight className="h-2.5 w-2.5" />
              </p>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Ordered / scheduled", value: m.kpis.ordered, icon: ClipboardList, fg: "text-amber-600", bg: "bg-amber-50" },
          { label: "On bench", value: m.kpis.onBench, icon: ScanLine, fg: "text-[#0E7490]", bg: "bg-[rgba(14,116,144,0.07)]" },
          { label: "Pending read", value: m.kpis.pendingRead, icon: Hourglass, fg: "text-[#0E7490]", bg: "bg-[rgba(14,116,144,0.07)]" },
          { label: "Pending verify", value: m.kpis.pendingVerify, icon: ShieldCheck, fg: "text-[#0E7490]", bg: "bg-[rgba(14,116,144,0.07)]" },
          { label: "Released today", value: m.kpis.releasedToday, icon: PackageCheck, fg: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "TAT breaches", value: m.kpis.tatBreaches, icon: AlertTriangle, fg: "text-orange-600", bg: "bg-orange-50", action: escalateRadiologyTat, actionLabel: "Escalate" },
        ].map(s => (
          <div key={s.label} className={cn("rounded-xl p-3 flex items-center gap-3", s.bg)}>
            <div className="p-2 rounded-lg bg-white shadow-sm"><s.icon className={cn("h-4 w-4", s.fg)} /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 truncate">{s.label}</p>
              <h3 className="text-xl font-bold text-slate-900">{s.value}</h3>
            </div>
            {s.action && typeof s.value === 'number' && s.value > 0 ? (
              <button onClick={s.action} className="text-[10.5px] font-bold text-orange-700 bg-white border border-orange-200 rounded-md px-2 py-1 hover:bg-orange-50 cursor-pointer">
                {s.actionLabel}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">Pipeline by modality</h2>
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {(["XR", "CT", "MRI", "US", "MAMMO"] as Modality[]).map(mm => {
                const counts = m.pipeline[mm]
                const total = ACTIVE_STATUSES.reduce((s, st) => s + counts[st], 0)
                return (
                  <div key={mm} className="rounded-lg ring-1 ring-slate-200/70 p-2.5">
                    <p className="text-[11px] font-bold text-slate-700">{MOD_LABELS[mm]}</p>
                    <p className="text-lg font-bold text-slate-900 leading-none mt-0.5">{total}</p>
                    <div className="mt-2 space-y-0.5">
                      {counts.scheduled + counts.ordered > 0 && <p className="text-[10px] text-slate-500"><b>{counts.scheduled + counts.ordered}</b> awaiting</p>}
                      {counts.arrived + counts.acquiring > 0 && <p className="text-[10px] text-amber-600"><b>{counts.arrived + counts.acquiring}</b> on bench</p>}
                      {counts.acquired > 0 && <p className="text-[10px] text-[#0E7490]"><b>{counts.acquired}</b> awaiting read</p>}
                      {counts.reading > 0 && <p className="text-[10px] text-[#0E7490]"><b>{counts.reading}</b> being read</p>}
                      {counts.reported > 0 && <p className="text-[10px] text-[#0E7490]"><b>{counts.reported}</b> pending verify</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-red-100 bg-red-50 flex items-center gap-2">
              <Phone className="h-4 w-4 text-red-600" />
              <h2 className="text-sm font-bold text-red-800">Critical pending callback</h2>
              <span className="text-xs text-red-600">{m.criticalPendingCallback.length}</span>
            </div>
            {m.criticalPendingCallback.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">No critical findings awaiting callback. ✓</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {m.criticalPendingCallback.map(s => (
                  <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 flex items-center gap-2 flex-wrap">
                        <span className="font-bold">{s.patientName}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">{s.name}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">impression: {s.reportSections.impression?.slice(0, 80)}…</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">ordering: {s.doctorName} · released {timeAgo(s.releasedAt)}</p>
                    </div>
                    {callbackId === s.id ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <input value={callbackTo} onChange={e => setCallbackTo(e.target.value)} placeholder={`Call ${s.doctorName}…`}
                          className="w-40 h-7 px-2 text-[11px] rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        <button onClick={() => onLogCallback(s.id, s.patientName)}
                          className="text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded-lg cursor-pointer">Confirm log</button>
                        <button onClick={() => { setCallbackId(null); setCallbackTo("") }}
                          className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => { setCallbackId(s.id); setCallbackTo(s.doctorName) }}
                        className="flex items-center gap-1 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded-lg cursor-pointer">
                        <Phone className="h-3 w-3" />Log callback
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {m.reported.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hourglass className="h-4 w-4 text-[#0E7490]" />
                  <h2 className="text-sm font-bold text-slate-800">Pending verification</h2>
                  <span className="text-xs text-slate-400">{m.reported.length}</span>
                </div>
                <Link href="/radiology/verification" className="text-xs font-bold text-[#0E7490] hover:underline flex items-center gap-1">Open Verification <ArrowRight className="h-3 w-3" /></Link>
              </div>
              <div className="divide-y divide-slate-100">
                {m.reported.slice(0, 5).map(s => (
                  <div key={s.id} className="px-4 py-2.5 text-sm">
                    <span className="font-bold text-slate-800">{s.patientName}</span>
                    <span className="text-slate-400 mx-2">·</span>
                    <span className="text-[#0E7490]">{s.name}</span>
                    <span className="text-slate-400 mx-2">·</span>
                    <span className="text-[11px] text-slate-500">read by {s.readingBy?.name ?? "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-[#0E7490]" />Workload</h2>
            {m.techLoad.length === 0 ? (
              <p className="text-xs text-slate-400">No active in-progress studies.</p>
            ) : (() => {
              const maxLoad = Math.max(...m.techLoad.map(([, n]) => n), 1)
              return (
                <div className="space-y-2">
                  {m.techLoad.map(([name, n]) => (
                    <div key={name}>
                      <p className="text-xs text-slate-600 flex items-center justify-between"><span>{name}</span><b>{n}</b></p>
                      <div className="h-1.5 mt-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[rgba(14,116,144,0.07)]0" style={{ width: `${(n / maxLoad) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          <div className="rounded-xl border border-[rgba(14,116,144,0.20)] p-4" style={{ background: "linear-gradient(135deg,rgba(14,116,144,0.25),rgba(14,159,110,0.04))" }}>
            <h2 className="text-sm font-bold flex items-center gap-2 mb-2 text-[#0B5A6E]"><Sparkles className="h-4 w-4 text-[#0E7490]" />AI exception triage</h2>
            {m.overOverdue.length === 0 ? (
              <p className="text-xs text-slate-500">No exceptions. Pipeline is healthy.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {m.overOverdue.map(s => (
                  <p key={s.id} className="text-[#0E7490]">
                    <Clock className="h-3 w-3 inline -mt-0.5 mr-1" />
                    <b>{s.patientName}</b> · {s.name} · <b>{minsElapsed(s.orderedAt)}m</b> elapsed (TAT {s.expectedTATmin}m) — likely stuck
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-500" />Verification queue: <Link href="/radiology/verification" className="font-bold text-[#0E7490] hover:underline">open</Link></p>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1"><FileText className="h-3 w-3 text-[#0E7490]" />Templates: <Link href="/radiology/templates" className="font-bold text-[#0E7490] hover:underline">open</Link></p>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1"><ScanLine className="h-3 w-3 text-[#0E7490]" />DICOM viewer: <Link href="/radiology/viewer" className="font-bold text-[#0E7490] hover:underline">open</Link></p>
          </div>
        </div>
      </div>
    </div>
  )
}
