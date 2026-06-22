"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  FlaskConical, Users, AlertTriangle, Phone, CheckCircle, Clock, Hourglass,
  ShieldX, Sparkles, ArrowRight, Microscope, Activity, PackageCheck,
  ClipboardList, Droplet, ShieldCheck, Send, ChevronRight,
} from "lucide-react"
import { useLabOrdersStore, type LabOrder, type TestRun, type TestStatus } from "@/store/useLabOrdersStore"
import { useLabQCStore, ANALYZERS } from "@/store/useLabQCStore"
import { useAuthStore } from "@/store/useAuthStore"
import { LAB_CATALOG, type Bench } from "@/lib/labCatalog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { notifyAndAudit, notifyAndAuditMany } from "@/lib/notifyAndAudit"

const BENCH_LABELS: Record<Bench, string> = {
  HEMA: "Hematology", BIOCHEM: "Biochemistry", IMMUNO: "Immunology",
  URINE: "Urinalysis", MICRO: "Microbiology", HISTO: "Histopathology",
}

const timeAgo = (iso?: string) => {
  if (!iso) return ""
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}
const minsElapsed = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60000)
const daysElapsed = (iso: string) => (Date.now() - new Date(iso).getTime()) / (24 * 3600_000)
// "Stuck" = elapsed > 2× expected TAT. Micro tests are day-based; everything
// else is minute-based.
function isStuck(t: TestRun): boolean {
  const cat = LAB_CATALOG[t.code]
  if (cat?.micro && cat.expectedDays) return daysElapsed(t.orderedAt) > 2 * cat.expectedDays
  return minsElapsed(t.orderedAt) > 2 * t.expectedTATmin
}
function isOverdue(t: TestRun): boolean {
  const cat = LAB_CATALOG[t.code]
  if (cat?.micro && cat.expectedDays) return daysElapsed(t.orderedAt) > cat.expectedDays
  return minsElapsed(t.orderedAt) > t.expectedTATmin
}

const ACTIVE_STATUSES: TestStatus[] = ["awaiting_collection", "collected", "on_bench", "in_progress", "entered", "verified"]
const PIPELINE_STATUSES: TestStatus[] = ["awaiting_collection", "on_bench", "in_progress", "entered", "verified"]
// Critical-pending callback is bounded to results released in the last 24h
// — older ones either got called or aren't actionable on today's SLA.
const CALLBACK_WINDOW_MS = 24 * 3600_000

