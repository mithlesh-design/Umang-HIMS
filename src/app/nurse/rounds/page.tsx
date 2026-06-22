"use client"

import { Select } from "@/components/ui/Select"
import { useState, useRef, useEffect, useCallback } from "react"
import { type PatientBed, type RoundsNote } from "@/store/useWardStore"
import { useWard } from "@/lib/useWard"
import {
  Mic, MicOff, Save, Plus, X, ChevronDown, ChevronRight,
  Bed, Stethoscope, FlaskConical, FileText, ClipboardList,
  Sparkles, Clock, AlertCircle, Activity, Pill, Search,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { NeonBadge } from "@/components/ui/neon-badge"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { VoiceScribeButton } from "@/components/clinical/VoiceScribeButton"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { ClinicalNotesCard } from "@/components/nurse/ClinicalNotesCard"

// ── Speech Recognition types ──────────────────────────────────────────────────
type SpeechResultItem = { transcript: string }
type SpeechResultList = { length: number; [key: number]: { length: number; [key: number]: SpeechResultItem } }
type SpeechRecognitionType = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: { results: SpeechResultList }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionType
    webkitSpeechRecognition: new () => SpeechRecognitionType
  }
}

const CATEGORY_META = {
  observation: { label: 'Observation',  icon: Activity,      color: 'text-[#0E7490]',   bg: 'bg-[rgba(14,116,144,0.07)]/80',   badge: 'blue'    as const },
  medication:  { label: 'Medication',   icon: Pill,          color: 'text-[#0E7490]', bg: 'bg-[rgba(14,116,144,0.07)]/80', badge: 'muted'   as const },
  test:        { label: 'Test Order',   icon: FlaskConical,  color: 'text-amber-600',  bg: 'bg-amber-50/80',  badge: 'warning' as const },
  instruction: { label: 'Instruction',  icon: ClipboardList, color: 'text-[#0E7490]',   bg: 'bg-[rgba(14,116,144,0.07)]/80',   badge: 'teal'    as const },
}

function inferCategory(text: string): RoundsNote['category'] {
  const t = text.toLowerCase()
  if (/\b(inject|iv|dose|mg|ml|tablet|syrup|infus|drip|administer|prescri)\b/.test(t)) return 'medication'
  if (/\b(test|cbc|ecg|xray|x-ray|culture|urine|blood|lab|sample|report)\b/.test(t)) return 'test'
  if (/\b(instruct|position|turn|mobilize|restrict|diet|nil|npo|sponge|monitor)\b/.test(t)) return 'instruction'
  return 'observation'
}

