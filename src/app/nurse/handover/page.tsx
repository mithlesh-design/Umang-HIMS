"use client"

import { useEffect, useMemo, useState } from "react"
import { useInpatientStore } from "@/store/useInpatientStore"
import { useShiftStore, SHIFT_WINDOWS, ALL_WARDS, type ShiftType } from "@/store/useShiftStore"
import { useAuditStore } from "@/store/useAuditStore"
import { WardSwitcher } from "@/components/nurse/ShiftBanner"
import { buildWardHandover, type WardHandover } from "@/lib/handover"
import { Sparkles, AlertTriangle, RefreshCw, CheckCircle2, ShieldCheck, Inbox, ArrowRightLeft, Clock } from "lucide-react"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"

const NEXT_SHIFT: Record<ShiftType, ShiftType> = { Morning: "Evening", Evening: "Night", Night: "Morning" }
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })

export default function NurseHandover() {
  const inpatients = useInpatientStore(s => s.inpatients)
  const activeWard = useShiftStore(s => s.activeWard)
  const assignments = useShiftStore(s => s.assignments)
  const currentNurseId = useShiftStore(s => s.currentNurseId)
  const nurseName = useShiftStore(s => s.currentNurseName)
  const handovers = useShiftStore(s => s.handovers)
  const signHandover = useShiftStore(s => s.signHandover)
  const receiveHandover = useShiftStore(s => s.receiveHandover)
  const log = useAuditStore(s => s.log)
  // Derive in-component (selectors must return cached snapshots — never call a
  // store method that builds a fresh array inside the selector).
  const myAssignment = useMemo(() => assignments.find(a => a.nurseId === currentNurseId), [assignments, currentNurseId])
  const pendingIncoming = useMemo(
    () => (myAssignment ? handovers.filter(h => h.status === "signed" && h.ward === myAssignment.ward && h.toShift === myAssignment.shift) : []),
    [handovers, myAssignment],
  )

  const shift = myAssignment?.shift ?? "Morning"
  const ward = activeWard === ALL_WARDS ? (myAssignment?.ward ?? "Cardiac Care") : activeWard
  const wardInpatients = inpatients.filter(i => i.stage !== "discharged" && i.ward === ward)

  const [ho, setHo] = useState<WardHandover | null>(null)
  const [addendum, setAddendum] = useState("")
  const build = () => { const d = new Date(); setHo(buildWardHandover(wardInpatients, d.getHours() * 60 + d.getMinutes())) }
  // Build client-side only (avoids SSR/client time mismatch). Rebuild on ward change.
  useEffect(() => { build() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeWard, inpatients])

  const wardLog = handovers.filter(h => h.ward === ward).sort((a, b) => b.signedAt.localeCompare(a.signedAt))

  const sign = () => {
    if (!ho) return
    const sbar = ho.patients.map(p => `${p.name} (${p.bed}) — S: ${p.situation} A: ${p.assessment} R: ${p.recommendation}`).join("\n") + (addendum.trim() ? `\nAddendum: ${addendum.trim()}` : "")
    signHandover({ ward, date: new Date().toISOString().slice(0, 10), fromShift: shift, toShift: NEXT_SHIFT[shift], fromNurse: nurseName, sbar, addendum: addendum.trim() || undefined, patientCount: ho.patients.length })
    log({ userId: "nurse_portal", userName: nurseName, action: "handover_signed", resource: "ward", resourceId: ward, detail: `${shift}→${NEXT_SHIFT[shift]} handover signed for ${ward} (${ho.patients.length} patients)` })
    toast.success(`Handover signed → ${NEXT_SHIFT[shift]} shift`)
    setAddendum("")
  }
  const receive = (id: string, from: string) => {
    receiveHandover(id, nurseName)
    log({ userId: "nurse_portal", userName: nurseName, action: "handover_received", resource: "ward", resourceId: ward, detail: `Received ${from}'s handover for ${ward}` })
    toast.success(`Handover received from ${from} — you have the ward`)
  }

  const urgentCount = ho?.patients.filter(p => p.urgent).length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Shift Handover</h1>
          <p className="text-sm text-[#64748B] mt-1">{ward} · {shift} shift ({SHIFT_WINDOWS[shift]}) · auditable transition record</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <WardSwitcher />
          <button onClick={build} className="flex items-center gap-1.5 text-sm font-bold text-[#0E7490] bg-[rgba(14,116,144,0.07)] border border-[rgba(14,116,144,0.15)] hover:bg-[rgba(14,116,144,0.14)] px-3 py-2 rounded-xl cursor-pointer transition-colors">
            <RefreshCw className="h-4 w-4" /> Regenerate
          </button>
        </div>
      </div>

      {/* Incoming — receive handover */}
      {pendingIncoming.length > 0 && (
        <Card className="p-5 border border-[rgba(14,116,144,0.20)] bg-[rgba(14,116,144,0.07)]/60">
          <div className="flex items-center gap-2 mb-3"><Inbox className="h-4 w-4 text-[#0E7490]" /><h2 className="text-sm font-bold text-[#0B5A6E]">Incoming handover — start of shift</h2></div>
          {pendingIncoming.map(h => (
            <div key={h.id} className="rounded-xl bg-white border border-[rgba(14,116,144,0.15)] p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                <p className="text-sm font-bold text-slate-800 flex items-center gap-2"><ArrowRightLeft className="h-3.5 w-3.5 text-[#0E7490]" /> {h.fromNurse} ({h.fromShift}) → you ({h.toShift})</p>
                <span className="text-[11px] text-slate-400 flex items-center gap-1"><Clock className="h-3 w-3" /> signed {fmtTime(h.signedAt)}</span>
              </div>
              <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans mb-3">{h.sbar}</pre>
              <button onClick={() => receive(h.id, h.fromNurse)} className="flex items-center gap-1.5 text-sm font-bold text-white px-4 py-2 rounded-xl cursor-pointer"
                style={{ background: "linear-gradient(135deg,#0E7490,#0E7490)" }}>
                <CheckCircle2 className="h-4 w-4" /> Receive &amp; acknowledge
              </button>
            </div>
          ))}
        </Card>
      )}

      {/* Outgoing — AI-compiled SBAR + sign */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-[#0E7490]" />
          <h2 className="text-sm font-bold text-slate-900">End-of-shift handover</h2>
          <span className="ml-auto text-[11px] text-slate-500">{ho?.patients.length ?? 0} patients{urgentCount > 0 ? ` · ${urgentCount} urgent` : ""} · → {NEXT_SHIFT[shift]} shift</span>
        </div>
        <div className="space-y-2.5 mb-4">
          {(ho?.patients ?? []).map(p => (
            <div key={p.patientId} className={`p-3 rounded-xl border ${p.urgent ? "border-red-200 bg-red-50/70" : "border-slate-200 bg-white"}`}>
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                <p className="font-bold text-slate-900 text-sm">{p.name} — {p.bed}</p>
                {p.urgent
                  ? <span className="text-[10px] font-black px-2 py-0.5 bg-red-600 text-white rounded-full flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {p.condition.toUpperCase()}</span>
                  : <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{p.condition}</span>}
              </div>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-700">
                <div><span className="font-bold text-slate-500">S:</span> {p.situation}</div>
                <div><span className="font-bold text-slate-500">A:</span> {p.assessment}</div>
                <div className="sm:col-span-2"><span className="font-bold text-emerald-600">R:</span> {p.recommendation}</div>
              </div>
            </div>
          ))}
          {(ho?.patients.length ?? 0) === 0 && <p className="text-xs text-slate-400">No active patients in {ward}.</p>}
        </div>
        <textarea rows={2} value={addendum} onChange={e => setAddendum(e.target.value)} placeholder="Shift addendum — anything not captured above…"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500 bg-slate-50 mb-3" />
        <button onClick={sign} className="flex items-center gap-1.5 text-sm font-bold text-white px-4 py-2 rounded-xl cursor-pointer"
          style={{ background: "linear-gradient(135deg,#16A34A,#0B5A6E)", boxShadow: "0 2px 8px rgba(22,163,74,0.25)" }}>
          <ShieldCheck className="h-4 w-4" /> Sign &amp; hand over to {NEXT_SHIFT[shift]} shift
        </button>
      </Card>

      {/* Handover log — audit trail */}
      <Card className="p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Handover log · {ward}</h2>
        {wardLog.length === 0 ? <p className="text-xs text-slate-400">No handovers recorded yet for this ward.</p> : (
          <div className="space-y-2">
            {wardLog.map(h => (
              <div key={h.id} className="flex items-center justify-between gap-3 text-xs border-b border-slate-50 pb-2 flex-wrap">
                <span className="font-semibold text-slate-700">{h.fromNurse} ({h.fromShift}) → {h.toNurse ?? `${h.toShift} shift`}</span>
                <span className="text-slate-400">{h.patientCount} pts · signed {fmtTime(h.signedAt)}{h.receivedAt ? ` · received ${fmtTime(h.receivedAt)} by ${h.receivedBy}` : ""}</span>
                <span className={`font-bold px-2 py-0.5 rounded-full ${h.status === "received" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{h.status}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
