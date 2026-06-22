"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import {
  ClipboardList, Bed, Stethoscope, IndianRupee, ScanLine, AlertTriangle, ChevronDown, ChevronRight,
  Send, Clock, ShieldCheck, Calendar,
} from "lucide-react"
import {
  useRadiologyStudiesStore,
  type RadiologyStudy, type RadSource,
} from "@/store/useRadiologyStudiesStore"
import { RADIOLOGY_CATALOG, type Priority } from "@/lib/radiologyCatalog"
import { useAuthStore } from "@/store/useAuthStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const SOURCE_STYLE: Record<RadSource, string> = {
  OPD: "bg-[rgba(14,116,144,0.07)] text-[#0E7490] ring-blue-200",
  IPD: "bg-[rgba(14,116,144,0.07)] text-[#0E7490] ring-indigo-200",
  ICU: "bg-red-50 text-red-700 ring-red-200",
  OT:  "bg-[rgba(14,116,144,0.07)] text-[#0E7490] ring-blue-200",
  ER:  "bg-orange-50 text-orange-700 ring-orange-200",
}
const PRIORITY_STYLE: Record<Priority, string> = {
  STAT:    "bg-red-100 text-red-700",
  Urgent:  "bg-amber-100 text-amber-700",
  Routine: "bg-slate-100 text-slate-600",
  Trauma:   "bg-red-100 text-red-800",
  Stroke:   "bg-red-600 text-white",
  Critical: "bg-red-700 text-white",
}
const SOURCES: RadSource[] = ["OPD", "IPD", "ICU", "OT", "ER"]
const PRIORITIES: Priority[] = ["STAT", "Urgent", "Routine"]

const timeAgo = (iso?: string) => {
  if (!iso) return ""
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < -1) return `in ${-mins}m`
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

const inOrdered = (s: RadiologyStudy) => s.status === "ordered"
const inScheduled = (s: RadiologyStudy) => s.status === "scheduled"
const inArrived = (s: RadiologyStudy) =>
  s.status === "arrived" || s.status === "acquiring" || s.status === "acquired"