// ── Quick-action inline forms ─────────────────────────────────────────────────
function AddMedicineForm({ onAdd, onCancel }: { onAdd: (m: { name: string; dosage: string; frequency: string }) => void; onCancel: () => void }) {
  const [f, setF] = useState({ name: '', dosage: '', frequency: '' })
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="bg-[rgba(14,116,144,0.07)]/70 rounded-xl p-4 space-y-3">
      <p className="text-xs font-bold text-[#0E7490] uppercase tracking-wide flex items-center gap-1.5"><Pill className="h-3.5 w-3.5" /> Add Medicine</p>
      <div className="grid grid-cols-3 gap-2">
        {[
          { key: 'name', placeholder: 'Medicine name' },
          { key: 'dosage', placeholder: 'Dosage (e.g. 500mg)' },
          { key: 'frequency', placeholder: 'Frequency (e.g. TDS)' },
        ].map(({ key, placeholder }) => (
          <input key={key} placeholder={placeholder} value={f[key as keyof typeof f]}
            onChange={e => setF(p => ({ ...p, [key]: e.target.value }))}
            className="h-9 px-3 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E97B2] shadow-sm" />
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 h-8 rounded-lg text-xs font-semibold text-slate-600 bg-white shadow-sm hover:bg-slate-50 cursor-pointer">Cancel</button>
        <button onClick={() => { if (f.name) { onAdd(f); onCancel() } }} disabled={!f.name}
          className="flex-1 h-8 rounded-lg text-xs font-bold text-white bg-[#0E7490] hover:bg-[#0B5A6E] disabled:opacity-50 cursor-pointer">
          Add Medicine
        </button>
      </div>
    </motion.div>
  )
}

function AddTestForm({ onAdd, onCancel }: { onAdd: (t: { name: string; urgency: 'Routine' | 'Urgent' }) => void; onCancel: () => void }) {
  const [f, setF] = useState({ name: '', urgency: 'Routine' as 'Routine' | 'Urgent' })
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="bg-amber-50/70 rounded-xl p-4 space-y-3">
      <p className="text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5"><FlaskConical className="h-3.5 w-3.5" /> Add Test Order</p>
      <div className="flex gap-2">
        <input placeholder="Test name (e.g. CBC, ECG, X-Ray)" value={f.name}
          onChange={e => setF(p => ({ ...p, name: e.target.value }))}
          className="flex-1 h-9 px-3 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-sm" />
        <Select value={f.urgency} onChange={e => setF(p => ({ ...p, urgency: e.target.value as any }))}
          className="h-9 px-3 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-sm">
          <option>Routine</option>
          <option>Urgent</option>
        </Select>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 h-8 rounded-lg text-xs font-semibold text-slate-600 bg-white shadow-sm hover:bg-slate-50 cursor-pointer">Cancel</button>
        <button onClick={() => { if (f.name) { onAdd(f); onCancel() } }} disabled={!f.name}
          className="flex-1 h-8 rounded-lg text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 cursor-pointer">
          Add Test
        </button>
      </div>
    </motion.div>
  )
}

function AddInstructionForm({ onAdd, onCancel }: { onAdd: (i: string) => void; onCancel: () => void }) {
  const [text, setText] = useState('')
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="bg-[rgba(14,116,144,0.07)]/70 rounded-xl p-4 space-y-3">
      <p className="text-xs font-bold text-[#0E7490] uppercase tracking-wide flex items-center gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Add Instruction</p>
      <textarea placeholder="Ward instruction for nursing staff..." value={text} onChange={e => setText(e.target.value)}
        className="w-full h-16 px-3 py-2 rounded-lg bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1E97B2] shadow-sm" />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 h-8 rounded-lg text-xs font-semibold text-slate-600 bg-white shadow-sm hover:bg-slate-50 cursor-pointer">Cancel</button>
        <button onClick={() => { if (text.trim()) { onAdd(text.trim()); onCancel() } }} disabled={!text.trim()}
          className="flex-1 h-8 rounded-lg text-xs font-bold text-white bg-[#0E7490] hover:bg-[#0B5A6E] disabled:opacity-50 cursor-pointer">
          Add Instruction
        </button>
      </div>
    </motion.div>
  )
}

