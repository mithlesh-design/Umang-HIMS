"use client"

import { useState } from "react"
import { usePatientStore, type Patient } from "@/store/usePatientStore"
import { usePatientProfileStore, type PatientProfile } from "@/store/usePatientProfileStore"
import { VitalsForm } from "@/components/nurse/VitalsForm"
import { FirstVisitWizard } from "@/components/nurse/FirstVisitWizard"
import { news2FromRecord } from "@/lib/vitals"
import { Card } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { HeartPulse, Clock, Stethoscope, AlertTriangle, Sparkles, CheckCircle2, UserPlus } from "lucide-react"
import { toast } from "sonner"

const NURSE = "Anjali Desai"

const TRIAGE_RANK: Record<string, number> = { Critical: 3, High: 2, Medium: 1, Low: 0 }
const triageStyle = (t?: string) =>
  t === "Critical" ? "bg-red-100 text-red-700 border-red-200"
    : t === "High" ? "bg-orange-100 text-orange-700 border-orange-200"
      : t === "Medium" ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-slate-100 text-slate-600 border-slate-200"

export default function VitalsRequestsPage() {
  const patients = usePatientStore(s => s.patients)
  const recordOpdVitals = usePatientStore(s => s.recordOpdVitals)
  const profiles = usePatientProfileStore(s => s.profiles)
  const saveProfile = usePatientProfileStore(s => s.saveProfile)
  const [editing, setEditing] = useState<Patient | null>(null)
  const profileDone = (id: string) => !!profiles[id]?.completedAt

  // Queue = patients reception sent for vitals, auto-prioritised by acuity then arrival order.
  const queue = patients
    .filter(p => p.queueStatus === "vitals")
    .sort((a, b) => (TRIAGE_RANK[b.triageLevel ?? "Low"] - TRIAGE_RANK[a.triageLevel ?? "Low"]) || (a.token - b.token))

  const advanceToast = (p: Patient, rec: Parameters<typeof recordOpdVitals>[1]) => {
    const news = news2FromRecord(rec)
    if (news.band === "high") toast.error(`${p.name} → doctor's queue · NEWS ${news.score} — fast-track, high acuity`)
    else if (news.band === "medium") toast.warning(`${p.name} → doctor's queue · NEWS ${news.score} — prioritise review`)
    else toast.success(`${p.name} → doctor's queue · NEWS ${news.score} — routine`)
  }

  // Returning patient: just record vitals.
  const handleSave = (p: Patient, rec: Parameters<typeof recordOpdVitals>[1]) => {
    recordOpdVitals(p.id, rec)
    advanceToast(p, rec)
  }

  // First visit: save the completed profile, then record vitals (advances to consulting).
  const handleComplete = (p: Patient, data: { profile: PatientProfile; vitals: Parameters<typeof recordOpdVitals>[1] }) => {
    saveProfile(p.id, data.profile, NURSE)
    recordOpdVitals(p.id, data.vitals)
    toast.success(`Profile completed for ${p.name}`)
    advanceToast(p, data.vitals)
  }

  const wizardInitial = (p: Patient): Partial<PatientProfile> => ({
    payerType: p.insurer ? "Insurance" : undefined, insurer: p.insurer,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Vitals Requests</h1>
          <p className="text-sm text-[#64748B] mt-1">OPD patients sent by reception for vitals before consultation</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#0E7490] bg-[rgba(14,116,144,0.07)] border border-[rgba(14,116,144,0.15)] rounded-full px-3 py-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Auto-prioritised by acuity · {queue.length} waiting
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <CheckCircle2 className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-base font-semibold">No vitals requests</p>
          <p className="text-sm mt-1">When reception sends a patient for vitals, they appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-12 w-12 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0 font-bold text-sm text-green-700">
                      #{p.token}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-[#0F172A]">{p.name}</h3>
                        <span className="text-xs text-slate-400">{p.age}y · {p.gender}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${triageStyle(p.triageLevel)}`}>
                          {p.triageLevel ?? "Low"} acuity
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1"><Stethoscope className="h-3 w-3" /> {p.doctor}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {p.registeredAt}</span>
                        <span>{p.department}</span>
                      </p>
                      {p.symptoms.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                          {p.symptoms.map((s, j) => (
                            <span key={j} className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setEditing(p)}
                    className="flex items-center gap-1.5 text-sm font-bold text-white px-4 py-2 rounded-xl cursor-pointer transition-all flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#16A34A,#0B5A6E)", boxShadow: "0 2px 8px rgba(22,163,74,0.25)" }}
                  >
                    {profileDone(p.id) ? <><HeartPulse className="h-4 w-4" /> Record Vitals</> : <><UserPlus className="h-4 w-4" /> Complete profile &amp; vitals</>}
                  </button>
                </div>
                {p.triageLevel === "Critical" || p.triageLevel === "High" ? (
                  <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-orange-600">
                    <AlertTriangle className="h-3.5 w-3.5" /> Higher acuity — prioritise this patient
                  </div>
                ) : null}
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {editing && (profileDone(editing.id) ? (
          <VitalsForm
            title={editing.name}
            subtitle={`Token ${editing.token} · ${editing.department}`}
            priorRecords={editing.opdVitals ? [editing.opdVitals] : []}
            onClose={() => setEditing(null)}
            onSave={(rec) => handleSave(editing, rec)}
          />
        ) : (
          <FirstVisitWizard
            title={editing.name}
            subtitle={`Token ${editing.token} · ${editing.department}`}
            meta={{ age: editing.age, gender: editing.gender }}
            initial={wizardInitial(editing)}
            onClose={() => setEditing(null)}
            onComplete={(data) => handleComplete(editing, data)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
