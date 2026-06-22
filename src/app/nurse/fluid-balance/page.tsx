"use client"

import { Select } from "@/components/ui/Select"
import { useEffect, useState } from "react"
import { useInpatientStore, type Inpatient, type IoKind } from "@/store/useInpatientStore"
import { useShiftStore, ALL_WARDS } from "@/store/useShiftStore"
import { WardSwitcher } from "@/components/nurse/ShiftBanner"
import { fluidBalance, ivStatus, fluidAlerts } from "@/lib/fluids"
import { Card } from "@/components/ui/card"
import { Droplets, Plus, AlertTriangle, Sparkles, Pause, CheckCircle2, Play } from "lucide-react"
import { toast } from "sonner"

const INTAKE_TYPES = ["IV fluids", "Oral", "NG feed", "Blood product"]
const OUTPUT_TYPES = ["Urine", "Drain", "Vomitus", "Stool", "NG aspirate"]

function IoCard({ ip, mounted }: { ip: Inpatient; mounted: boolean }) {
  const addIo = useInpatientStore(s => s.addIo)
  const setIvStatus = useInpatientStore(s => s.setIvStatus)
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<IoKind>("intake")
  const [type, setType] = useState(INTAKE_TYPES[0])
  const [vol, setVol] = useState("")

  const bal = fluidBalance(ip.io)
  const alerts = mounted ? fluidAlerts(ip) : []
  const ivs = ip.ivLines ?? []

  const submit = () => {
    const v = parseInt(vol)
    if (isNaN(v) || v <= 0) { toast("Enter a volume in mL"); return }
    addIo(ip.patientId, { kind, type, volume: v, by: "Anjali Desai" })
    toast.success(`${kind === "intake" ? "Intake" : "Output"} ${v} mL recorded — ${ip.name}`)
    setVol(""); setOpen(false)
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-[#0F172A]">{ip.name}</h3>
          <p className="text-xs text-slate-500">{ip.ward} · {ip.bed}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Net balance · {bal.windowHrs}h</p>
          <p className={`text-lg font-bold ${bal.net < 0 ? "text-red-600" : bal.net >= 1500 ? "text-amber-600" : "text-emerald-600"}`}>
            {bal.net > 0 ? "+" : ""}{mounted ? bal.net : 0} mL
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 mb-3">
        {[
          { label: "Intake", value: `${bal.intake} mL`, cls: "text-[#0E7490]" },
          { label: "Output", value: `${bal.output} mL`, cls: "text-amber-600" },
          { label: "Net", value: `${bal.net > 0 ? "+" : ""}${bal.net} mL`, cls: bal.net < 0 ? "text-red-600" : "text-emerald-600" },
        ].map(s => (
          <div key={s.label} className="bg-slate-50 rounded-xl p-2.5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
            <p className={`text-sm font-bold mt-0.5 ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* IV / infusions */}
      {ivs.length > 0 && (
        <div className="space-y-2 mb-3">
          {ivs.map(l => {
            const s = ivStatus(l)
            return (
              <div key={l.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-2.5">
                <Droplets className={`h-4 w-4 flex-shrink-0 ${l.status === "Running" ? "text-[#0E7490]" : "text-slate-300"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{l.fluid}</p>
                  <p className="text-[11px] text-slate-500">
                    {l.rate}{l.status !== "Running" ? ` · ${l.status}` : mounted && s.remaining != null ? ` · ${s.remaining} mL left (~${s.minutesLeft} min)` : ""}
                  </p>
                </div>
                {mounted && s.endingSoon && l.status === "Running" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">Ending soon</span>
                )}
                {mounted && s.resiteDue && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0">Resite due</span>
                )}
                {l.status === "Running" ? (
                  <button onClick={() => setIvStatus(ip.patientId, l.id, "Paused")} aria-label="Pause infusion" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"><Pause className="h-3.5 w-3.5" /></button>
                ) : (
                  <button onClick={() => setIvStatus(ip.patientId, l.id, "Running")} aria-label="Resume infusion" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"><Play className="h-3.5 w-3.5" /></button>
                )}
                <button onClick={() => setIvStatus(ip.patientId, l.id, "Completed")} aria-label="Complete infusion" className="p-1.5 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 cursor-pointer"><CheckCircle2 className="h-3.5 w-3.5" /></button>
              </div>
            )
          })}
        </div>
      )}

      {/* AI alerts */}
      {alerts.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 text-xs font-semibold ${a.severity === "critical" ? "text-red-600" : "text-amber-600"}`}>
              <Sparkles className="h-3.5 w-3.5 flex-shrink-0" /> {a.text}
            </div>
          ))}
        </div>
      )}

      {/* Quick add I/O */}
      {open ? (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            {(["intake", "output"] as IoKind[]).map(k => (
              <button key={k} onClick={() => { setKind(k); setType(k === "intake" ? INTAKE_TYPES[0] : OUTPUT_TYPES[0]) }}
                className={`px-3 py-1.5 text-xs font-bold cursor-pointer ${kind === k ? (k === "intake" ? "bg-[#0E7490] text-white" : "bg-amber-500 text-white") : "bg-white text-slate-500"}`}>
                {k === "intake" ? "Intake" : "Output"}
              </button>
            ))}
          </div>
          <Select value={type} onChange={e => setType(e.target.value)} className="h-9 px-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50">
            {(kind === "intake" ? INTAKE_TYPES : OUTPUT_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <input value={vol} onChange={e => setVol(e.target.value)} type="number" placeholder="mL" className="h-9 w-20 px-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-900 bg-slate-50" />
          <button onClick={submit} className="h-9 px-3 rounded-lg bg-green-600 text-white text-xs font-bold cursor-pointer hover:bg-green-700">Add</button>
          <button onClick={() => setOpen(false)} className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm font-bold text-green-700 hover:text-green-800 cursor-pointer pt-1">
          <Plus className="h-4 w-4" /> Record intake / output
        </button>
      )}
    </Card>
  )
}

export default function FluidBalancePage() {
  const inpatients = useInpatientStore(s => s.inpatients)
  const activeWard = useShiftStore(s => s.activeWard)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const active = inpatients.filter(i => i.stage !== "discharged" && (activeWard === ALL_WARDS || i.ward === activeWard))
  const totalAlerts = mounted ? active.reduce((n, ip) => n + fluidAlerts(ip).length, 0) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Fluid Balance & IV</h1>
          <p className="text-sm text-[#64748B] mt-1">{activeWard} · intake / output charting and infusion management</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <WardSwitcher />
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0E7490] bg-[rgba(14,116,144,0.07)] border border-[rgba(14,116,144,0.15)] rounded-full px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5" /> AI fluid monitoring{totalAlerts > 0 ? ` · ${totalAlerts} alert${totalAlerts > 1 ? "s" : ""}` : ""}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {active.map(ip => <IoCard key={ip.patientId} ip={ip} mounted={mounted} />)}
      </div>
    </div>
  )
}