export default function LabOverview() {
  const orders = useLabOrdersStore(s => s.orders)
  const logCallback = useLabOrdersStore(s => s.logCallback)
  const qcViolations = useLabQCStore(s => s.violations)
  const currentUser = useAuthStore(s => s.currentUser)
  const meName = currentUser?.name ?? "Lab"

  const [callbackId, setCallbackId] = useState<string | null>(null)
  const [callbackTo, setCallbackTo] = useState("")

  const m = useMemo(() => {
    const tests: { order: LabOrder; test: TestRun }[] = []
    for (const o of orders) for (const t of o.tests) tests.push({ order: o, test: t })

    const awaiting = tests.filter(x => x.test.status === "awaiting_collection")
    const onBench = tests.filter(x => x.test.status === "on_bench" || x.test.status === "collected")
    const inProgress = tests.filter(x => x.test.status === "in_progress")
    const entered = tests.filter(x => x.test.status === "entered")
    const released = tests.filter(x => x.test.status === "released")
    const releasedToday = released.filter(x => x.test.releasedAt && new Date(x.test.releasedAt).toDateString() === new Date().toDateString())
    const callbackCutoff = Date.now() - CALLBACK_WINDOW_MS
    const criticalPendingCallback = released.filter(x =>
      !x.test.callback &&
      x.test.analytes.some(a => a.flag === "CH" || a.flag === "CL") &&
      x.test.releasedAt !== undefined &&
      new Date(x.test.releasedAt).getTime() >= callbackCutoff
    )
    const tatBreaches = tests.filter(x =>
      x.test.status !== "released" && isOverdue(x.test)
    )

    const pipeline: Record<Bench, Record<TestStatus, number>> = {} as Record<Bench, Record<TestStatus, number>>
    for (const b of Object.keys(BENCH_LABELS) as Bench[]) {
      pipeline[b] = { awaiting_collection: 0, collected: 0, on_bench: 0, in_progress: 0, entered: 0, verified: 0, released: 0, rejected: 0, recollect_requested: 0 }
    }
    for (const { test } of tests) {
      if (ACTIVE_STATUSES.includes(test.status)) pipeline[test.bench][test.status]++
    }

    const techLoadMap: Record<string, number> = {}
    for (const x of inProgress) {
      const name = x.test.assignedTo?.name ?? "Unclaimed"
      techLoadMap[name] = (techLoadMap[name] ?? 0) + 1
    }
    const techLoad = Object.entries(techLoadMap).sort((a, b) => b[1] - a[1])

    const overOverdue = tests.filter(x => x.test.status !== "released" && isStuck(x.test))
    const criticalCounts: Record<string, number> = {}
    for (const x of releasedToday) {
      if (x.test.analytes.some(a => a.flag === "CH" || a.flag === "CL")) {
        criticalCounts[x.order.patientName] = (criticalCounts[x.order.patientName] ?? 0) + 1
      }
    }
    const repeatCriticals = Object.entries(criticalCounts).filter(([, n]) => n >= 2)

    return {
      kpis: {
        awaiting: awaiting.length,
        onBench: onBench.length + inProgress.length,
        pendingVerify: entered.length,
        critPending: criticalPendingCallback.length,
        releasedToday: releasedToday.length,
        tatBreaches: tatBreaches.length,
      },
      pipeline, criticalPendingCallback, entered, techLoad, overOverdue, repeatCriticals,
    }
  }, [orders])

  const activeQCViolations = ANALYZERS.flatMap(a => (qcViolations[a] ?? []).map(v => ({ analyzer: a, ...v })))

  const onLogCallback = (testId: string, patient: string) => {
    const recipient = callbackTo.trim() || "ordering doctor"
    logCallback(testId, meName, recipient)
    setCallbackId(null); setCallbackTo("")
    notifyAndAudit({
      to: 'doctor', type: 'critical_value', priority: 'critical',
      title: `Critical value callback · ${patient}`,
      body: `Lab notified ${recipient} of critical result for ${patient}. Read-receipt at bedside.`,
      patientName: patient,
      audit: { action: 'lab_critical_callback', resource: 'lab_test', resourceId: testId, detail: `Callback to ${recipient}`, userName: meName },
    })
    toast.success(`Callback logged for ${patient} to ${recipient} · SLA closed`)
  }

  // M9-D — TAT escalation: when TAT breach count > 0, fire a single
  // high-priority notification to the doctor + admin + lab supervisor so
  // someone owns the cleanup.
  function escalateTatBreaches() {
    const overdue = m.kpis.tatBreaches ?? 0
    if (overdue === 0) { toast(`No TAT breaches right now`); return }
    notifyAndAuditMany(['doctor', 'admin'], {
      type: 'system', priority: 'high',
      title: `${overdue} lab TAT breach${overdue === 1 ? '' : 'es'}`,
      body: `Lab has ${overdue} test${overdue === 1 ? '' : 's'} past TAT. Pulling on-call lab tech to clear.`,
      audit: { action: 'lab_critical_callback', resource: 'lab_tat', detail: `${overdue} TAT breaches escalated`, userName: meName },
    })
    toast.success(`Escalated ${overdue} TAT breach${overdue === 1 ? '' : 'es'} · admin + doctor notified`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Lab Overview</h1>
          <p className="text-sm text-[#64748B] mt-1">Incharge command center · pipeline by bench · critical-value SLA · AI exception triage</p>
        </div>
        <div className="flex gap-2">
          <Link href="/lab/inbox" className="flex items-center gap-1.5 text-xs font-bold text-[#0E7490] bg-[rgba(14,116,144,0.07)] hover:bg-[rgba(14,116,144,0.14)] px-3 py-2 rounded-xl"><ClipboardList className="h-3.5 w-3.5" />Open Inbox</Link>
          <Link href="/lab/benches" className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl"
            style={{ background: "linear-gradient(135deg,#0B5A6E,#0E7490)", boxShadow: "0 2px 8px rgba(14,116,144,0.25)" }}>
            <Microscope className="h-3.5 w-3.5" />Open Benches</Link>
        </div>
      </div>

      {/* M13.1 — Sample-to-release pipeline.
          Five chevron-linked stages mirror the actual lab journey: each stage
          shows live counts + a direct nav button so any tech can jump straight
          into their next action. Replaces the cognitive overhead of figuring
          out "where's my work" from the per-bench grid below. */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#0E7490]" />Sample-to-release journey
          </h2>
          <p className="text-[11px] text-slate-500">Order → collect → bench → enter → verify → release</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-stretch">
          {[
            { key: 'phleb', label: 'Phlebotomy', sub: 'Awaiting collection', count: m.kpis.awaiting, color: 'border-amber-200 bg-amber-50', icon: Droplet, fg: 'text-amber-700', href: '/lab/phlebotomy', cta: 'Call patient' },
            { key: 'analyzer', label: 'Analyzer feed', sub: 'On bench → auto-run', count: m.kpis.onBench, color: 'border-[rgba(14,116,144,0.20)] bg-[rgba(14,116,144,0.07)]', icon: Microscope, fg: 'text-[#0E7490]', href: '/lab/analyzer-feed', cta: 'Push results' },
            { key: 'verify', label: 'Pathologist', sub: 'Pending verification', count: m.kpis.pendingVerify, color: 'border-[rgba(14,116,144,0.20)] bg-[rgba(14,116,144,0.07)]', icon: ShieldCheck, fg: 'text-[#0E7490]', href: '/lab/verify', cta: 'Sign off' },
            { key: 'released', label: 'Released', sub: 'Released today', count: m.kpis.releasedToday, color: 'border-emerald-200 bg-emerald-50', icon: Send, fg: 'text-emerald-700', href: '/lab/inbox', cta: 'View inbox' },
            { key: 'critical', label: 'Critical callback', sub: 'Awaiting callback', count: m.kpis.critPending, color: m.kpis.critPending > 0 ? 'border-red-300 bg-red-50 ring-2 ring-red-100' : 'border-slate-200 bg-white', icon: Phone, fg: m.kpis.critPending > 0 ? 'text-red-700' : 'text-slate-400', href: '/lab/dashboard#callback', cta: 'Log callback' },
          ].map((s, i, arr) => (
            <Link key={s.key} href={s.href}
              className={cn("relative rounded-xl border p-3 hover:shadow-md transition flex flex-col gap-1 cursor-pointer group", s.color)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <s.icon className={cn("h-4 w-4", s.fg)} />
                  <p className={cn("text-xs font-bold", s.fg)}>{s.label}</p>
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
          { label: "Awaiting collection", value: m.kpis.awaiting, icon: ClipboardList, fg: "text-amber-600", bg: "bg-amber-50" },
          { label: "On bench / in progress", value: m.kpis.onBench, icon: Microscope, fg: "text-[#0E7490]", bg: "bg-[rgba(14,116,144,0.07)]" },
          { label: "Pending verification", value: m.kpis.pendingVerify, icon: Hourglass, fg: "text-[#0E7490]", bg: "bg-[rgba(14,116,144,0.07)]" },
          { label: "Critical pending callback", value: m.kpis.critPending, icon: Phone, fg: "text-red-600", bg: "bg-red-50" },
          { label: "Released today", value: m.kpis.releasedToday, icon: PackageCheck, fg: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "TAT breaches", value: m.kpis.tatBreaches, icon: AlertTriangle, fg: "text-orange-600", bg: "bg-orange-50", action: escalateTatBreaches, actionLabel: "Escalate" },
        ].map(s => (
          <div key={s.label} className={cn("rounded-xl p-3 flex items-center gap-3", s.bg)}>
            <div className="p-2 rounded-lg bg-white shadow-sm"><s.icon className={cn("h-4 w-4", s.fg)} /></div>
            <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 truncate">{s.label}</p><h3 className="text-xl font-bold text-slate-900">{s.value}</h3></div>
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
              <h2 className="text-sm font-bold text-slate-800">Pipeline by bench</h2>
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {(Object.keys(BENCH_LABELS) as Bench[]).filter(b => b !== "HISTO").map(b => {
                const counts = m.pipeline[b]
                const total = PIPELINE_STATUSES.reduce((s, st) => s + counts[st], 0)
                return (
                  <div key={b} className="rounded-lg ring-1 ring-slate-200/70 p-2.5">
                    <p className="text-[11px] font-bold text-slate-700">{BENCH_LABELS[b]}</p>
                    <p className="text-lg font-bold text-slate-900 leading-none mt-0.5">{total}</p>
                    <div className="mt-2 space-y-0.5">
                      {counts.awaiting_collection > 0 && <p className="text-[10px] text-slate-500"><b>{counts.awaiting_collection}</b> awaiting</p>}
                      {(counts.on_bench + counts.collected) > 0 && <p className="text-[10px] text-amber-600"><b>{counts.on_bench + counts.collected}</b> on bench</p>}
                      {counts.in_progress > 0 && <p className="text-[10px] text-[#0E7490]"><b>{counts.in_progress}</b> in progress</p>}
                      {counts.entered > 0 && <p className="text-[10px] text-[#0E7490]"><b>{counts.entered}</b> pending verify</p>}
                      {counts.verified > 0 && <p className="text-[10px] text-emerald-600"><b>{counts.verified}</b> pending release</p>}
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
              <p className="px-4 py-6 text-sm text-slate-400 text-center">No critical results awaiting callback. ✓</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {m.criticalPendingCallback.map(({ order, test }) => {
                  const crit = test.analytes.find(a => a.flag === "CH" || a.flag === "CL")
                  return (
                    <div key={test.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 flex items-center gap-2 flex-wrap">
                          <span className="font-bold">{order.patientName}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">{test.name}</span>
                          {crit && <span className="text-[11px] text-red-700"><b>{crit.analyte} {crit.value} {crit.unit}</b> {crit.flag}</span>}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">ordering: {order.doctorName} · released {timeAgo(test.releasedAt)}</p>
                      </div>
                      {callbackId === test.id ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <input value={callbackTo} onChange={e => setCallbackTo(e.target.value)} placeholder={`Call ${order.doctorName}…`}
                            className="w-40 h-7 px-2 text-[11px] rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                          <button onClick={() => onLogCallback(test.id, order.patientName)}
                            className="text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded-lg cursor-pointer">Confirm log</button>
                          <button onClick={() => { setCallbackId(null); setCallbackTo("") }}
                            className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => { setCallbackId(test.id); setCallbackTo(order.doctorName) }}
                          className="flex items-center gap-1 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded-lg cursor-pointer"><Phone className="h-3 w-3" />Log callback</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {m.entered.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hourglass className="h-4 w-4 text-[#0E7490]" />
                  <h2 className="text-sm font-bold text-slate-800">Pending verification</h2>
                  <span className="text-xs text-slate-400">{m.entered.length}</span>
                </div>
                <Link href="/lab/benches" className="text-xs font-bold text-[#0E7490] hover:underline flex items-center gap-1">Open Benches <ArrowRight className="h-3 w-3" /></Link>
              </div>
              <div className="divide-y divide-slate-100">
                {m.entered.slice(0, 5).map(({ order, test }) => (
                  <div key={test.id} className="px-4 py-2.5 text-sm">
                    <span className="font-bold text-slate-800">{order.patientName}</span>
                    <span className="text-slate-400 mx-2">·</span>
                    <span className="text-[#0E7490]">{test.name}</span>
                    <span className="text-slate-400 mx-2">·</span>
                    <span className="text-[11px] text-slate-500">entered by {test.enteredBy?.name ?? "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-[#0E7490]" />Technician workload</h2>
            {m.techLoad.length === 0 ? (
              <p className="text-xs text-slate-400">No active in-progress tests.</p>
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

          <div className={cn("rounded-xl border p-4", activeQCViolations.length > 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-white")}>
            <h2 className="text-sm font-bold flex items-center gap-2 mb-2">
              <ShieldX className={cn("h-4 w-4", activeQCViolations.length > 0 ? "text-red-600" : "text-slate-400")} />
              <span className={activeQCViolations.length > 0 ? "text-red-800" : "text-slate-800"}>QC alerts</span>
              <span className="text-xs text-slate-400">{activeQCViolations.length}</span>
            </h2>
            {activeQCViolations.length === 0 ? (
              <p className="text-xs text-slate-500">All analyzers passing.</p>
            ) : (
              <div className="space-y-1.5">
                {activeQCViolations.map((v, i) => (
                  <p key={i} className="text-[11px] text-red-700">
                    <b>{v.analyzer}</b> · {v.rule.toUpperCase()} · {v.note}
                  </p>
                ))}
                <Link href="/lab/qc" className="text-[11px] font-bold text-red-700 hover:underline flex items-center gap-1 mt-1">Open Quality Control <ArrowRight className="h-3 w-3" /></Link>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[rgba(14,116,144,0.20)] p-4" style={{ background: "linear-gradient(135deg,rgba(14,116,144,0.25),rgba(14,159,110,0.04))" }}>
            <h2 className="text-sm font-bold flex items-center gap-2 mb-2 text-[#0B5A6E]"><Sparkles className="h-4 w-4 text-[#0E7490]" />AI exception triage</h2>
            {m.overOverdue.length === 0 && m.repeatCriticals.length === 0 ? (
              <p className="text-xs text-slate-500">No exceptions. Pipeline is healthy.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {m.overOverdue.map(({ order, test }) => (
                  <p key={test.id} className="text-[#0E7490]">
                    <Clock className="h-3 w-3 inline -mt-0.5 mr-1" />
                    <b>{order.patientName}</b> · {test.name} · <b>{minsElapsed(test.orderedAt)}m</b> elapsed (TAT {test.expectedTATmin}m) — likely stuck
                  </p>
                ))}
                {m.repeatCriticals.map(([patient, n]) => (
                  <p key={patient} className="text-[#0E7490]">
                    <Activity className="h-3 w-3 inline -mt-0.5 mr-1" />
                    <b>{patient}</b> — {n} critical results today, repeat delta-check recommended
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-500" />Reflex queue: <Link href="/lab/reflex" className="font-bold text-[#0E7490] hover:underline">open</Link></p>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1"><FlaskConical className="h-3 w-3 text-[#0E7490]" />Microbiology: <Link href="/lab/microbiology" className="font-bold text-[#0E7490] hover:underline">open</Link></p>
          </div>
        </div>
      </div>
    </div>
  )
}
