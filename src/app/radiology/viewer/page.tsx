"use client"

import { useMemo, useState } from "react"
import { ScanLine, Info, Sparkles, Image as ImageIcon, ZoomIn, RotateCw, Contrast } from "lucide-react"
import { useRadiologyStudiesStore } from "@/store/useRadiologyStudiesStore"
import { detectFindings } from "@/lib/radiologyAI"
import { getConfidenceTier } from "@/lib/ai-helpers"
import { AiConfidenceBadge } from "@/components/ui/AiConfidenceBadge"
import { cn } from "@/lib/utils"

const VIEWABLE = new Set(["acquired", "reading", "reported", "verified", "released"])

export default function RadiologyViewer() {
  const studies = useRadiologyStudiesStore(s => s.studies)
  const list = useMemo(() => studies.filter(s => VIEWABLE.has(s.status)), [studies])
  const [selectedId, setSelectedId] = useState<string | null>(list[0]?.id ?? null)
  const selected = list.find(s => s.id === selectedId) ?? null
  const ai = useMemo(() => selected ? detectFindings(selected) : null, [selected])
  const findings = selected ? (selected.aiFindings?.length ? selected.aiFindings : ai?.data ?? []) : []

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">DICOM Viewer</h2>
        <p className="text-slate-500 text-sm mt-1">Image viewer with AI findings overlay · worklist from live RIS studies</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Study list */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Worklist ({list.length})</p>
          {list.length === 0 && <p className="text-sm text-slate-400">No acquired studies.</p>}
          {list.map((s) => (
            <button key={s.id} onClick={() => setSelectedId(s.id)}
              className={cn("w-full text-left bg-white rounded-xl border p-3 transition-all", selectedId === s.id ? "border-[#0B5A6E] ring-1 ring-[#0B5A6E]" : "border-[#EAECF2] hover:border-[#D0D5DD]")}>
              <p className="font-bold text-slate-900 text-sm truncate">{s.patientName}</p>
              <p className="text-xs text-slate-500 truncate">{s.modality} · {s.bodyPart}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{s.id} · {s.status}</p>
            </button>
          ))}
        </div>

        {/* Viewer canvas */}
        <div className="lg:col-span-2">
          <div className="relative bg-black rounded-2xl border border-slate-800 aspect-[4/3] overflow-hidden flex items-center justify-center">
            {selected ? (
              <>
                <ImageIcon className="h-20 w-20 text-slate-800" />
                {/* AI heatmap overlay */}
                {findings.filter(f => f.heatmap).map(f => (
                  <div key={f.id} className="absolute rounded border-2 border-red-400/90"
                    style={{ left: `${f.heatmap!.x * 100}%`, top: `${f.heatmap!.y * 100}%`, width: `${f.heatmap!.w * 100}%`, height: `${f.heatmap!.h * 100}%`, boxShadow: "0 0 0 9999px rgba(239,68,68,0.06) inset, 0 0 16px rgba(239,68,68,0.5)" }}>
                    <span className="absolute -top-5 left-0 text-[10px] font-bold text-red-300 whitespace-nowrap bg-black/50 px-1 rounded">{f.label} · {Math.round(f.confidence * 100)}%</span>
                  </div>
                ))}
                {/* Toolbar */}
                <div className="absolute top-3 right-3 flex gap-1.5">
                  {[ZoomIn, RotateCw, Contrast].map((Icon, i) => (
                    <button key={i} className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 flex items-center justify-center"><Icon className="h-4 w-4" /></button>
                  ))}
                </div>
                <div className="absolute bottom-3 left-3 text-[11px] text-white/60">
                  <p className="font-bold text-white/80">{selected.patientName}</p>
                  <p>{selected.name} · {selected.bodyPart}</p>
                </div>
                <span className="absolute bottom-3 right-3 text-[9px] text-white/40">AI overlay · demo render</span>
              </>
            ) : (
              <div className="text-center">
                <ScanLine className="h-16 w-16 text-slate-700 mb-3 mx-auto" />
                <p className="text-slate-500 font-medium">Select a study to open viewer</p>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            Full DICOM rendering uses Cornerstone.js / OHIF (post-launch). AI findings + heatmap regions shown here are simulated decision support — verify against source images.
          </div>
        </div>

        {/* AI findings sidebar */}
        <div className="rounded-2xl border border-[#EAECF2] bg-white shadow-[var(--shadow-card)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-[#0B5A6E]" />
            <h3 className="text-sm font-bold text-slate-900">AI findings</h3>
          </div>
          {!selected ? <p className="text-sm text-slate-400">Select a study.</p> : findings.length === 0 ? (
            <p className="text-sm text-slate-400">No AI findings.</p>
          ) : (
            <div className="space-y-2.5">
              {findings.map(f => (
                <div key={f.id} className="rounded-xl border border-[#EAECF2] p-2.5">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full flex-shrink-0", f.category === "critical" ? "bg-red-500" : f.category === "actionable" ? "bg-amber-500" : "bg-emerald-500")} />
                    <span className="text-[12.5px] font-semibold text-slate-800 flex-1">{f.label}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase text-slate-400">{f.category}{f.birads ? ` · BI-RADS ${f.birads}` : ""}{f.lungrads ? ` · Lung-RADS ${f.lungrads}` : ""}{f.pirads ? ` · PI-RADS ${f.pirads}` : ""}</span>
                    <AiConfidenceBadge confidence={f.confidence} tier={getConfidenceTier(f.confidence)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
