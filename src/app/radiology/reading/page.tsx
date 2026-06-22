"use client"

import { useMemo, useState } from "react"
import {
  FileText, Bed, Stethoscope, ChevronDown, ChevronRight, Hand, Send, Sparkles,
  Image as ImageIcon, Clock, ShieldAlert, Mic, MicOff, Wand2, GitCompare,
} from "lucide-react"
import {
  useRadiologyStudiesStore,
  type RadiologyStudy, type RadTech, type AiFinding,
} from "@/store/useRadiologyStudiesStore"
import { RADIOLOGY_CATALOG, TEMPLATE_SECTIONS, type Priority } from "@/lib/radiologyCatalog"
import { useAuthStore } from "@/store/useAuthStore"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { detectFindings, draftImpression, isCriticalText } from "@/lib/radiologyAI"
import { getConfidenceTier } from "@/lib/ai-helpers"
import { AiConfidenceBadge } from "@/components/ui/AiConfidenceBadge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const PRIORITY_STYLE: Record<Priority, string> = {
  STAT: "bg-red-100 text-red-700", Urgent: "bg-amber-100 text-amber-700", Routine: "bg-slate-100 text-slate-600",
  Trauma: "bg-red-100 text-red-800", Stroke: "bg-red-600 text-white", Critical: "bg-red-700 text-white",
}

