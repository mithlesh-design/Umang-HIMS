"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useInpatientStore, latestVitalsRecord } from "@/store/useInpatientStore"
import { useNursingStore } from "@/store/useNursingStore"
import { news2FromRecord } from "@/lib/vitals"
import { buildMar, slotStatus, type MarStatus } from "@/lib/mar"
import { fluidBalance, ivStatus } from "@/lib/fluids"
import { newsTrendVitals, trendArrow } from "@/lib/escalation"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Pill, Droplets, FileText, ClipboardList, HeartPulse } from "lucide-react"

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
const newsChip = (b?: string) => b === "high" ? "bg-red-100 text-red-700" : b === "medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
const statusChip: Record<MarStatus, string> = {
  given: "text-green-600", held: "text-orange-600", missed: "text-red-600", due: "text-amber-600",
  scheduled: "text-slate-400", running: "text-[#0E7490]", prn: "text-[#0E7490]",
}

export default function NursePatientDetail() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const inpatients = useInpatientStore(s => s.inpatients)
  const tasks = useNursingStore(s => s.tasks)
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => { const d = new Date(); setNow(d.getHours() * 60 + d.getMinutes()) }, [])
  const nowMin = now ?? -1

  const ip = inpatients.find(i => i.patientId === id)
  if (!ip) {
    return (
      <div className="space-y-4">
        <Link href="/nurse/patients" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> All patients</Link>
        <div className="py-16 text-center text-slate-400">Patient not found.</div>
      </div>
    )
  }

  const rec = latestVitalsRecord(ip)
  const news = rec ? news2FromRecord(rec) : undefined
  const trend = newsTrendVitals(ip)
  const vitalsDesc = (ip.vitals ?? []).slice().sort((a, b) => b.at.localeCompare(a.at))
  const mar = buildMar([ip])
  const bal = fluidBalance(ip.io)
  const patientTasks = tasks.filter(t => t.patientId === ip.patientId)
  const notes = [...ip.events].reverse().filter(e => e.type === "note" || e.type === "condition_change" || e.type === "round").slice(0, 8)

  return (
    <div className="space-y-5">
      <Link href="/nurse/patients" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> All patients</Link>

      {/* Header */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">{ip.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{ip.patientId} · {ip.age}y · {ip.gender} · {ip.ward} bed {ip.bed}</p>
            <p className="text-sm text-slate-600 mt-1">{ip.diagnosis}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ip.condition === "Critical" ? "bg-red-100 text-red-700" : ip.condition === "Serious" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{ip.condition}</span>
            {news && <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${newsChip(news.band)}`}>NEWS {news.score} {trend.length > 1 ? trendArrow(trend) : ""}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3 text-xs">
          {(ip.allergies ?? []).map(a => <span key={a} className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 font-semibold">{a}</span>)}
          {(ip.comorbidities ?? []).map(c => <span key={c} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">{c}</span>)}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Vitals trend */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3"><HeartPulse className="h-4 w-4 text-green-600" /><h2 className="text-sm font-bold text-slate-900">Vitals trend</h2>
            {news && <span className="ml-auto text-[11px] font-semibold text-slate-500">NEWS {trend.map(t => t.score).join(" → ")}</span>}</div>
          <div className="space-y-2">
            {vitalsDesc.length === 0 && <p className="text-xs text-slate-400">No vitals recorded yet.</p>}
            {vitalsDesc.map(v => (
              <div key={v.id} className="flex items-center justify-between text-xs border-b border-slate-50 pb-1.5">
                <span className="text-slate-400">{fmt(v.at)}</span>
                <span className="font-semibold text-slate-700">HR {v.hr ?? "—"} · {v.systolicBP ?? "—"}/{v.diastolicBP ?? "—"} · RR {v.rr ?? "—"} · SpO₂ {v.spo2 ?? "—"}% · {v.temp ?? "—"}°F</span>
                <span className={`font-bold ${newsChip(news2FromRecord(v).band)} px-1.5 rounded`}>{news2FromRecord(v).score}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* MAR */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3"><Pill className="h-4 w-4 text-[#0E7490]" /><h2 className="text-sm font-bold text-slate-900">Medication (today)</h2></div>
          <div className="space-y-1.5">
            {mar.length === 0 && <p className="text-xs text-slate-400">No active medications.</p>}
            {mar.map(slot => {
              const st = slotStatus(slot, ip.mar, nowMin).status
              return (
                <div key={slot.key} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{slot.medName} {slot.dose} · {slot.slot}</span>
                  <span className={`font-bold ${statusChip[st]}`}>{st}</span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Intake / Output */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3"><Droplets className="h-4 w-4 text-[#0E7490]" /><h2 className="text-sm font-bold text-slate-900">Fluid balance</h2></div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="bg-slate-50 rounded-lg p-2 text-center"><p className="text-[10px] font-bold uppercase text-slate-400">Intake</p><p className="text-sm font-bold text-[#0E7490]">{bal.intake} mL</p></div>
            <div className="bg-slate-50 rounded-lg p-2 text-center"><p className="text-[10px] font-bold uppercase text-slate-400">Output</p><p className="text-sm font-bold text-amber-600">{bal.output} mL</p></div>
            <div className="bg-slate-50 rounded-lg p-2 text-center"><p className="text-[10px] font-bold uppercase text-slate-400">Net</p><p className={`text-sm font-bold ${bal.net < 0 ? "text-red-600" : "text-emerald-600"}`}>{bal.net > 0 ? "+" : ""}{bal.net} mL</p></div>
          </div>
          {(ip.ivLines ?? []).map(l => {
            const s = ivStatus(l)
            return <p key={l.id} className="text-xs text-slate-600">• {l.fluid} — {l.rate}{now != null && s.remaining != null && l.status === "Running" ? ` · ${s.remaining} mL left` : ` · ${l.status}`}</p>
          })}
        </Card>

        {/* Nursing tasks */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3"><ClipboardList className="h-4 w-4 text-amber-600" /><h2 className="text-sm font-bold text-slate-900">Tasks</h2></div>
          <div className="space-y-1.5">
            {patientTasks.length === 0 && <p className="text-xs text-slate-400">No tasks linked to this patient.</p>}
            {patientTasks.map(t => (
              <div key={t.id} className="flex items-center justify-between text-xs">
                <span className={t.done ? "text-slate-400 line-through" : "text-slate-700 font-medium"}>{t.title}</span>
                <span className={`font-bold ${t.priority === "High" ? "text-red-600" : t.priority === "Medium" ? "text-amber-600" : "text-slate-400"}`}>{t.priority}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Nursing notes / recent timeline */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3"><FileText className="h-4 w-4 text-slate-600" /><h2 className="text-sm font-bold text-slate-900">Recent notes & events</h2></div>
        <div className="space-y-2.5">
          {notes.map(e => (
            <div key={e.id} className="flex gap-3 text-xs">
              <span className="text-slate-400 w-28 flex-shrink-0">{fmt(e.at)}</span>
              <div><span className="font-bold text-slate-800">{e.title}</span>{e.detail ? <span className="text-slate-600"> — {e.detail}</span> : null}<span className="text-slate-400"> · {e.actor}</span></div>
            </div>
          ))}
          {notes.length === 0 && <p className="text-xs text-slate-400">No notes yet.</p>}
        </div>
      </Card>
    </div>
  )
}