export default function RadiologyInbox() {
  const studies = useRadiologyStudiesStore(s => s.studies)
  const schedule = useRadiologyStudiesStore(s => s.schedule)
  const markArrived = useRadiologyStudiesStore(s => s.markArrived)
  const setContrastConsented = useRadiologyStudiesStore(s => s.setContrastConsented)
  const currentUser = useAuthStore(s => s.currentUser)
  const meName = currentUser?.name ?? "Reception"

  const [tab, setTab] = useState<"ordered" | "scheduled" | "arrived">("ordered")
  const [sourceFilter, setSourceFilter] = useState<"all" | RadSource>("all")
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [scheduleOffset, setScheduleOffset] = useState<Record<string, number>>({})

  const counts = useMemo(() => ({
    ordered: studies.filter(inOrdered).length,
    scheduled: studies.filter(inScheduled).length,
    arrived: studies.filter(inArrived).length,
  }), [studies])

  const filtered = useMemo(() => {
    const inTab = tab === "ordered" ? inOrdered : tab === "scheduled" ? inScheduled : inArrived
    return studies.filter(s => inTab(s)
      && (sourceFilter === "all" || s.source === sourceFilter)
      && (priorityFilter === "all" || s.priority === priorityFilter))
  }, [studies, tab, sourceFilter, priorityFilter])

  const onSchedule = (s: RadiologyStudy) => {
    const offsetMin = scheduleOffset[s.id] ?? 15
    const when = new Date(Date.now() + offsetMin * 60_000).toISOString()
    schedule(s.id, when)
    toast.success(`${s.name} scheduled for ${new Date(when).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`)
    setTab("scheduled")
  }

  const onArrived = (s: RadiologyStudy) => {
    const cat = RADIOLOGY_CATALOG[s.code]
    if (cat?.contrast && !s.contrastConsented) {
      toast.error("Contrast consent required before patient can proceed.")
      return
    }
    markArrived(s.id)
    toast.success(`${s.patientName} checked in · routed to ${cat?.modality ?? s.modality} bench`)
    setTab("arrived")
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-[#0E7490]" /> Radiology Inbox
        </h1>
        <p className="text-sm text-[#64748B] mt-1">Schedule incoming orders · check in arriving patients · contrast/safety gates before routing</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
          {([
            ["ordered", `Ordered (${counts.ordered})`],
            ["scheduled", `Scheduled (${counts.scheduled})`],
            ["arrived", `On bench (${counts.arrived})`],
          ] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={cn("px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition",
                tab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>{label}</button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100">
          <button onClick={() => setSourceFilter("all")}
            className={cn("px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer", sourceFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>All</button>
          {SOURCES.map(s => (
            <button key={s} onClick={() => setSourceFilter(s)}
              className={cn("px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition",
                sourceFilter === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>{s}</button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100">
          <button onClick={() => setPriorityFilter("all")}
            className={cn("px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer", priorityFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>Any priority</button>
          {PRIORITIES.map(p => (
            <button key={p} onClick={() => setPriorityFilter(p)}
              className={cn("px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition",
                priorityFilter === p ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>{p}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <ScanLine className="h-9 w-9 mb-2 opacity-40" />
            <p className="text-sm font-semibold">
              {tab === "ordered" ? "No new orders pending scheduling" :
               tab === "scheduled" ? "No patients scheduled" :
               "No patients on the bench right now"}
            </p>
          </div>
        )}
        {filtered.map(s => (
          <StudyRow key={s.id} s={s}
            expanded={expandedId === s.id}
            offset={scheduleOffset[s.id] ?? 15}
            setOffset={(v) => setScheduleOffset(prev => ({ ...prev, [s.id]: v }))}
            onToggle={() => setExpandedId(id => id === s.id ? null : s.id)}
            onSchedule={() => onSchedule(s)}
            onArrived={() => onArrived(s)}
            onContrast={(ok) => { setContrastConsented(s.id, ok); toast(`Contrast consent ${ok ? "recorded" : "withdrawn"}`); void meName }}
          />
        ))}
      </div>
    </div>
  )
}

function StudyRow(props: {
  s: RadiologyStudy
  expanded: boolean
  offset: number
  setOffset: (v: number) => void
  onToggle: () => void
  onSchedule: () => void
  onArrived: () => void
  onContrast: (ok: boolean) => void
}) {
  const { s, expanded, offset } = props
  const cat = RADIOLOGY_CATALOG[s.code]
  const needsContrast = !!cat?.contrast
  const contrastReady = !!s.contrastConsented
  const stat = s.priority === "STAT"

  return (
    <div className={cn("rounded-xl bg-white ring-1 overflow-hidden",
      needsContrast && !contrastReady ? "ring-amber-200" : "ring-slate-200/70")}>
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <span className={cn("flex-shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg ring-1", SOURCE_STYLE[s.source])}>{s.source}</span>

        <button onClick={props.onToggle} className="flex-1 min-w-0 text-left cursor-pointer">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900 truncate">{s.patientName}</span>
            <span className="text-[11px] font-bold text-slate-400">{s.patientId}</span>
            {s.wardBed && <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-0.5"><Bed className="h-3 w-3" />{s.wardBed}</span>}
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", PRIORITY_STYLE[s.priority])}>{s.priority}</span>
            {stat && <span className="text-[10px] font-bold text-red-700 animate-pulse">⚡</span>}
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[rgba(14,116,144,0.12)] text-[#0E7490]">{s.modality}</span>
            {needsContrast && (
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-0.5",
                contrastReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                <ShieldCheck className="h-3 w-3" />{contrastReady ? "consent OK" : "consent needed"}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1 flex-wrap">
            <span className="font-bold text-slate-700">{s.name}</span>
            <span className="text-slate-400">·</span>
            <Stethoscope className="h-3 w-3" />{s.doctorName}
            <span className="text-slate-400">·</span>
            ordered {timeAgo(s.orderedAt)}
            {s.scheduledFor && (
              <>
                <span className="text-slate-400">·</span>
                <Calendar className="h-3 w-3" />scheduled {timeAgo(s.scheduledFor)}
              </>
            )}
          </p>
        </button>

        <div className="hidden md:flex flex-col items-end flex-shrink-0 w-20">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-0.5"><IndianRupee className="h-3 w-3" />{s.paymentMode}</span>
          <span className="text-[10px] text-slate-400">TAT {s.expectedTATmin}m</span>
        </div>

        <div className="flex-shrink-0 flex items-center gap-2">
          {s.status === "ordered" && (
            <>
              <Select value={offset} onChange={e => props.setOffset(Number(e.target.value))}
                className="text-[11px] font-semibold rounded-lg border border-slate-200 bg-white px-2 py-1.5 cursor-pointer">
                <option value={15}>+15m</option>
                <option value={30}>+30m</option>
                <option value={60}>+1h</option>
                <option value={120}>+2h</option>
              </Select>
              <button onClick={props.onSchedule}
                className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl cursor-pointer whitespace-nowrap"
                style={{ background: "linear-gradient(135deg,#0B5A6E,#0E7490)", boxShadow: "0 2px 8px rgba(14,116,144,0.25)" }}>
                <Calendar className="h-3.5 w-3.5" /> Schedule
              </button>
            </>
          )}
          {s.status === "scheduled" && (
            <button onClick={props.onArrived}
              className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl cursor-pointer whitespace-nowrap"
              style={{ background: "linear-gradient(135deg,#16A34A,#0B5A6E)", boxShadow: "0 2px 8px rgba(22,163,74,0.25)" }}>
              <Send className="h-3.5 w-3.5" /> Mark arrived
            </button>
          )}
          {(s.status === "arrived" || s.status === "acquiring" || s.status === "acquired") && (
            <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">On bench</span>
          )}
          <button onClick={props.onToggle} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer text-slate-400">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Clinical question</p>
            <p className="text-sm text-slate-700">{s.clinicalQuestion ?? "—"}</p>
          </div>
          {cat?.preparation && (
            <div className="flex items-start gap-2 text-xs text-slate-600 rounded-lg bg-amber-50 ring-1 ring-amber-200 p-2.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
              <span><b>Preparation:</b> {cat.preparation}</span>
            </div>
          )}
          {needsContrast && !contrastReady && (
            <div className="rounded-lg ring-1 ring-amber-200 bg-amber-50 p-2.5 space-y-1.5">
              <p className="text-xs font-bold text-amber-800 flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />Contrast safety</p>
              <p className="text-[11px] text-amber-700">Confirm allergies, renal function (eGFR ≥ 30) and metformin status before contrast administration.</p>
              <div className="flex gap-1.5">
                <button onClick={() => props.onContrast(true)}
                  className="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-lg cursor-pointer">Record consent</button>
                <button onClick={() => props.onContrast(false)}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 px-2.5 py-1 cursor-pointer">Withdraw</button>
              </div>
            </div>
          )}
          {s.aiPrelim && (
            <p className="text-[11px] text-[#0E7490] italic">{s.aiPrelim}</p>
          )}
          <p className="text-[11px] text-slate-400 flex items-center gap-1"><Clock className="h-3 w-3" />TAT target: {s.expectedTATmin} min</p>
        </div>
      )}
    </div>
  )
}
