"use client"

import { useMemo, useState } from "react"
import {
  ScanLine, Bed, Stethoscope, ChevronDown, ChevronRight, Hand, Camera, Upload,
  Image as ImageIcon, CheckCircle, X, Clock, ShieldCheck, Sparkles, Gauge, AlertTriangle,
} from "lucide-react"
import {
  useRadiologyStudiesStore,
  type RadiologyStudy, type StudyStatus, type RadTech, type DoseRecord,
} from "@/store/useRadiologyStudiesStore"
import { type Modality, type Priority, RADIOLOGY_CATALOG } from "@/lib/radiologyCatalog"
import { assessImageQuality } from "@/lib/radiologyAI"
import { useAuthStore } from "@/store/useAuthStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const MODALITY_TABS: { code: Modality; label: string }[] = [
  { code: "XR",    label: "X-Ray" },
  { code: "CT",    label: "CT" },
  { code: "MRI",   label: "MRI" },
  { code: "US",    label: "Ultrasound" },
  { code: "MAMMO", label: "Mammo" },
]

const STATUS_STYLE: Record<StudyStatus, string> = {
  ordered: "bg-slate-100 text-slate-500",
  scheduled: "bg-slate-100 text-slate-500",
  arrived: "bg-amber-100 text-amber-700",
  acquiring: "bg-[rgba(14,116,144,0.12)] text-[#0E7490]",
  acquired: "bg-emerald-100 text-emerald-700",
  reading: "bg-[rgba(14,116,144,0.12)] text-[#0E7490]",
  reported: "bg-[rgba(14,116,144,0.12)] text-[#0E7490]",
  verified: "bg-slate-100 text-slate-500",
  released: "bg-slate-100 text-slate-500",
  cancelled: "bg-red-100 text-red-700",
}
const STATUS_LABEL: Record<StudyStatus, string> = {
  ordered: "Ordered", scheduled: "Scheduled", arrived: "Arrived",
  acquiring: "Acquiring", acquired: "Acquired",
  reading: "In reading", reported: "Reported",
  verified: "Verified", released: "Released", cancelled: "Cancelled",
}
const PRIORITY_STYLE: Record<Priority, string> = {
  STAT: "bg-red-100 text-red-700", Urgent: "bg-amber-100 text-amber-700", Routine: "bg-slate-100 text-slate-600",
  Trauma: "bg-red-100 text-red-800", Stroke: "bg-red-600 text-white", Critical: "bg-red-700 text-white",
}
const STATUS_SORT: Record<StudyStatus, number> = {
  acquiring: 0, arrived: 1, acquired: 2,
  reading: 3, reported: 4, scheduled: 5, ordered: 6,
  verified: 7, released: 8, cancelled: 9,
}