// ── Notes Panel ───────────────────────────────────────────────────────────────
function NotesPanel({ patient }: { patient: PatientBed }) {
  const { addRoundsNote } = useWard()
  const [noteText, setNoteText] = useState('')
  const [aiCategory, setAiCategory] = useState<RoundsNote['category'] | null>(null)
  const [isAiThinking, setIsAiThinking] = useState(false)
  const [recording, setRecording] = useState(false)
  const [speechSupported] = useState(() => typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window))
  const recognitionRef = useRef<SpeechRecognitionType | null>(null)
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // quick-action state
  const [quickAction, setQuickAction] = useState<'medicine' | 'test' | 'instruction' | null>(null)
  const [pendingMedicines, setPendingMedicines] = useState<{ name: string; dosage: string; frequency: string }[]>([])
  const [pendingTests, setPendingTests] = useState<{ name: string; urgency: 'Routine' | 'Urgent' }[]>([])
  const [pendingInstructions, setPendingInstructions] = useState<string[]>([])

  const [showHistory, setShowHistory] = useState(false)

  // AI category inference with debounce
  useEffect(() => {
    if (!noteText.trim()) { setAiCategory(null); return }
    setIsAiThinking(true)
    if (aiTimer.current) clearTimeout(aiTimer.current)
    aiTimer.current = setTimeout(() => {
      setAiCategory(inferCategory(noteText))
      setIsAiThinking(false)
    }, 1800)
    return () => { if (aiTimer.current) clearTimeout(aiTimer.current) }
  }, [noteText])

  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-IN'
    rec.onresult = (event) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setNoteText(prev => prev + (prev ? ' ' : '') + transcript.trim())
    }
    rec.onerror = () => { setRecording(false) }
    rec.onend = () => { setRecording(false) }
    recognitionRef.current = rec
    rec.start()
    setRecording(true)
    toast('Listening... Speak clearly in English or Hindi')
  }, [])

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
    setRecording(false)
  }, [])

  const handleSave = () => {
    if (!noteText.trim() && pendingMedicines.length === 0 && pendingTests.length === 0 && pendingInstructions.length === 0) return
    const category = aiCategory ?? 'observation'
    addRoundsNote(patient.id, {
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      text: noteText.trim(),
      category,
      author: 'Nurse on Duty',
      medicines: pendingMedicines.length > 0 ? pendingMedicines : undefined,
      tests: pendingTests.length > 0 ? pendingTests : undefined,
      instructions: pendingInstructions.length > 0 ? pendingInstructions : undefined,
    })
    // Notify the doctor that rounds are complete + summarise what was added.
    const parts: string[] = []
    if (pendingMedicines.length) parts.push(`${pendingMedicines.length} med${pendingMedicines.length === 1 ? '' : 's'} added`)
    if (pendingTests.length) parts.push(`${pendingTests.length} test${pendingTests.length === 1 ? '' : 's'} requested`)
    if (pendingInstructions.length) parts.push(`${pendingInstructions.length} instruction${pendingInstructions.length === 1 ? '' : 's'} captured`)
    notifyAndAudit({
      to: 'doctor', type: 'system', priority: 'medium',
      title: `Rounds complete · ${patient.name}`,
      body: `Nurse rounds saved for ${patient.name} (${patient.bedNumber})${parts.length ? ' — ' + parts.join(', ') : ''}.`,
      patientName: patient.name,
      audit: { action: 'nurse_handover', resource: 'rounds_note', resourceId: patient.id, detail: `Rounds note saved for ${patient.name} (${category})`, userName: 'Nurse' },
    })
    setNoteText('')
    setAiCategory(null)
    setPendingMedicines([])
    setPendingTests([])
    setPendingInstructions([])
    toast.success('Rounds note saved · Doctor notified')
  }

  const catMeta = aiCategory ? CATEGORY_META[aiCategory] : null
  const [ward, bed] = patient.bedNumber.split(' - ')

  return (
    <div className="space-y-5">
      {/* Patient header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(14,116,144,0.07)]/80">
          <Bed className="h-4 w-4 text-[#0E7490]" />
          <span className="text-sm font-bold text-[#0E7490]">{ward}</span>
          <span className="text-slate-300">—</span>
          <span className="text-sm font-bold text-[#0E7490]">Bed {bed?.trim()}</span>
        </div>
        <span className="text-base font-bold text-slate-900">{patient.name}</span>
        <NeonBadge variant={patient.condition === 'Critical' ? 'danger' : patient.condition === 'Stable' ? 'success' : 'warning'}>
          {patient.condition}
        </NeonBadge>
      </div>

      {/* Voice + text area */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-700">Doctor Rounds Note</p>
          <div className="flex items-center gap-2">
            {isAiThinking && (
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#0E7490] bg-[rgba(14,116,144,0.07)]/80 px-2.5 py-1 rounded-full">
                <Sparkles className="h-3 w-3 animate-pulse" /> AI Categorizing...
              </span>
            )}
            {catMeta && !isAiThinking && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${catMeta.bg} ${catMeta.color}`}
              >
                <catMeta.icon className="h-3 w-3" /> {catMeta.label}
              </motion.span>
            )}
          </div>
        </div>

        <div className="relative">
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Type doctor's instructions, observations, or use voice recording..."
            className="w-full h-28 px-4 py-3 rounded-xl bg-slate-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1E97B2] text-slate-800 placeholder-slate-400"
          />
          {recording && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-50 text-red-600 text-[11px] font-bold px-2 py-1 rounded-full animate-pulse">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Recording
            </div>
          )}
        </div>

        {/* Voice button row */}
        <div className="flex items-center gap-3">
          {speechSupported ? (
            <button
              onClick={recording ? stopRecording : startRecording}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                recording
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {recording ? <><MicOff className="h-4 w-4" /> Stop Voice</> : <><Mic className="h-4 w-4" /> Voice Note</>}
            </button>
          ) : (
            <span className="text-xs text-slate-400 bg-slate-50 px-3 py-2 rounded-xl">Voice not supported in this browser</span>
          )}
          {/* M4-W2 — S5: AI-SOAP companion. Existing voice button appends raw
              transcript; this one structures into SOAP for the chart. */}
          <VoiceScribeButton
            surface="nurse_round"
            onAccept={(soap) => { setNoteText((t) => (t ? t + '\n\n' : '') + soap); toast.success('AI-SOAP appended to note') }}
            compact
          />
          <span className="flex-1" />
          <button
            onClick={handleSave}
            disabled={!noteText.trim() && pendingMedicines.length === 0 && pendingTests.length === 0 && pendingInstructions.length === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#0E7490] hover:bg-[#0B5A6E] text-white text-sm font-bold transition-colors cursor-pointer disabled:opacity-40 shadow-sm"
          >
            <Save className="h-4 w-4" /> Save Note
          </button>
        </div>

        {/* Quick actions */}
        <div className="pt-2 border-t border-slate-100">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-3">Quick Actions</p>
          <AnimatePresence mode="wait">
            {quickAction === 'medicine' && (
              <AddMedicineForm
                onAdd={m => setPendingMedicines(p => [...p, m])}
                onCancel={() => setQuickAction(null)}
              />
            )}
            {quickAction === 'test' && (
              <AddTestForm
                onAdd={t => setPendingTests(p => [...p, t])}
                onCancel={() => setQuickAction(null)}
              />
            )}
            {quickAction === 'instruction' && (
              <AddInstructionForm
                onAdd={i => setPendingInstructions(p => [...p, i])}
                onCancel={() => setQuickAction(null)}
              />
            )}
          </AnimatePresence>

          {!quickAction && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setQuickAction('medicine')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#0E7490] bg-[rgba(14,116,144,0.07)]/80 hover:bg-[rgba(14,116,144,0.14)] cursor-pointer transition-colors">
                <Plus className="h-3.5 w-3.5" /> Medicine
              </button>
              <button onClick={() => setQuickAction('test')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50/80 hover:bg-amber-100 cursor-pointer transition-colors">
                <Plus className="h-3.5 w-3.5" /> Test
              </button>
              <button onClick={() => setQuickAction('instruction')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#0E7490] bg-[rgba(14,116,144,0.07)]/80 hover:bg-[rgba(14,116,144,0.14)] cursor-pointer transition-colors">
                <Plus className="h-3.5 w-3.5" /> Instruction
              </button>
            </div>
          )}

          {/* Pending items preview */}
          {(pendingMedicines.length > 0 || pendingTests.length > 0 || pendingInstructions.length > 0) && (
            <div className="mt-3 space-y-2">
              {pendingMedicines.map((m, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[rgba(14,116,144,0.07)]/70 text-xs">
                  <span className="font-bold text-[#0E7490]"><Pill className="h-3 w-3 inline mr-1" />{m.name} {m.dosage} — {m.frequency}</span>
                  <button onClick={() => setPendingMedicines(p => p.filter((_, j) => j !== i))} className="text-[#1E97B2] hover:text-red-500 cursor-pointer"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {pendingTests.map((t, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50/70 text-xs">
                  <span className="font-bold text-amber-700"><FlaskConical className="h-3 w-3 inline mr-1" />{t.name} — {t.urgency}</span>
                  <button onClick={() => setPendingTests(p => p.filter((_, j) => j !== i))} className="text-amber-400 hover:text-red-500 cursor-pointer"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {pendingInstructions.map((inst, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[rgba(14,116,144,0.07)]/70 text-xs">
                  <span className="font-bold text-[#0E7490]"><ClipboardList className="h-3 w-3 inline mr-1" />{inst}</span>
                  <button onClick={() => setPendingInstructions(p => p.filter((_, j) => j !== i))} className="text-[#1E97B2] hover:text-red-500 cursor-pointer"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* M9-B — NABH clinical-note modules: wound care, fall risk, care plan */}
      <ClinicalNotesCard patientId={patient.id} patientName={patient.name} />

      {/* Rounds History */}
      <div>
        <button
          onClick={() => setShowHistory(h => !h)}
          className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 cursor-pointer mb-3 transition-colors"
        >
          {showHistory ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Rounds History ({patient.rounds?.length ?? 0})
        </button>

        <AnimatePresence>
          {showHistory && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {!patient.rounds?.length ? (
                <p className="text-sm text-slate-400 pl-4 py-3">No rounds notes yet for this patient.</p>
              ) : (
                [...(patient.rounds ?? [])].reverse().map(note => {
                  const meta = CATEGORY_META[note.category]
                  return (
                    <div key={note.id} className={`rounded-xl p-4 ${meta.bg}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <meta.icon className={`h-4 w-4 ${meta.color}`} />
                          <NeonBadge variant={meta.badge}>{meta.label}</NeonBadge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Clock className="h-3 w-3" /> {note.timestamp}
                          <span>· {note.author}</span>
                        </div>
                      </div>
                      {note.text && <p className="text-sm text-slate-800 font-medium">{note.text}</p>}
                      {note.medicines?.map((m, i) => (
                        <p key={i} className="text-xs font-bold text-[#0E7490] mt-1"><Pill className="h-3 w-3 inline mr-1" />{m.name} {m.dosage} — {m.frequency}</p>
                      ))}
                      {note.tests?.map((t, i) => (
                        <p key={i} className="text-xs font-bold text-amber-700 mt-1"><FlaskConical className="h-3 w-3 inline mr-1" />{t.name} ({t.urgency})</p>
                      ))}
                      {note.instructions?.map((inst, i) => (
                        <p key={i} className="text-xs font-bold text-[#0E7490] mt-1"><ClipboardList className="h-3 w-3 inline mr-1" />{inst}</p>
                      ))}
                    </div>
                  )
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Patient list item ─────────────────────────────────────────────────────────
function PatientListItem({ patient, selected, onClick }: {
  patient: PatientBed
  selected: boolean
  onClick: () => void
}) {
  const [ward, bed] = patient.bedNumber.split(' - ')
  const roundsCount = patient.rounds?.length ?? 0
  const lastRound = patient.rounds?.at(-1)

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl transition-all cursor-pointer ${
        selected
          ? 'bg-[rgba(14,116,144,0.07)]/80 shadow-sm'
          : 'bg-white hover:bg-slate-50 shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-bold text-slate-900 text-sm">{patient.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${
              selected ? 'bg-[rgba(14,116,144,0.12)] text-[#0E7490]' : 'bg-slate-100 text-slate-600'
            }`}>
              <Bed className="h-3 w-3" /> {ward} · Bed {bed?.trim()}
            </div>
          </div>
        </div>
        <NeonBadge variant={patient.condition === 'Critical' ? 'danger' : patient.condition === 'Stable' ? 'success' : 'warning'} className="flex-shrink-0">
          {patient.condition}
        </NeonBadge>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {roundsCount} note{roundsCount !== 1 ? 's' : ''}</span>
        {lastRound ? (
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Last: {lastRound.timestamp}</span>
        ) : (
          <span className="text-amber-500 font-medium">Rounds pending</span>
        )}
      </div>
      {patient.aiAlert && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-red-600 bg-red-50/80 px-2 py-1 rounded-lg">
          <AlertCircle className="h-3 w-3" /> {patient.aiAlert}
        </div>
      )}
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NurseRoundsPage() {
  const { patients } = useWard()
  const [selectedId, setSelectedId] = useState<string | null>(patients[0]?.id ?? null)
  const [search, setSearch] = useState('')

  const filteredPatients = search.trim()
    ? patients.filter(p =>
        p.bedNumber.toLowerCase().includes(search.toLowerCase()) ||
        p.name.toLowerCase().includes(search.toLowerCase())
      )
    : patients

  // Auto-select when search narrows to a single patient
  useEffect(() => {
    if (filteredPatients.length === 1 && search.trim()) {
      setSelectedId(filteredPatients[0].id)
    }
  }, [filteredPatients.length, search])

  const selectedPatient = patients.find(p => p.id === selectedId)

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Doctor Rounds</h1>
          <p className="text-sm text-slate-500 mt-1">
            Search by bed number or patient name to start adding rounds notes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NeonBadge variant="blue" dot pulse>
            <Stethoscope className="h-3 w-3" /> {patients.length} patients
          </NeonBadge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Patient list with bed search */}
        <div className="lg:col-span-4 space-y-3">
          {/* Bed number search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search bed no. or patient name..."
              className="w-full h-10 pl-9 pr-9 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E97B2] shadow-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Result count when filtering */}
          {search.trim() && (
            <p className="text-xs font-semibold text-slate-400 px-1">
              {filteredPatients.length === 0
                ? 'No patients found'
                : `${filteredPatients.length} result${filteredPatients.length !== 1 ? 's' : ''} for "${search}"`}
            </p>
          )}

          {!search.trim() && (
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">Ward Patients</p>
          )}

          <div className="space-y-2">
            <AnimatePresence>
              {filteredPatients.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-10 flex flex-col items-center gap-3 text-slate-400"
                >
                  <Bed className="h-8 w-8 opacity-30" />
                  <p className="text-sm font-medium">No beds match "{search}"</p>
                </motion.div>
              ) : (
                filteredPatients.map(p => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    <PatientListItem
                      patient={p}
                      selected={p.id === selectedId}
                      onClick={() => setSelectedId(p.id)}
                    />
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Notes panel */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {selectedPatient ? (
              <motion.div
                key={selectedPatient.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
              >
                <NotesPanel patient={selectedPatient} />
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Bed className="h-10 w-10 mb-3 opacity-30" />
                <p className="font-semibold">Search a bed number to begin rounds</p>
                <p className="text-sm mt-1 opacity-60">e.g. "Ward A", "Bed 01", or patient name</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