const timeAgo = (iso?: string) => {
  if (!iso) return ""
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

export default function ReadingRoom() {
  const studies = useRadiologyStudiesStore(s => s.studies)
  const claimReading = useRadiologyStudiesStore(s => s.claimReading)
  const setAIPrelim = useRadiologyStudiesStore(s => s.setAIPrelim)
  const setAIFindings = useRadiologyStudiesStore(s => s.setAIFindings)
  const updateReportSection = useRadiologyStudiesStore(s => s.updateReportSection)
  const submitReport = useRadiologyStudiesStore(s => s.submitReport)
  const currentUser = useAuthStore(s => s.currentUser)
  const me: RadTech = { id: currentUser?.id ?? "RAD-304", name: currentUser?.name ?? "Radiologist" }

  const [scope, setScope] = useState<"all" | "mine">("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const rows = useMemo(() => {
    return studies
      .filter(s => s.status === "acquired" || s.status === "reading")
      .filter(s => scope === "all" || s.readingBy?.id === me.id)
      .sort((a, b) => {
        const pri = { Critical: -3, Stroke: -2, Trauma: -1, STAT: 0, Urgent: 1, Routine: 2 } as const
        return pri[a.priority] - pri[b.priority]
      })
  }, [studies, scope, me.id])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
          <FileText className="h-6 w-6 text-[#0E7490]" /> Reading Room
        </h1>
        <p className="text-sm text-[#64748B] mt-1">Radiologist queue · AI prelim · structured report · submit for verification</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
          {([["all", "All"], ["mine", "My queue"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setScope(k)}
              className={cn("px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer transition",
                scope === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>{label}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="h-9 w-9 mb-2 opacity-40" />
            <p className="text-sm font-semibold">No studies waiting to be read</p>
          </div>
        )}
        {rows.map(s => (
          <ReadingRow key={s.id} s={s} me={me}
            expanded={expandedId === s.id}
            onToggle={() => setExpandedId(id => id === s.id ? null : s.id)}
            onClaim={() => { claimReading(s.id, me); setExpandedId(s.id); toast.success(`${s.name} on your queue`) }}
            onAI={() => { setAIPrelim(s.id); toast.success("AI prelim generated") }}
            onSaveFindings={(f) => setAIFindings(s.id, f)}
            onUpdate={(key, value) => updateReportSection(s.id, key, value)}
            onSubmit={() => {
              const cat = RADIOLOGY_CATALOG[s.code]
              const tmpl = cat ? TEMPLATE_SECTIONS[cat.template] : []
              const missing = tmpl.filter(sec => sec.required && !((s.reportSections[sec.key] ?? "").trim()))
              if (missing.length > 0) {
                toast.error(`Required: ${missing.map(m => m.label).join(", ")}`)
                return
              }
              submitReport(s.id, me)
              notifyAndAudit({
                to: 'radiology', type: 'system', priority: s.priority === 'STAT' ? 'high' : 'medium',
                title: `Verification queue · ${s.name}`,
                body: `${s.modality} ${s.name} for ${s.patientName} (${s.patientId}) awaiting second-read sign-off. Read by ${me.name}.`,
                patientName: s.patientName,
                audit: { action: 'radiology_report_verified', resource: 'radiology_study', resourceId: s.id, detail: `Report submitted for verification`, userName: me.name },
              })
              toast.success(`${s.name} submitted for verification`)
            }} />
        ))}
      </div>
    </div>
  )
}

function ReadingRow(props: {
  s: RadiologyStudy; me: RadTech
  expanded: boolean
  onToggle: () => void
  onClaim: () => void
  onAI: () => void
  onSaveFindings: (f: AiFinding[]) => void
  onUpdate: (key: string, value: string) => void
  onSubmit: () => void
}) {
  const { s, me, expanded } = props
  const cat = RADIOLOGY_CATALOG[s.code]
  const tmpl = cat ? TEMPLATE_SECTIONS[cat.template] : []
  const mine = s.readingBy?.id === me.id
  const minsElapsed = Math.round((Date.now() - new Date(s.orderedAt).getTime()) / 60000)
  const overdue = minsElapsed > s.expectedTATmin
  // Deterministic AI detection for this study (structured findings + heatmap).
  const ai = useMemo(() => detectFindings(s), [s.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const aiFindings = s.aiFindings && s.aiFindings.length ? s.aiFindings : ai.data
  const [listening, setListening] = useState(false)

  // Voice dictation → appends transcript into the (uncontrolled) impression textarea.
  const dictateImpression = () => {
    const SR = (typeof window !== "undefined" && ((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition)) as (new () => { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start: () => void; stop: () => void }) | undefined
    if (!SR) { toast.error("Voice dictation not supported in this browser"); return }
    const rec = new SR()
    rec.lang = "en-IN"; rec.interimResults = false
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join(" ")
      const ta = document.querySelector<HTMLTextAreaElement>(`textarea[data-section="impression"][data-study="${s.id}"]`)
      const next = ta ? `${ta.value} ${transcript}`.trim() : transcript
      if (ta) ta.value = next
      props.onUpdate("impression", next)
      toast.success("Dictated into impression")
    }
    rec.onend = () => setListening(false)
    setListening(true); rec.start()
  }

  const acceptAiDraft = () => {
    const draft = draftImpression(aiFindings)
    const ta = document.querySelector<HTMLTextAreaElement>(`textarea[data-section="impression"][data-study="${s.id}"]`)
    if (ta) ta.value = draft
    props.onUpdate("impression", draft)
    props.onSaveFindings(aiFindings)
    toast.success("AI draft inserted — review & edit before submitting")
  }

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
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[rgba(14,116,144,0.12)] text-[#0E7490]">{s.modality}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">{cat?.template ?? "general"}</span>
            {s.readingBy && <span className="text-[11px] font-semibold text-slate-400">· {mine ? "your queue" : `on ${s.readingBy.name}`}</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1 flex-wrap">
            <Stethoscope className="h-3 w-3" />ordered by {s.doctorName}
            <span className="text-slate-400 mx-1">·</span>
            <Clock className="h-3 w-3" />{minsElapsed}m elapsed / {s.expectedTATmin}m TAT
            {overdue && <span className="text-red-600 font-bold ml-1">overdue</span>}
            {s.attachments.length > 0 && (
              <>
                <span className="text-slate-400 mx-1">·</span>
                <ImageIcon className="h-3 w-3" />{s.attachments.length}
              </>
            )}
          </p>
        </button>

        <div className="flex-shrink-0 flex items-center gap-2">
          {s.status === "acquired" && (
            <button onClick={props.onClaim}
              className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl cursor-pointer"
              style={{ background: "linear-gradient(135deg,#0B5A6E,#0E7490)", boxShadow: "0 2px 8px rgba(14,116,144,0.25)" }}>
              <Hand className="h-3.5 w-3.5" />Read
            </button>
          )}
          {s.status === "reading" && mine && (
            <button onClick={props.onSubmit}
              className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl cursor-pointer whitespace-nowrap"
              style={{ background: "linear-gradient(135deg,#16A34A,#0B5A6E)", boxShadow: "0 2px 8px rgba(22,163,74,0.25)" }}>
              <Send className="h-3.5 w-3.5" />Submit for verification
            </button>
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

          {/* Attached images thumbnail */}
          {s.attachments.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Images</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {s.attachments.map(a => (
                  <div key={a.id} className="rounded-lg bg-white ring-1 ring-slate-200/70 p-1.5">
                    <div className="h-14 rounded bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="text-[10px] font-semibold text-slate-700 mt-1 truncate" title={a.filename}>{a.filename}</p>
                    {a.caption && <p className="text-[10px] text-slate-500 truncate">{a.caption}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI prelim */}
          <div className="rounded-lg ring-1 ring-blue-200 bg-[rgba(14,116,144,0.07)]/60 p-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] font-bold text-[#0E7490] flex items-center gap-1"><Sparkles className="h-3 w-3" />AI prelim</p>
              {s.status === "reading" && mine && (
                <button onClick={props.onAI}
                  className="text-[10px] font-bold text-[#0E7490] bg-white hover:bg-[rgba(14,116,144,0.14)] ring-1 ring-blue-200 px-2 py-0.5 rounded cursor-pointer">
                  {s.aiPrelim ? "Regenerate" : "Generate"}
                </button>
              )}
            </div>
            <p className="text-[12px] text-[#0B5A6E] mt-1 italic">{s.aiPrelim ?? "AI prelim not yet generated."}</p>
          </div>

          {/* AI structured detection + heatmap overlay (assistive only) */}
          <div className="rounded-lg ring-1 ring-[#0E7490]/15 bg-[rgba(14,116,144,0.06)] p-3">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <p className="text-[11px] font-bold text-[#0B5A6E] flex items-center gap-1"><Wand2 className="h-3 w-3" />AI structured findings</p>
              <span className="text-[10px] text-slate-400">{s.modality} · {s.bodyPart}</span>
              {mine && s.status === "reading" && (
                <button onClick={acceptAiDraft} className="ml-auto text-[10.5px] font-bold text-white bg-[#0B5A6E] hover:bg-[#085A6A] px-2.5 py-1 rounded-lg cursor-pointer inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />Insert draft impression
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-3">
              {/* Heatmap preview */}
              <div className="relative h-[110px] rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden flex-shrink-0">
                <ImageIcon className="absolute inset-0 m-auto h-7 w-7 text-white/15" />
                {aiFindings.filter(f => f.heatmap).map(f => (
                  <div key={f.id} className="absolute rounded border-2 border-red-400/90"
                    style={{ left: `${f.heatmap!.x * 100}%`, top: `${f.heatmap!.y * 100}%`, width: `${f.heatmap!.w * 100}%`, height: `${f.heatmap!.h * 100}%`, boxShadow: "0 0 0 9999px rgba(239,68,68,0.08) inset, 0 0 12px rgba(239,68,68,0.5)" }}>
                    <span className="absolute -top-4 left-0 text-[8px] font-bold text-red-300 whitespace-nowrap">{Math.round(f.confidence * 100)}%</span>
                  </div>
                ))}
                <span className="absolute bottom-1 left-1.5 text-[8px] font-semibold text-white/50">AI heatmap · demo</span>
              </div>
              {/* Findings list */}
              <div className="space-y-1.5">
                {aiFindings.map(f => (
                  <div key={f.id} className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full flex-shrink-0", f.category === "critical" ? "bg-red-500" : f.category === "actionable" ? "bg-amber-500" : "bg-emerald-500")} />
                    <span className="text-[12px] font-semibold text-slate-800 flex-1 truncate">{f.label}{f.birads ? ` · BI-RADS ${f.birads}` : ""}{f.lungrads ? ` · Lung-RADS ${f.lungrads}` : ""}{f.pirads ? ` · PI-RADS ${f.pirads}` : ""}</span>
                    <AiConfidenceBadge confidence={f.confidence} tier={getConfidenceTier(f.confidence)} />
                  </div>
                ))}
                {s.comparisonPriorId && <p className="text-[10.5px] text-slate-500 flex items-center gap-1 pt-0.5"><GitCompare className="h-3 w-3" />Prior study linked for comparison</p>}
              </div>
            </div>
          </div>

          {/* Structured report editor */}
          {tmpl.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Structured report</p>
              <div className="space-y-2">
                {tmpl.map(sec => {
                  const value = s.reportSections[sec.key] ?? ""
                  const editable = s.status === "reading" && mine
                  return (
                    <div key={sec.key} className="bg-white rounded-lg ring-1 ring-slate-200/70 p-2.5">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mb-1">
                        {sec.label}
                        {sec.required && <span className="text-[10px] text-red-600">required</span>}
                        {sec.key === "impression" && editable && (
                          <button type="button" onClick={dictateImpression}
                            className={cn("ml-auto inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer", listening ? "bg-red-100 text-red-700" : "bg-[#0B5A6E]/[0.08] text-[#0B5A6E] hover:bg-[#0B5A6E]/15")}>
                            {listening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}{listening ? "Listening…" : "Dictate"}
                          </button>
                        )}
                      </label>
                      {editable ? (
                        <textarea
                          data-section={sec.key} data-study={s.id}
                          defaultValue={value}
                          onBlur={(e) => props.onUpdate(sec.key, e.target.value)}
                          placeholder={sec.placeholder ?? ""}
                          rows={sec.key === "findings" || sec.key === "impression" ? 3 : 2}
                          className="w-full text-[12px] rounded-md border border-slate-200 p-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                      ) : (
                        <p className="text-[12px] text-slate-700 whitespace-pre-wrap">{value || <span className="italic text-slate-400">—</span>}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Critical-finding warning if flagged keywords appear in impression */}
          {checkCriticalImpression(s) && (
            <div className="rounded-lg bg-red-50 ring-1 ring-red-200 p-2.5 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-red-700">Impression contains a critical finding. On release, the ordering doctor will receive a HIGH-priority notification and the case will appear on the incharge's <b>critical-pending callback</b> list.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function checkCriticalImpression(s: RadiologyStudy): boolean {
  return isCriticalText(s.reportSections.impression) || isCriticalText(s.reportSections.findings)
    || isCriticalText(s.reportSections.lungrads) || isCriticalText(s.reportSections.birads) || isCriticalText(s.reportSections.pirads)
}
