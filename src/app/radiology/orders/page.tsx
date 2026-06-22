"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ClipboardCheck, Sparkles, CheckCircle2, AlertTriangle, Copy, FlaskConical, ArrowRight, Plus,
} from "lucide-react"
import { useRadiologyStudiesStore, type RadSource, type PaymentMode } from "@/store/useRadiologyStudiesStore"
import { RADIOLOGY_CATALOG, RADIOLOGY_CODES, PRIORITY_META, PRIORITIES, type Priority } from "@/lib/radiologyCatalog"
import { checkAppropriateness, detectDuplicate, recommendProtocol, classifyPriority } from "@/lib/radiologyAI"
import { AiDisclaimer } from "@/components/ui/AiDisclaimer"
import { StatCard } from "@/components/ui/stat-card"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const SOURCES: RadSource[] = ["OPD", "IPD", "ICU", "OT", "ER"]
const PAYMENTS: PaymentMode[] = ["Cash", "UPI", "Card", "Insurance", "Credit"]
const VERDICT_STYLE = {
  appropriate: { chip: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2, label: "Appropriate" },
  review: { chip: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle, label: "Review" },
  "consider-alternative": { chip: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle, label: "Consider alternative" },
} as const

export default function OrderDesk() {
  const studies = useRadiologyStudiesStore(s => s.studies)
  const addOrder = useRadiologyStudiesStore(s => s.addOrder)

  const [form, setForm] = useState({
    patientId: "", patientName: "", source: "OPD" as RadSource, doctorName: "",
    paymentMode: "Cash" as PaymentMode, code: "CT_ABDOMEN", clinicalQuestion: "", priority: "Routine" as Priority,
  })
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))
  const cat = RADIOLOGY_CATALOG[form.code]

  const appropriateness = useMemo(() => checkAppropriateness(form.code, form.clinicalQuestion, form.priority), [form.code, form.clinicalQuestion, form.priority])
  const protocol = useMemo(() => recommendProtocol(form.code, form.clinicalQuestion), [form.code, form.clinicalQuestion])
  const suggestedPriority = useMemo(() => classifyPriority(form.clinicalQuestion, cat?.defaultPriority ?? "Routine"), [form.clinicalQuestion, cat])
  const duplicate = useMemo(() => {
    if (!form.patientId || !cat) return null
    const probe = { id: "__new__", patientId: form.patientId, bodyPart: cat.bodyPart, modality: cat.modality } as Parameters<typeof detectDuplicate>[0]
    return detectDuplicate(probe, studies).data
  }, [form.patientId, form.code, studies, cat])

  const ordered = useMemo(() => studies.filter(s => s.status === "ordered").sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime()), [studies])

  const submit = () => {
    if (!form.patientName.trim() || !form.patientId.trim()) { toast.error("Patient name and ID required"); return }
    const id = addOrder({
      patientId: form.patientId.trim(), patientName: form.patientName.trim(), source: form.source,
      doctorName: form.doctorName.trim() || "Dr. (referrer)", paymentMode: form.paymentMode,
      code: form.code, clinicalQuestion: form.clinicalQuestion.trim() || undefined, priority: form.priority,
    })
    if (id) { toast.success(`Order created · ${cat?.name}`); setForm(f => ({ ...f, patientId: "", patientName: "", clinicalQuestion: "" })) }
  }

  const V = VERDICT_STYLE[appropriateness.data.verdict]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="h-9 w-9 rounded-xl flex items-center justify-center bg-[#0B5A6E]/[0.08] text-[#0B5A6E]"><ClipboardCheck className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#101828]">Order Desk</h1>
          <p className="text-sm text-[#667085]">AI appropriateness · duplicate detection · protocol recommendation · priority classification</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Awaiting workup" value={ordered.length} sub="newly ordered" icon={ClipboardCheck} color="blue" />
        <StatCard label="STAT+" value={ordered.filter(s => PRIORITY_META[s.priority].rank >= 2).length} sub="urgent orders" icon={AlertTriangle} color="red" />
        <StatCard label="Today's orders" value={studies.length} sub="all studies" icon={Plus} color="green" />
        <StatCard label="Catalog" value={RADIOLOGY_CODES.length} sub="orderable exams" icon={FlaskConical} color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* New order form */}
        <div className="rounded-2xl border border-[#EAECF2] bg-white shadow-[var(--shadow-card)] p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-3">New radiology order</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Patient name"><input value={form.patientName} onChange={e => set("patientName", e.target.value)} className={inputCls} placeholder="Full name" /></Field>
            <Field label="Patient ID"><input value={form.patientId} onChange={e => set("patientId", e.target.value)} className={inputCls} placeholder="PT-xxxxx" /></Field>
            <Field label="Source"><Select value={form.source} onChange={e => set("source", e.target.value)} className={inputCls}>{SOURCES.map(s => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Referring doctor"><input value={form.doctorName} onChange={e => set("doctorName", e.target.value)} className={inputCls} placeholder="Dr. …" /></Field>
            <Field label="Exam">
              <Select value={form.code} onChange={e => set("code", e.target.value)} className={inputCls}>
                {RADIOLOGY_CODES.map(c => <option key={c} value={c}>{RADIOLOGY_CATALOG[c].name}</option>)}
              </Select>
            </Field>
            <Field label="Payment"><Select value={form.paymentMode} onChange={e => set("paymentMode", e.target.value)} className={inputCls}>{PAYMENTS.map(p => <option key={p}>{p}</option>)}</Select></Field>
            <div className="col-span-2"><Field label="Clinical indication"><textarea value={form.clinicalQuestion} onChange={e => set("clinicalQuestion", e.target.value)} rows={2} className={cn(inputCls, "resize-none")} placeholder="e.g. RUQ pain, R/O cholelithiasis" /></Field></div>
            <Field label="Priority">
              <div className="flex flex-wrap gap-1">
                {PRIORITIES.map(p => (
                  <button key={p} onClick={() => set("priority", p)}
                    className={cn("text-[10.5px] font-bold uppercase px-2 py-1 rounded border cursor-pointer", form.priority === p ? PRIORITY_META[p].badge : "bg-white text-slate-500 border-[#EAECF2]")}>{p}</button>
                ))}
              </div>
            </Field>
          </div>
          <button onClick={submit} className="mt-4 w-full h-10 rounded-xl bg-[#0B5A6E] text-white font-semibold text-sm hover:bg-[#172E6E] transition-colors cursor-pointer inline-flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" /> Create order
          </button>
        </div>

        {/* AI panel */}
        <div className="space-y-3">
          <AiDisclaimer />
          {/* Appropriateness */}
          <div className={cn("rounded-2xl border p-4", V.chip.replace("text-", "border-").split(" ").find(c => c.startsWith("border-")) ?? "border-[#EAECF2]", "bg-white")}>
            <div className="flex items-center gap-2 mb-1">
              <V.icon className="h-4 w-4 text-[#0B5A6E]" />
              <h4 className="text-[13px] font-bold text-slate-900">Appropriateness</h4>
              <span className={cn("ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", V.chip)}>{V.label}</span>
            </div>
            <p className="text-[12.5px] text-slate-600">{appropriateness.data.rationale}</p>
            {appropriateness.data.alternative && <p className="text-[11.5px] text-amber-700 mt-1">Alternative: {appropriateness.data.alternative}</p>}
            <p className="text-[10px] text-slate-400 mt-1">Confidence {Math.round(appropriateness.confidence * 100)}%</p>
          </div>

          {/* Duplicate */}
          {duplicate && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex items-center gap-2 mb-1"><Copy className="h-4 w-4 text-amber-600" /><h4 className="text-[13px] font-bold text-amber-900">Possible duplicate</h4></div>
              <p className="text-[12.5px] text-amber-800">{duplicate.note}</p>
            </div>
          )}

          {/* Protocol */}
          <div className="rounded-2xl border border-[#EAECF2] bg-white p-4">
            <div className="flex items-center gap-2 mb-1"><Sparkles className="h-4 w-4 text-[#0E9F6E]" /><h4 className="text-[13px] font-bold text-slate-900">Protocol recommendation</h4></div>
            <p className="text-[12.5px] text-slate-700 font-medium">{protocol.data.protocol}</p>
            <p className="text-[11.5px] text-slate-500 mt-0.5">{protocol.data.note}</p>
          </div>

          {/* Priority suggestion */}
          {suggestedPriority !== form.priority && (
            <div className="rounded-2xl border border-[#0E7490]/15 bg-[rgba(14,116,144,0.06)] p-4 flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-[#0B5A6E] flex-shrink-0" />
              <p className="text-[12.5px] text-slate-700 flex-1">AI suggests priority <b>{suggestedPriority}</b> from the indication.</p>
              <button onClick={() => set("priority", suggestedPriority)} className="text-[12px] font-semibold text-[#0B5A6E] hover:underline cursor-pointer flex-shrink-0">Apply</button>
            </div>
          )}
        </div>
      </div>

      {/* Newly ordered list */}
      <div className="rounded-2xl border border-[#EAECF2] bg-white shadow-[var(--shadow-card)]">
        <div className="px-5 py-4 border-b border-[#EAECF2] flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-[#0B5A6E]" />
          <h3 className="text-sm font-bold text-slate-900">Awaiting scheduling</h3>
          <Link href="/radiology/schedule" className="ml-auto text-[12px] font-semibold text-[#0E7490] hover:underline">Open scheduling →</Link>
        </div>
        {ordered.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">No orders awaiting workup.</div> : (
          <div className="divide-y divide-[#F2F4F8]">
            {ordered.map(s => (
              <Link key={s.id} href="/radiology/schedule" className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 group">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-bold text-slate-900 truncate">{s.patientName}</p>
                    <span className={cn("text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded border", PRIORITY_META[s.priority].badge)}>{s.priority}</span>
                  </div>
                  <p className="text-[11.5px] text-slate-500 truncate">{s.name} · {s.clinicalQuestion ?? "—"}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#0B5A6E] flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const inputCls = "w-full h-9 px-3 rounded-lg text-[13px] bg-[#F8FAFC] border border-[#EAECF2] focus:outline-none focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/15 transition-all"
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[11px] font-semibold text-slate-500 mb-1">{label}</span>{children}</label>
}