const timeAgo = (iso?: string) => {
  if (!iso) return ""
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

export default function ModalityBench() {
  const studies = useRadiologyStudiesStore(s => s.studies)
  const claimAcquisition = useRadiologyStudiesStore(s => s.claimAcquisition)
  const markAcquired = useRadiologyStudiesStore(s => s.markAcquired)
  const attachImage = useRadiologyStudiesStore(s => s.attachImage)
  const recordDose = useRadiologyStudiesStore(s => s.recordDose)
  const flagQuality = useRadiologyStudiesStore(s => s.flagQuality)
  const currentUser = useAuthStore(s => s.currentUser)
  const me: RadTech = { id: currentUser?.id ?? "RT-101", name: currentUser?.name ?? "Radiographer" }

  const [modality, setModality] = useState<Modality>("XR")
  const [scope, setScope] = useState<"all" | "mine">("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filename, setFilename] = useState<Record<string, string>>({})

  const rows = useMemo(() => {
    return studies
      .filter(s => s.modality === modality)
      .filter(s => ["arrived", "acquiring", "acquired", "reading", "reported"].includes(s.status))
      .filter(s => scope === "all" || s.acquiringBy?.id === me.id)
      .sort((a, b) => STATUS_SORT[a.status] - STATUS_SORT[b.status])
  }, [studies, modality, scope, me.id])

  const counts = useMemo(() => {
    const c: Record<Modality, number> = { XR: 0, CT: 0, MRI: 0, US: 0, MAMMO: 0, NM: 0 }
    for (const s of studies) {
      if (["arrived", "acquiring", "acquired"].includes(s.status)) c[s.modality]++
    }
    return c
  }, [studies])

  const onAttach = (s: RadiologyStudy) => {
    const name = (filename[s.id] ?? `${s.modality}-${s.id.slice(-4)}-${s.attachments.length + 1}.jpg`).trim()
    if (!name) { toast.error("Filename required"); return }
    attachImage(s.id, { filename: name, caption: `${s.bodyPart} view`, uploadedBy: me.name })
    setFilename(prev => ({ ...prev, [s.id]: "" }))
    toast.success(`${name} attached`)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
          <ScanLine className="h-6 w-6 text-[#0E7490]" /> Modality Bench
        </h1>
        <p className="text-sm text-[#64748B] mt-1">Radiographer surface · accept patient → acquire → attach images → send for reading</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
          {MODALITY_TABS.map(m => (
            <button key={m.code} onClick={() => setModality(m.code)}
              className={cn("px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition",
                modality === m.code ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
              {m.label} <span className="ml-1 text-[10px] font-bold text-slate-400">{counts[m.code]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
          {([["all", "All"], ["mine", "My counter"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setScope(k)}
              className={cn("px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer transition",
                scope === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>{label}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Camera className="h-9 w-9 mb-2 opacity-40" />
            <p className="text-sm font-semibold">No patients on this modality right now</p>
          </div>
        )}
        {rows.map(s => (
          <BenchRow key={s.id} s={s} me={me}
            expanded={expandedId === s.id}
            filename={filename[s.id] ?? ""}
            onFilenameChange={(v) => setFilename(prev => ({ ...prev, [s.id]: v }))}
            onToggle={() => setExpandedId(id => id === s.id ? null : s.id)}
            onClaim={() => { claimAcquisition(s.id, me); setExpandedId(s.id); toast.success(`${s.patientName} on your counter`) }}
            onAcquire={() => {
              if (s.attachments.length === 0) {
                toast.error("Attach at least one image before marking acquired.")
                return
              }
              markAcquired(s.id)
              toast.success(`${s.name} acquired · sent to Reading Room`)
            }}
            onAttach={() => onAttach(s)}
            onDose={(d) => { recordDose(s.id, { ...d, recordedBy: me.name }); toast.success("Dose recorded") }}
            onFlagQuality={() => { const a = assessImageQuality(s).data; flagQuality(s.id, { motion: a.motion, incompleteCoverage: a.incompleteCoverage, note: a.note }); toast.warning("Quality issue flagged") }} />
        ))}
      </div>
    </div>
  )
}

function BenchRow(props: {
  s: RadiologyStudy; me: RadTech
  expanded: boolean
  filename: string
  onFilenameChange: (v: string) => void
  onToggle: () => void
  onClaim: () => void
  onAcquire: () => void
  onAttach: () => void
  onDose: (d: DoseRecord) => void
  onFlagQuality: () => void
}) {
  const { s, me, expanded, filename } = props
  const cat = RADIOLOGY_CATALOG[s.code]
  const mine = s.acquiringBy?.id === me.id
  const minsElapsed = Math.round((Date.now() - new Date(s.orderedAt).getTime()) / 60000)
  const overdue = minsElapsed > s.expectedTATmin && s.status !== "released" && s.status !== "verified"
  const needsContrast = !!cat?.contrast
  const contrastReady = !!s.contrastConsented
  const [dlp, setDlp] = useState("")
  const [mas, setMas] = useState("")
  const showDose = !!cat?.radiationDose && (s.status === "acquiring" || s.status === "acquired")
  const quality = assessImageQuality(s).data

  return (
    <div className={cn("rounded-xl bg-white ring-1 overflow-hidden", overdue ? "ring-red-200" : "ring-slate-200/70")}>
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <span className={cn("flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-lg", PRIORITY_STYLE[s.priority])}>{s.priority}</span>

        <button onClick={props.onToggle} className="flex-1 min-w-0 text-left cursor-pointer">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900 truncate">{s.patientName}</span>
            <span className="text-[11px] font-bold text-slate-400">{s.patientId}</span>
            {s.wardBed && <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-0.5"><Bed className="h-3 w-3" />{s.wardBed}</span>}
            <span className="text-[12px] font-bold text-[#0E7490]">{s.name}</span>
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", STATUS_STYLE[s.status])}>{STATUS_LABEL[s.status]}</span>
            {s.acquiringBy && <span className="text-[11px] font-semibold text-slate-400">· {mine ? "your counter" : `on ${s.acquiringBy.name}`}</span>}
            {needsContrast && (
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5",
                contrastReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                <ShieldCheck className="h-3 w-3" />{contrastReady ? "consent OK" : "consent needed"}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1">
            <Stethoscope className="h-3 w-3" />{s.doctorName}
            <span className="text-slate-400 mx-1">·</span>
            <Clock className="h-3 w-3" />{minsElapsed}m elapsed / {s.expectedTATmin}m TAT
            {overdue && <span className="text-red-600 font-bold ml-1">overdue</span>}
            {s.attachments.length > 0 && (
              <>
                <span className="text-slate-400 mx-1">·</span>
                <ImageIcon className="h-3 w-3" />{s.attachments.length} image{s.attachments.length > 1 ? "s" : ""}
              </>
            )}
          </p>
        </button>

        <div className="flex-shrink-0 flex items-center gap-2">
          {s.status === "arrived" && !s.acquiringBy && (
            <button onClick={props.onClaim}
              className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl cursor-pointer"
              style={{ background: "linear-gradient(135deg,#0B5A6E,#0E7490)", boxShadow: "0 2px 8px rgba(14,116,144,0.25)" }}>
              <Hand className="h-3.5 w-3.5" />Accept
            </button>
          )}
          {s.status === "acquiring" && mine && (
            <button onClick={props.onAcquire}
              className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl cursor-pointer"
              style={{ background: "linear-gradient(135deg,#16A34A,#0B5A6E)", boxShadow: "0 2px 8px rgba(22,163,74,0.25)" }}>
              <CheckCircle className="h-3.5 w-3.5" />Mark acquired
            </button>
          )}
          {(s.status === "acquired" || s.status === "reading" || s.status === "reported") && (
            <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">{STATUS_LABEL[s.status]}</span>
          )}
          <button onClick={props.onToggle} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer text-slate-400">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3">
          {s.clinicalQuestion && (
            <p className="text-xs text-slate-600"><b className="text-slate-700">Clinical question:</b> {s.clinicalQuestion}</p>
          )}

          {/* Image attachments */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Image attachments</p>
            {s.attachments.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No images attached yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                {s.attachments.map(a => (
                  <div key={a.id} className="rounded-lg bg-white ring-1 ring-slate-200/70 p-2 flex flex-col">
                    <div className="h-16 rounded bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-[11px] font-semibold text-slate-700 mt-1.5 truncate" title={a.filename}>{a.filename}</p>
                    {a.caption && <p className="text-[10px] text-slate-500 truncate">{a.caption}</p>}
                  </div>
                ))}
              </div>
            )}
            {(s.status === "acquiring" && mine) && (
              <div className="flex items-center gap-2 mt-1">
                <input value={filename} onChange={e => props.onFilenameChange(e.target.value)}
                  placeholder={`${s.modality}-${s.id.slice(-4)}-N.jpg`}
                  className="flex-1 h-8 px-2 text-xs rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                <button onClick={props.onAttach}
                  className="flex items-center gap-1 text-xs font-bold text-[#0E7490] bg-[rgba(14,116,144,0.07)] hover:bg-[rgba(14,116,144,0.14)] px-2.5 py-1.5 rounded-lg cursor-pointer">
                  <Upload className="h-3 w-3" />Attach
                </button>
              </div>
            )}
          </div>

          {s.aiPrelim && (
            <p className="text-[11px] text-[#0E7490] italic bg-[rgba(14,116,144,0.07)]/60 rounded-md px-2 py-1.5">{s.aiPrelim}</p>
          )}

          {/* AI image-quality assessment */}
          {(s.status === "acquiring" || s.status === "acquired") && s.attachments.length > 0 && (
            <div className={cn("rounded-lg ring-1 p-2.5 flex items-start gap-2", quality.passed ? "bg-emerald-50 ring-emerald-200" : "bg-amber-50 ring-amber-200")}>
              {quality.passed ? <Sparkles className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />}
              <div className="flex-1">
                <p className={cn("text-[11px] font-bold", quality.passed ? "text-emerald-800" : "text-amber-800")}>AI quality check{quality.passed ? " — diagnostic" : " — review"}</p>
                <p className={cn("text-[11px]", quality.passed ? "text-emerald-700" : "text-amber-700")}>{quality.note}</p>
              </div>
              {!quality.passed && mine && (
                <button onClick={props.onFlagQuality} className="text-[10.5px] font-bold text-amber-800 bg-white ring-1 ring-amber-300 px-2 py-1 rounded-lg cursor-pointer flex-shrink-0">Flag</button>
              )}
            </div>
          )}

          {/* Radiation dose tracking */}
          {showDose && (
            <div className="rounded-lg ring-1 ring-slate-200/70 bg-white p-2.5">
              <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mb-1.5"><Gauge className="h-3.5 w-3.5 text-[#0B5A6E]" />Radiation dose ({cat?.radiationDose} dose exam)</p>
              {s.doseRecord ? (
                <p className="text-[11.5px] text-slate-600">Recorded: {s.doseRecord.dlp ? `DLP ${s.doseRecord.dlp} mGy·cm` : ""} {s.doseRecord.mas ? `· ${s.doseRecord.mas} mAs` : ""} {s.doseRecord.recordedBy ? `· by ${s.doseRecord.recordedBy}` : ""}</p>
              ) : mine ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <input value={dlp} onChange={e => setDlp(e.target.value)} placeholder="DLP (mGy·cm)" inputMode="decimal" className="h-8 w-32 px-2 text-xs rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  <input value={mas} onChange={e => setMas(e.target.value)} placeholder="mAs" inputMode="decimal" className="h-8 w-20 px-2 text-xs rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  <button onClick={() => { props.onDose({ dlp: dlp ? Number(dlp) : undefined, mas: mas ? Number(mas) : undefined }); setDlp(""); setMas("") }}
                    className="h-8 px-3 text-xs font-bold text-white bg-[#0B5A6E] hover:bg-[#172E6E] rounded-lg cursor-pointer">Record</button>
                </div>
              ) : <p className="text-[11px] text-slate-400 italic">Dose not yet recorded.</p>}
            </div>
          )}

          {s.status === "acquiring" && mine && (
            <button onClick={() => { props.onToggle() }} className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer">
              <X className="h-3 w-3" />Close
            </button>
          )}
        </div>
      )}
    </div>
  )
}
