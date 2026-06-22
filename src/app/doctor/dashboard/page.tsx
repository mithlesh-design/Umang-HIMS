"use client"
import { Select } from "@/components/ui/Select"
import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Activity, CheckCircle2, Stethoscope, Mic, MicOff, Pill, Plus, X, Search,
  AlertCircle, Sparkles, Clock, Send, FileText, FlaskConical, ScanLine,
  UserPlus, ArrowRight, GitBranch, Bed, ChevronDown, ChevronUp, Bot,
  Video, PhoneOff,
} from "lucide-react"
import { usePatientStore } from "@/store/usePatientStore"
import { useAuthStore } from "@/store/useAuthStore"
import { useConsultationStore } from "@/store/useConsultationStore"
import { useDoctorStatsStore } from "@/store/useDoctorStatsStore"
import { usePharmacyStore } from "@/store/usePharmacyStore"
import { DoctorStockAlerts } from "@/components/pharmacy/DoctorStockAlerts"
import { useLabStore } from "@/store/useLabStore"
import { useLabOrdersStore } from "@/store/useLabOrdersStore"
import { LAB_CATALOG } from "@/lib/labCatalog"
import { useRadiologyStore } from "@/store/useRadiologyStore"
import { useAdmissionStore } from "@/store/useAdmissionStore"
import { NeonBadge } from "@/components/ui/neon-badge"
import { AiPreBrief } from "@/components/features/AiPreBrief"
import { PatientProfileSummary } from "@/components/PatientProfileSummary"
import { Avatar } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { OrderSetPicker } from "@/components/doctor/OrderSetPicker"
import { materializeOrderSet, type OrderSetDef } from "@/lib/clinicalOrderSets"
import type { Patient } from "@/store/usePatientStore"
import { toast } from "sonner"
import { isSpeechSupported, startDictation, toSOAP, type Recognition } from "@/lib/voiceScribe"
import { openPrint, olFrom, para } from "@/lib/printDoc"
import { useDoctorProfileStore } from "@/store/useDoctorProfileStore"
import { useHRStore } from "@/store/useHRStore"
import { useDialogs } from "@/components/ui/ConfirmDialog"

const DRUGS = ["Paracetamol 500mg","Amoxicillin 500mg","Azithromycin 500mg","Cetirizine 10mg","Pantoprazole 40mg","Dolo 650mg","Metformin 500mg","Amlodipine 5mg","Atorvastatin 20mg","Omeprazole 20mg","Ibuprofen 400mg","Montelukast 10mg","Metronidazole 400mg","Ondansetron 4mg","Diclofenac 50mg"]
// Lab tests come straight from the central catalog so every doctor-selected
// name round-trips to a valid TestRun (no silent fallbacks at the shim).
const LAB_TESTS = Object.values(LAB_CATALOG).map(e => e.name)
const SPECIALTIES = ["Cardiology","Neurology","Orthopaedics","Gastroenterology","Pulmonology","Nephrology","Oncology","Endocrinology","Dermatology","Psychiatry","ENT","Ophthalmology","Urology","Internal Medicine"]
const BODY_PARTS = ["Chest","Abdomen","Head","Neck","Spine (Lumbar)","Spine (Cervical)","Knee","Shoulder","Hip","Pelvis","Wrist","Ankle","Whole Abdomen"]

const TRIAGE_GRADIENTS: Record<string, { gradient: string; shadow: string }> = {
  Critical: { gradient: 'linear-gradient(135deg,#EF4444,#DC2626)', shadow: 'rgba(239,68,68,0.35)' },
  High:     { gradient: 'linear-gradient(135deg,#F97316,#EA580C)', shadow: 'rgba(249,115,22,0.30)' },
  Medium:   { gradient: 'linear-gradient(135deg,#F59E0B,#D97706)', shadow: 'rgba(245,158,11,0.25)' },
  Low:      { gradient: 'linear-gradient(135deg,#10B981,#0B5A6E)', shadow: 'rgba(16,185,129,0.20)' },
}

const ORDER_STYLES: Record<string, { gradient: string; glow: string; light: string; text: string }> = {
  lab:       { gradient: 'linear-gradient(135deg,#0E7490,#0B5A6E)', glow: 'rgba(14,116,144,0.25)', light: 'rgba(14,116,144,0.07)', text: '#0B5A6E' },
  radiology: { gradient: 'linear-gradient(135deg,#0E7490,#0B5A6E)', glow: 'rgba(14,116,144,0.25)', light: 'rgba(14,116,144,0.06)', text: '#0E7490' },
  referral:  { gradient: 'linear-gradient(135deg,#0B5A6E,#0E7490)', glow: 'rgba(14,116,144,0.25)', light: 'rgba(14,116,144,0.05)', text: '#0B5A6E' },
  admission: { gradient: 'linear-gradient(135deg,#EF4444,#DC2626)', glow: 'rgba(239,68,68,0.25)', light: '#FEF2F2', text: '#DC2626' },
}

function QueueEntry({ patient, selected, onClick, delay }: { patient: Patient; selected: boolean; onClick: () => void; delay: number }) {
  const triage = patient.triageLevel ?? "Low"
  const tg = TRIAGE_GRADIENTS[triage] ?? TRIAGE_GRADIENTS.Low
  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className="w-full text-left p-3 rounded-2xl transition-all duration-200 cursor-pointer flex items-center gap-3"
      style={selected ? {
        background: 'linear-gradient(135deg, rgba(14,116,144,0.08), rgba(14,116,144,0.04))',
        boxShadow: '0 0 0 1.5px rgba(14,116,144,0.30), 0 4px 16px rgba(14,116,144,0.10)',
      } : {
        background: 'white',
        boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
      }}
    >
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black text-white"
        style={{ background: tg.gradient, boxShadow: `0 3px 8px ${tg.shadow}` }}
      >
        #{patient.token}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate" style={{ color: selected ? '#0E7490' : '#0F172A' }}>{patient.name}</p>
        <p className="text-xs font-medium truncate mt-0.5" style={{ color: '#94A3B8' }}>{patient.age}y · {patient.symptoms[0] ?? "No symptoms"}</p>
      </div>
      <div
        className="px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
        style={{
          background: patient.queueStatus === 'consulting' ? 'rgba(14,116,144,0.12)' : patient.queueStatus === 'vitals' ? 'rgba(245,158,11,0.12)' : '#F8FAFC',
          color: patient.queueStatus === 'consulting' ? '#0B5A6E' : patient.queueStatus === 'vitals' ? '#D97706' : '#94A3B8',
        }}
      >
        {patient.queueStatus}
      </div>
    </motion.button>
  )
}

function OrderPanel({ title, icon: Icon, styleKey, children, defaultOpen = false }: {
  title: string; icon: React.ElementType; styleKey: keyof typeof ORDER_STYLES; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const style = ORDER_STYLES[styleKey]
  return (
    <div className="overflow-hidden rounded-2xl" style={{ background: 'white', boxShadow: '0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 transition-colors cursor-pointer"
        style={{ background: open ? `${style.light}` : 'white' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-xl flex items-center justify-center"
            style={{ background: style.gradient, boxShadow: `0 3px 8px ${style.glow}` }}
          >
            <Icon className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-sm" style={{ color: open ? style.text : '#0F172A' }}>{title}</span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4" style={{ color: '#94A3B8' }} />
          : <ChevronDown className="h-4 w-4" style={{ color: '#94A3B8' }} />
        }
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0" style={{ borderTop: '1px solid rgba(15,23,42,0.05)' }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// One-line AI crux of a patient's background, so the doctor gets the gist first.
function historyBrief(p: Patient): string {
  const chronic = p.history.filter(x => /diabet|hypertens|asthma|ckd|cardiac|copd|thyroid|arthrit|migrain|epileps/i.test(x))
  if (chronic.length) return `${chronic.length} chronic condition${chronic.length > 1 ? 's' : ''} (${chronic.join(', ')}) — review control, adherence & complications.`
  if (p.history.length === 0 || p.history.some(h => /no significant/i.test(h))) return 'No significant past medical history — treat as an acute presentation.'
  return `Background: ${p.history.join(', ')}.`
}

export default function DoctorDashboard() {
  const { patients, updateStatus, visits, addVisit } = usePatientStore()
  const currentUser = useAuthStore(s => s.currentUser)
  const {
    currentPatient, setCurrentPatient, notes, setNotes, diagnosis, setDiagnosis,
    aiSuggestions, acceptAISuggestion, prescriptions, addPrescription, removePrescription,
    isDictating, toggleDictation, isPharmacySent, sendToPharmacy,
    labOrders, addLabOrder, removeLabOrder, markLabOrderSent,
    radiologyOrders, addRadiologyOrder, removeRadiologyOrder, markRadiologyOrderSent,
    referrals, addReferral, removeReferral,
    admissionOrder, setAdmissionOrder, markAdmissionSent, resetConsultation,
    isOnlineConsult, endOnlineCall,
  } = useConsultationStore()
  const recordStat = useDoctorStatsStore(s => s.record)
  const doctorId = currentUser?.id ?? 'DR-1012'
  const { addPrescription: addToPharmacy } = usePharmacyStore()
  const { addOrderFromDoctor: addLabToStore } = useLabStore()
  const addLabRichOrder = useLabOrdersStore(s => s.addOrder)
  const { addOrderFromDoctor: addRadToStore } = useRadiologyStore()
  const { requestAdmission, beds } = useAdmissionStore()

  const [medSearch, setMedSearch] = useState("")
  const { confirm, view: dialogView } = useDialogs()
  const [showDrugs, setShowDrugs] = useState(false)
  const [dosage, setDosage] = useState("1-0-1")
  const [duration, setDuration] = useState("5 days")
  const [frequency, setFrequency] = useState("TDS")
  const [qty, setQty] = useState("10")
  const [noteSaved, setNoteSaved] = useState(false)
  const [labTest, setLabTest] = useState("")
  const [labPriority, setLabPriority] = useState<'Routine' | 'Urgent'>("Routine")
  const [radScanType, setRadScanType] = useState<'X-Ray' | 'MRI' | 'CT Scan' | 'Ultrasound'>("X-Ray")
  const [radBodyPart, setRadBodyPart] = useState("")
  const [radPriority, setRadPriority] = useState<'Routine' | 'Urgent'>("Routine")
  const [refSpecialty, setRefSpecialty] = useState("")
  const [refNotes, setRefNotes] = useState("")
  const [refUrgent, setRefUrgent] = useState(false)
  const [admType, setAdmType] = useState<'General Ward' | 'ICU' | 'Private Room' | 'Semi-Private' | 'Day Care'>("General Ward")
  const [admReason, setAdmReason] = useState("")
  const [showAdmModal, setShowAdmModal] = useState(false)
  const [admAllergies, setAdmAllergies] = useState("")
  const [admComorbidities, setAdmComorbidities] = useState("")
  const [admSpecialInstructions, setAdmSpecialInstructions] = useState("")
  const [admUrgency, setAdmUrgency] = useState<'Routine' | 'Urgent' | 'Emergency'>("Urgent")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [showRxDrawer, setShowRxDrawer] = useState(false)

  const patientVisits = currentPatient ? visits.filter(v => v.patientId === currentPatient.id).sort((a, b) => b.date.localeCompare(a.date)) : []

  // Ambient voice scribe.
  const [speechOk, setSpeechOk] = useState(false)
  const recognitionRef = useRef<Recognition | null>(null)
  useEffect(() => { setSpeechOk(isSpeechSupported()) }, [])
  const handleDictate = () => {
    if (isDictating) { recognitionRef.current?.stop(); recognitionRef.current = null; toggleDictation(); return }
    if (!speechOk) { toast.error('Voice input not supported in this browser'); return }
    const rec = startDictation(
      (chunk) => { const cur = useConsultationStore.getState().notes; setNotes((cur ? cur + ' ' : '') + chunk) },
      () => { recognitionRef.current = null },
    )
    if (!rec) { toast.error('Could not start voice input'); return }
    recognitionRef.current = rec
    toggleDictation()
  }
  const profile = useDoctorProfileStore()
  const signature = profile.signature
  const consultFee = isOnlineConsult ? profile.onlineFee : profile.opdFee
  const printRx = () => {
    if (!currentPatient || prescriptions.length === 0) return
    const body = (diagnosis ? para('Provisional diagnosis', diagnosis) : '')
      + para('Medications', '')
      + olFrom(prescriptions.map(p => `${p.medicine} — ${p.dosage} · ${p.duration}${p.instructions ? ` · ${p.instructions}` : ''}`))
    openPrint({ kind: 'Prescription', patient: currentPatient.name, patientMeta: `${currentPatient.id} · ${currentPatient.age}y / ${currentPatient.gender}`, doctor: currentPatient.doctor, signature, bodyHtml: body })
  }
  const structureNote = () => {
    if (!notes.trim()) { toast.error('Add or dictate some notes first'); return }
    const v = currentPatient?.vitals ? `BP ${currentPatient.vitals.bp}, Pulse ${currentPatient.vitals.pulse}, Temp ${currentPatient.vitals.temp}, SpO₂ ${currentPatient.vitals.spo2}` : undefined
    setNotes(toSOAP(notes, { diagnosis, vitals: v }))
    toast.success('Note structured into SOAP')
  }

  // Live bed availability for the ward type selected in the admission modal.
  const wardFree = beds.filter(b => b.ward === admType && b.status === 'Available').length
  const wardTotal = beds.filter(b => b.ward === admType).length

  useEffect(() => {
    if (!notes) return
    setNoteSaved(false)
    const t = setTimeout(() => setNoteSaved(true), 800)
    return () => clearTimeout(t)
  }, [notes])
  useEffect(() => {
    if (!noteSaved) return
    const t = setTimeout(() => setNoteSaved(false), 2500)
    return () => clearTimeout(t)
  }, [noteSaved])

  // This doctor's patients only (today's OPD list assigned to them).
  const mine     = patients.filter(p => p.doctor === currentUser?.name)
  const queue    = mine.filter(p => ["waiting","vitals","consulting"].includes(p.queueStatus))
  const seen     = mine.filter(p => ["pharmacy","billing","done"].includes(p.queueStatus)).length
  const filtered = DRUGS.filter(d => d.toLowerCase().includes(medSearch.toLowerCase()) && medSearch.length > 0)

  // Open a patient → mark them in consultation (handoff signal to reception/queue).
  // M2 — When on leave or OPD-paused, confirm the override before opening.
  // Phase 4 / M4.1 — Also check the HR roster: if the doctor is Off today, warn.
  const openPatient = async (p: Patient) => {
    const { onLeave: ol, availableForOPD: aop } = useDoctorProfileStore.getState()
    if (ol || !aop) {
      const ok = await confirm({
        title: ol ? "You're marked on leave" : "You're not currently accepting OPD",
        body: "Starting the consultation anyway will be audit-logged.",
        tone: 'warn',
        confirmLabel: 'Start anyway',
      })
      if (!ok) return
    }
    const me = useAuthStore.getState().currentUser
    if (me) {
      const today = new Date().toISOString().split('T')[0]!
      const myShift = useHRStore.getState().getShift(me.id, today)
      if (myShift === 'Off') {
        const ok = await confirm({
          title: "Off-shift consultation",
          body: "Per the HR roster you're Off today. Starting the consultation anyway will be audit-logged.",
          tone: 'warn',
          confirmLabel: 'Start anyway',
        })
        if (!ok) return
      }
    }
    setCurrentPatient(p)
    if (p.queueStatus !== 'consulting') updateStatus(p.id, 'consulting')
  }

  // End the consultation → advance the patient down the journey and clear the workspace.
  const completeConsult = () => {
    if (!currentPatient) return
    recordStat(doctorId, isOnlineConsult ? 'online' : 'opd')
    // Close the loop: write a visit into the patient's history.
    addVisit({
      patientId: currentPatient.id,
      date: new Date().toISOString().slice(0, 10),
      doctor: currentPatient.doctor,
      diagnosis: diagnosis.trim() || (isOnlineConsult ? 'Teleconsultation' : 'OPD consultation'),
      notes: notes.trim() || `${isOnlineConsult ? 'Online' : 'In-person'} consultation completed${diagnosis.trim() ? '' : '; no specific diagnosis recorded'}.`,
      prescriptions: prescriptions.map(p => ({ medicine: p.medicine, dosage: p.dosage, duration: p.duration })),
      fee: consultFee,
      mode: isOnlineConsult ? 'online' : 'in_person',
    })
    if (isOnlineConsult) {
      toast.success(`Online consultation complete — ${currentPatient.name}`)
    } else if (admissionOrder && !admissionOrder.sent) {
      // Track A auto-stage — a staged admission (e.g. from an order set) routes
      // straight to the bed manager on consult completion, carrying the orders
      // bundle, instead of needing a separate "Send Admission" click.
      requestAdmission({
        patientId: currentPatient.id,
        patientName: currentPatient.name,
        patientAge: currentPatient.age,
        patientGender: currentPatient.gender,
        diagnosis: diagnosis.trim() || admissionOrder.reason,
        admissionType: admissionOrder.admissionType,
        bedTypePreference: admissionOrder.bedTypePreference,
        reason: admissionOrder.reason,
        requestedBy: currentPatient.doctor,
        department: currentPatient.department,
        triageLevel: currentPatient.triageLevel,
        payerType: 'General',
        bundle: {
          prescriptions: prescriptions.map(p => ({ medicine: p.medicine, dosage: p.dosage, duration: p.duration, instructions: p.instructions })),
          labOrders: labOrders.map(o => ({ testName: o.testName, priority: o.priority })),
          radiologyOrders: radiologyOrders.map(o => ({ scanType: o.scanType, bodyPart: o.bodyPart, priority: o.priority })),
          allergies: admAllergies,
          comorbidities: admComorbidities,
          specialInstructions: admSpecialInstructions,
          urgency: admUrgency,
        },
      })
      markAdmissionSent()
      updateStatus(currentPatient.id, 'done')
      toast.success(`Consultation complete — ${currentPatient.name} → Admission requested (${admissionOrder.admissionType})`)
    } else {
      const next = (isPharmacySent || prescriptions.length > 0) ? 'pharmacy' : 'billing'
      updateStatus(currentPatient.id, next)
      toast.success(`Consultation complete — ${currentPatient.name} → ${next === 'pharmacy' ? 'Pharmacy' : 'Billing'}`)
    }
    resetConsultation()
  }

  const addMed = (name: string) => {
    if (!name.trim()) return
    addPrescription({ id: Math.random().toString(36), medicine: name, dosage, duration, instructions: frequency })
    setMedSearch("")
    setShowDrugs(false)
  }

  // Track A — apply a protocol bundle in one tap. Stages into the local
  // consultation workspace AND immediately dispatches lab/imaging to the
  // respective queues so they appear on the Lab and Radiology dashboards.
  const applyOrderSet = (def: OrderSetDef) => {
    if (!currentPatient) { toast.error("Select a patient first"); return }
    const m = materializeOrderSet(def)
    if (!diagnosis.trim()) setDiagnosis(m.diagnosis)
    m.prescriptions.forEach((p, i) => addPrescription({ id: `RX-${Date.now()}-${i}`, ...p }))
    m.labs.forEach(l => dispatchLabOrder(l.testName, l.priority ?? 'Routine'))
    m.imaging.forEach(im => dispatchRadOrder(im.scanType, im.bodyPart ?? '', im.priority ?? 'Routine'))
    if (m.admission) setAdmissionOrder(m.admission)
    const summary = [
      m.labs.length && `${m.labs.length} lab`,
      m.imaging.length && `${m.imaging.length} imaging`,
      m.prescriptions.length && `${m.prescriptions.length} Rx`,
      m.admission && 'admission',
    ].filter(Boolean).join(' · ')
    toast.success(`${def.label} applied`, { description: `${summary} dispatched to queues.` })
  }

  const sendRx = () => {
    if (!currentPatient || prescriptions.length === 0) return
    addToPharmacy({
      id: `RX-${Date.now()}`,
      patientId: currentPatient.id,
      patientName: currentPatient.name,
      tokenNumber: currentPatient.token,
      doctorName: currentPatient.doctor,
      department: currentPatient.department,
      status: "queued",
      dispatchedAt: new Date().toISOString(),
      estimatedReadyIn: prescriptions.length * 3,
      triageLevel: currentPatient.triageLevel,
      medicines: prescriptions.map(p => ({ name: p.medicine, dosage: p.dosage, frequency: p.instructions ?? "As directed", duration: p.duration, quantity: parseInt(qty) || 10 })),
    })
    sendToPharmacy()
    recordStat(doctorId, 'prescriptions', prescriptions.length)
    toast.success("Prescription sent to Pharmacy")
  }

  // Dispatches a single lab test immediately to the lab queue AND stages it in the
  // consultation store (marked sent to prevent double-dispatch via any legacy path).
  const dispatchLabOrder = (testName: string, priority: 'Routine' | 'Urgent') => {
    if (!currentPatient) { toast.error("Select a patient from the queue first"); return }
    addLabOrder({ testName, priority })
    // Zustand mutations are synchronous — getState() reflects the change immediately.
    const newId = useConsultationStore.getState().labOrders.slice(-1)[0]?.id
    if (newId) markLabOrderSent(newId)
    const code = Object.values(LAB_CATALOG).find(e => e.name === testName || e.code === testName)?.code
    if (code) {
      addLabRichOrder({
        patientId: currentPatient.id,
        patientName: currentPatient.name,
        source: 'OPD',
        doctorName: currentPatient.doctor,
        paymentMode: 'Cash',
        testCodes: [code],
      })
    } else {
      addLabToStore({ patientName: currentPatient.name, patientId: currentPatient.id, testName, priority, orderedBy: currentPatient.doctor })
    }
    recordStat(doctorId, 'tests', 1)
    toast.success(`${testName} → Lab queue`)
  }

  // Same pattern for radiology.
  const dispatchRadOrder = (scanType: typeof radScanType, bodyPart: string, priority: 'Routine' | 'Urgent') => {
    if (!currentPatient) { toast.error("Select a patient from the queue first"); return }
    addRadiologyOrder({ scanType, bodyPart, priority })
    const newId = useConsultationStore.getState().radiologyOrders.slice(-1)[0]?.id
    if (newId) markRadiologyOrderSent(newId)
    addRadToStore({ patientName: currentPatient.name, patientId: currentPatient.id, scanType, bodyPart, priority, orderedBy: currentPatient.doctor })
    recordStat(doctorId, 'tests', 1)
    toast.success(`${scanType} — ${bodyPart} → Radiology queue`)
  }

  const handleSendLabOrders = () => {
    // Legacy manual-send path — kept for order-set staging (applyOrderSet) where the
    // doctor may still want to review before dispatching.  Individual "+" adds now
    // call dispatchLabOrder and are already marked sent, so this only picks up the
    // rare un-sent remainder.
    const unsent = labOrders.filter(o => !o.sentToLab)
    if (!currentPatient || unsent.length === 0) return
    const codes = unsent
      .map(o => Object.values(LAB_CATALOG).find(e => e.name === o.testName || e.code === o.testName)?.code)
      .filter((c): c is string => !!c)
    if (codes.length > 0) {
      addLabRichOrder({
        patientId: currentPatient.id,
        patientName: currentPatient.name,
        source: 'OPD',
        doctorName: currentPatient.doctor,
        paymentMode: 'Cash',
        testCodes: codes,
      })
    }
    unsent.forEach(order => {
      if (!Object.values(LAB_CATALOG).find(e => e.name === order.testName || e.code === order.testName)) {
        addLabToStore({ patientName: currentPatient.name, patientId: currentPatient.id, testName: order.testName, priority: order.priority, orderedBy: currentPatient.doctor })
      }
      markLabOrderSent(order.id)
    })
    recordStat(doctorId, 'tests', unsent.length)
    toast.success(`${unsent.length} lab order(s) sent to Laboratory`)
  }

  const handleSendRadiologyOrders = () => {
    const unsent = radiologyOrders.filter(o => !o.sentToRadiology)
    if (!currentPatient || unsent.length === 0) return
    unsent.forEach(order => {
      addRadToStore({ patientName: currentPatient.name, patientId: currentPatient.id, scanType: order.scanType, bodyPart: order.bodyPart, priority: order.priority, orderedBy: currentPatient.doctor })
      markRadiologyOrderSent(order.id)
    })
    recordStat(doctorId, 'tests', unsent.length)
    toast.success(`${unsent.length} radiology order(s) sent to Radiology`)
  }

  const handleSendAdmission = () => {
    if (!currentPatient) return
    if (!admReason.trim()) { toast.error("Please enter reason for admission"); return }
    // Build from the form state directly (avoids reading a not-yet-propagated store value).
    setAdmissionOrder({ admissionType: admType, reason: admReason, bedTypePreference: admType })
    requestAdmission({
      patientId: currentPatient.id,
      patientName: currentPatient.name,
      patientAge: currentPatient.age,
      patientGender: currentPatient.gender,
      diagnosis,
      admissionType: admType,
      bedTypePreference: admType,
      reason: admReason,
      requestedBy: currentPatient.doctor,
      department: currentPatient.department,
      triageLevel: currentPatient.triageLevel,
      payerType: 'General',
      bundle: {
        prescriptions: prescriptions.map(p => ({ medicine: p.medicine, dosage: p.dosage, duration: p.duration, instructions: p.instructions })),
        labOrders: labOrders.map(o => ({ testName: o.testName, priority: o.priority })),
        radiologyOrders: radiologyOrders.map(o => ({ scanType: o.scanType, bodyPart: o.bodyPart, priority: o.priority })),
        allergies: admAllergies,
        comorbidities: admComorbidities,
        specialInstructions: admSpecialInstructions,
        urgency: admUrgency,
      },
    })
    markAdmissionSent()
    recordStat(doctorId, 'admissions', 1)
    setShowAdmModal(false)
    toast.success("Admission card + documents sent to Bed Manager")
  }

  const selectStyle = "w-full rounded-xl px-3 py-2 text-sm text-[#0F172A] focus:outline-none transition-all"
  const selectInlineStyle = { backgroundColor: '#F8FAFC', border: '1px solid rgba(15,23,42,0.06)', boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.04)' }

  // M2 — Doctor "On leave" gate. Banner is shown on the dashboard, and any
  // "Start consultation" action confirms before proceeding.
  const { onLeave, leaveUntil, availableForOPD } = profile
  const leaveBanner = onLeave || !availableForOPD
  const leaveLabel = onLeave
    ? `You're marked on leave${leaveUntil ? ` until ${new Date(leaveUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}`
    : 'You are not currently accepting in-person consultations'

  // M4.1 — Shift-gate. If the doctor is Off per HR roster today, show a softer
  // (info) banner alongside the leave banner.
  const todayIso = new Date().toISOString().split('T')[0]!
  const getShiftFromHR = useHRStore(s => s.getShift)
  const todayShift = useAuthStore.getState().currentUser
    ? getShiftFromHR(useAuthStore.getState().currentUser!.id, todayIso)
    : 'Off'
  const offShiftBanner = !leaveBanner && todayShift === 'Off'

  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-100px)] lg:overflow-hidden gap-4">

      {/* M2 — On-leave banner (full width above queue + workspace) */}
      {leaveBanner && (
        <div className="absolute top-0 left-0 right-0 z-30 mx-4 mt-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 flex items-start gap-2.5 shadow-sm">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-[12.5px] text-amber-900 leading-relaxed flex-1 min-w-0">
            <b>{leaveLabel}.</b> Starting a consultation will prompt for confirmation. Update this in <b>Settings</b>.
          </p>
        </div>
      )}

      {/* M4.1 — Off-shift soft banner (HR roster check) */}
      {offShiftBanner && (
        <div className="absolute top-0 left-0 right-0 z-30 mx-4 mt-2 rounded-xl bg-[rgba(14,116,144,0.07)] border border-[rgba(14,116,144,0.20)] px-4 py-2.5 flex items-start gap-2.5 shadow-sm">
          <AlertCircle className="h-4 w-4 text-[#0E7490] flex-shrink-0 mt-0.5" />
          <p className="text-[12.5px] text-[#0B5A6E] leading-relaxed flex-1 min-w-0">
            <b>You're scheduled Off today per the roster.</b> You can still start a consultation if needed; it&apos;ll be logged with that context.
          </p>
        </div>
      )}

      {/* Floating live video — online consult runs alongside the full workspace */}
      <AnimatePresence>
        {isOnlineConsult && currentPatient && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-5 right-5 z-50 w-60 rounded-2xl overflow-hidden" style={{ background: '#0F172A', boxShadow: '0 16px 40px rgba(0,0,0,0.35)' }}>
            <div className="relative h-28 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
              <div className="h-14 w-14 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white text-lg font-bold">
                {currentPatient.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </div>
              <span className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold text-green-400"><span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" /> LIVE</span>
            </div>
            <div className="p-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-white text-[12.5px] font-bold truncate">{currentPatient.name}</p>
                <p className="text-white/50 text-[10px]">Online consultation</p>
              </div>
              <button onClick={endOnlineCall} aria-label="End call" className="h-8 px-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold flex items-center gap-1 transition active:scale-95">
                <PhoneOff className="h-3.5 w-3.5" /> End
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Left Sidebar Queue ──────────────────────────── */}
      <div
        className="w-full lg:w-72 flex-shrink-0 flex flex-col lg:overflow-hidden rounded-2xl max-h-[55vh] lg:max-h-none"
        style={{ background: 'white', boxShadow: '0 1px 4px rgba(15,23,42,0.06), 0 8px 32px rgba(15,23,42,0.06)' }}
      >
        {/* Stats header */}
        <div className="p-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
          <div className="grid grid-cols-3 gap-2 mb-4 sm:gap-2">
            {[
              { label: "Total", value: mine.length,  valueClass: "text-foreground" },
              { label: "Seen",  value: seen,          valueClass: "text-success" },
              { label: "Queue", value: queue.length,  valueClass: "text-warning" },
            ].map(({ label, value, valueClass }) => (
              <div
                key={label}
                className="flex flex-col items-center py-2.5 rounded-xl bg-surface-sunken"
              >
                <p className={cn("text-xl font-bold tabular-nums leading-none", valueClass)}>{value}</p>
                <p className="t-overline text-foreground-lighter mt-1">{label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">Today&apos;s Queue</p>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-accent-soft text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" aria-hidden="true" />
              {queue.length} active
            </div>
          </div>
        </div>

        {/* Queue entries */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ background: '#F8FAFC' }}>
          {queue.map((p, i) => (
            <QueueEntry
              key={p.id}
              patient={p}
              selected={currentPatient?.id === p.id}
              onClick={() => openPatient(p)}
              delay={i * 0.04}
            />
          ))}
          {queue.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#F0FDF4,#ECFDF5)' }}>
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <p className="text-sm font-semibold" style={{ color: '#94A3B8' }}>Queue cleared</p>
            </div>
          )}
        </div>

        {/* Next patient footer */}
        <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(15,23,42,0.05)' }}>
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
            style={{ background: '#F8FAFC' }}
          >
            <Clock className="h-4 w-4 flex-shrink-0" style={{ color: '#94A3B8' }} />
            <span className="text-xs font-medium" style={{ color: '#64748B' }}>
              Next: <span className="font-bold text-[#0F172A]">{queue[0]?.name ?? "No patients"}</span>
              {queue[0] && <> in ~{queue[0].estimatedWait}m</>}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Panel ─────────────────────────────────── */}
      {!currentPatient ? (
        <div
          className="flex-1 flex flex-col items-center justify-center gap-6 text-center rounded-2xl p-12"
          style={{ background: 'white', boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
        >
          <div
            className="h-20 w-20 rounded-3xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)', boxShadow: '0 8px 24px rgba(14,116,144,0.12)' }}
          >
            <Stethoscope className="h-10 w-10 text-[#0E7490]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0F172A] mb-2">Select a Patient</h2>
            <p className="text-sm leading-relaxed max-w-xs mx-auto" style={{ color: '#94A3B8' }}>
              Choose a patient from the queue to start the consultation. AI pre-briefs load automatically.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:overflow-hidden min-w-0">

          {/* Consultation Notes & Orders */}
          <div className="flex-1 overflow-y-auto space-y-4 min-w-0">

            {/* Patient Header */}
            <div
              className="rounded-2xl p-5"
              style={{ background: 'white', boxShadow: '0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)' }}
            >
              <div className="flex items-start gap-4 flex-wrap">
                <Avatar name={currentPatient.name} size="lg" className="h-14 w-14 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="text-lg font-bold text-[#0F172A]">{currentPatient.name}</h2>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: 'rgba(14,116,144,0.10)', color: '#0E7490' }}
                    >
                      #{currentPatient.token}
                    </span>
                    {currentPatient.triageLevel && (() => {
                      const tg = TRIAGE_GRADIENTS[currentPatient.triageLevel] ?? TRIAGE_GRADIENTS.Low
                      return (
                        <span
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                          style={{ background: tg.gradient, boxShadow: `0 2px 6px ${tg.shadow}` }}
                        >
                          {currentPatient.triageLevel}
                        </span>
                      )
                    })()}
                  </div>
                  <p className="text-xs font-medium" style={{ color: '#94A3B8' }}>
                    {currentPatient.id} · {currentPatient.age}y · {currentPatient.gender} · {currentPatient.phone}
                  </p>
                </div>
                {currentPatient.vitals && (
                  <div className="flex gap-2 flex-wrap flex-shrink-0">
                    {Object.entries(currentPatient.vitals).slice(0, 3).map(([k, v]) => (
                      <div
                        key={k}
                        className="text-center px-3 py-2 rounded-xl"
                        style={{ background: '#F8FAFC', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}
                      >
                        <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#94A3B8' }}>{k}</p>
                        <p className="text-sm font-bold text-[#0F172A]">{v}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Out-of-stock alerts for drugs this doctor prescribed */}
            <DoctorStockAlerts doctorName={currentUser?.name} />

            {/* Consultation action bar — advance the patient down the journey */}
            <div className="flex items-center justify-between rounded-2xl px-5 py-3 gap-3 flex-wrap" style={{ background: 'white', boxShadow: '0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)' }}>
              <span className="text-[13px] font-semibold flex items-center gap-2" style={{ color: '#64748B' }}>
                {isOnlineConsult
                  ? <><Video className="h-4 w-4 text-[#0E7490]" /> In <b className="text-[#0E7490]">online</b> consultation with {currentPatient.name.split(' ')[0]}</>
                  : <><span className="h-2 w-2 rounded-full bg-[rgba(14,116,144,0.07)]0 animate-pulse" /> In consultation with {currentPatient.name.split(' ')[0]}</>}
                <span className="ml-1 text-[12px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Fee ₹{consultFee}</span>
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setShowRxDrawer(true)}
                  className="h-9 px-4 rounded-xl font-bold text-[13px] flex items-center gap-2 active:scale-[0.98] transition cursor-pointer"
                  style={{ background: 'rgba(14,116,144,0.08)', color: '#0E7490', border: '1px solid rgba(14,116,144,0.18)' }}
                >
                  <Pill className="h-4 w-4" />
                  Prescriptions
                  {prescriptions.length > 0 && (
                    <span className="h-5 min-w-[20px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: '#0E7490', color: '#fff' }}>
                      {prescriptions.length}
                    </span>
                  )}
                </button>
                <button onClick={completeConsult}
                  className="h-9 px-4 rounded-xl font-bold text-[13px] text-white flex items-center gap-2 active:scale-[0.98] transition"
                  style={{ background: 'linear-gradient(135deg,#16A34A,#0B5A6E)', boxShadow: '0 4px 12px rgba(22,163,74,0.30)' }}>
                  <CheckCircle2 className="h-4 w-4" /> Complete consultation <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <AiPreBrief patient={currentPatient} />

            {/* Nurse-completed clinical profile */}
            <PatientProfileSummary patientId={currentPatient.id} />

            {/* Symptoms & History */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              {/* Symptoms */}
              <div className="p-5 rounded-2xl" style={{ background: 'white', boxShadow: '0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-7 w-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', boxShadow: '0 2px 6px rgba(15,23,42,0.15)' }}>
                    <AlertCircle className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Symptoms</h3>
                </div>
                <div className="space-y-2">
                  {currentPatient.symptoms.length > 0 ? currentPatient.symptoms.map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#F97316' }} />
                      <p className="text-sm font-medium text-[#334155]">{s}</p>
                    </div>
                  )) : <p className="text-sm font-medium italic" style={{ color: '#94A3B8' }}>No symptoms recorded</p>}
                </div>
              </div>

              {/* History — leads with an AI crux, "View more" reveals detail + past visits */}
              <div className="p-5 rounded-2xl" style={{ background: 'white', boxShadow: '0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#0B5A6E,#0E7490)', boxShadow: '0 2px 6px rgba(15,23,42,0.15)' }}>
                    <FileText className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>History</h3>
                </div>

                {/* AI crux */}
                <div className="rounded-xl p-3 mb-3" style={{ background: 'linear-gradient(135deg,rgba(14,116,144,0.06),rgba(14,116,144,0.03))', border: '1px solid rgba(14,116,144,0.12)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1" style={{ color: '#0B5A6E' }}><Sparkles className="h-3 w-3" /> AI brief</p>
                  <p className="text-[13px] font-medium leading-snug" style={{ color: '#0B5A6E' }}>{historyBrief(currentPatient)}</p>
                </div>

                {/* View more */}
                <button onClick={() => setHistoryOpen(o => !o)} className="text-[12px] font-bold flex items-center gap-1 cursor-pointer" style={{ color: '#0B5A6E' }}>
                  {historyOpen ? <>Show less <ChevronUp className="h-3.5 w-3.5" /></> : <>View detailed history <ChevronDown className="h-3.5 w-3.5" /></>}
                </button>

                <AnimatePresence>
                  {historyOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="pt-3 space-y-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#94A3B8' }}>Past medical history</p>
                          {currentPatient.history.length ? currentPatient.history.map((h, i) => (
                            <div key={i} className="flex items-start gap-2.5"><div className="h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#0B5A6E' }} /><p className="text-sm font-medium text-[#334155]">{h}</p></div>
                          )) : <p className="text-sm italic" style={{ color: '#94A3B8' }}>No significant history</p>}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#94A3B8' }}>Past visits ({patientVisits.length})</p>
                          {patientVisits.length ? patientVisits.map(v => (
                            <div key={v.id} className="rounded-xl p-2.5 mb-1.5" style={{ background: '#F8FAFC' }}>
                              <div className="flex items-center justify-between"><p className="text-[12.5px] font-bold text-[#0F172A]">{v.diagnosis}</p><span className="text-[10.5px] text-[#94A3B8]">{new Date(v.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                              <p className="text-[11px] mt-0.5" style={{ color: '#64748B' }}>{v.doctor} · {v.prescriptions.map(p => p.medicine).join(', ') || 'no meds'}</p>
                            </div>
                          )) : <p className="text-sm italic" style={{ color: '#94A3B8' }}>No prior visits on record</p>}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Clinical Notes */}
            <div
              className="p-5 rounded-2xl"
              style={{ background: 'white', boxShadow: '0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0E7490,#0E7490)', boxShadow: '0 2px 6px rgba(14,116,144,0.25)' }}>
                    <Activity className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-[#0F172A]">Consultation Notes</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={structureNote} disabled={!notes.trim()} className="gap-2">
                    <Sparkles className="h-4 w-4" /> Structure (SOAP)
                  </Button>
                  <Button variant={isDictating ? "danger" : "secondary"} size="sm" onClick={handleDictate} className="gap-2" title={speechOk ? undefined : "Voice input not supported in this browser"}>
                    {isDictating ? <><MicOff className="h-4 w-4 animate-pulse" />Stop</> : <><Mic className="h-4 w-4" />Dictate</>}
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#94A3B8' }}>Diagnosis</label>
                  <Input placeholder="E.g. Acute Viral Pharyngitis" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} className="bg-[#F8FAFC]" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Notes & Plan</label>
                    {noteSaved && (
                      <span className="text-[10px] font-bold text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />Saved
                      </span>
                    )}
                  </div>
                  <textarea
                    className="w-full rounded-xl px-4 py-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none resize-none transition-all"
                    style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.06)', boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.04)' }}
                    placeholder="Enter findings, follow-up instructions, etc..."
                    rows={4}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    onFocus={e => { e.currentTarget.style.boxShadow = '0 0 0 2px rgba(14,116,144,0.30)'; e.currentTarget.style.borderColor = '#0E7490' }}
                    onBlur={e => { e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(15,23,42,0.04)'; e.currentTarget.style.borderColor = 'rgba(15,23,42,0.06)' }}
                  />
                </div>
              </div>
            </div>

            {/* ── QUICK ORDER SETS (Track A) ── */}
            <OrderSetPicker onApply={applyOrderSet} disabled={!currentPatient} />

            {/* ── ORDER PANELS ── */}
            <OrderPanel title="Order Lab Tests" icon={FlaskConical} styleKey="lab" defaultOpen>
              <div className="space-y-3 mt-3">
                <div className="flex gap-2">
                  <Select value={labTest} onChange={e => setLabTest(e.target.value)} className={selectStyle} style={selectInlineStyle}>
                    <option value="">Select test...</option>
                    {LAB_TESTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                  <Select value={labPriority} onChange={e => setLabPriority(e.target.value as 'Routine' | 'Urgent')} className={cn(selectStyle, "w-24")} style={selectInlineStyle}>
                    <option>Routine</option>
                    <option>Urgent</option>
                  </Select>
                  <Button size="sm" variant="secondary" disabled={!labTest || !currentPatient} onClick={() => { dispatchLabOrder(labTest, labPriority); setLabTest("") }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <AnimatePresence>
                  {labOrders.map(order => (
                    <motion.div key={order.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                      className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: ORDER_STYLES.lab.light }}
                    >
                      <div className="flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 flex-shrink-0" style={{ color: ORDER_STYLES.lab.text }} />
                        <span className="text-sm font-medium" style={{ color: '#0F172A' }}>{order.testName}</span>
                        <NeonBadge variant={order.priority === 'Urgent' ? 'danger' : 'muted'} className="text-[10px]">{order.priority}</NeonBadge>
                        {order.sentToLab && <NeonBadge variant="success" className="text-[10px]">Sent</NeonBadge>}
                      </div>
                      {!order.sentToLab && (
                        <button onClick={() => removeLabOrder(order.id)} className="p-1 rounded cursor-pointer" style={{ color: '#94A3B8' }}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </OrderPanel>

            <OrderPanel title="Order Radiology Scan" icon={ScanLine} styleKey="radiology">
              <div className="space-y-3 mt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Select value={radScanType} onChange={e => setRadScanType(e.target.value as 'X-Ray' | 'MRI' | 'CT Scan' | 'Ultrasound')} className={selectStyle} style={selectInlineStyle}>
                    <option>X-Ray</option><option>MRI</option><option>CT Scan</option><option>Ultrasound</option>
                  </Select>
                  <Select value={radBodyPart} onChange={e => setRadBodyPart(e.target.value)} className={selectStyle} style={selectInlineStyle}>
                    <option value="">Body part...</option>
                    {BODY_PARTS.map(b => <option key={b} value={b}>{b}</option>)}
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Select value={radPriority} onChange={e => setRadPriority(e.target.value as 'Routine' | 'Urgent')} className={cn(selectStyle, "w-28")} style={selectInlineStyle}>
                    <option>Routine</option><option>Urgent</option>
                  </Select>
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => {
                    if (!radBodyPart) return
                    dispatchRadOrder(radScanType, radBodyPart, radPriority)
                    setRadBodyPart("")
                  }}>
                    <Plus className="h-4 w-4 mr-1" /> Add Scan
                  </Button>
                </div>
                <AnimatePresence>
                  {radiologyOrders.map(order => (
                    <motion.div key={order.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                      className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: ORDER_STYLES.radiology.light }}
                    >
                      <div className="flex items-center gap-2">
                        <ScanLine className="h-4 w-4 flex-shrink-0" style={{ color: ORDER_STYLES.radiology.text }} />
                        <span className="text-sm font-medium" style={{ color: '#0F172A' }}>{order.scanType} — {order.bodyPart}</span>
                        <NeonBadge variant={order.priority === 'Urgent' ? 'danger' : 'muted'} className="text-[10px]">{order.priority}</NeonBadge>
                        {order.sentToRadiology && <NeonBadge variant="success" className="text-[10px]">Sent</NeonBadge>}
                      </div>
                      {!order.sentToRadiology && (
                        <button onClick={() => removeRadiologyOrder(order.id)} className="p-1 rounded cursor-pointer" style={{ color: '#94A3B8' }}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </OrderPanel>

            <OrderPanel title="Refer to Specialist" icon={GitBranch} styleKey="referral">
              <div className="space-y-3 mt-3">
                <div className="flex gap-2">
                  <Select value={refSpecialty} onChange={e => setRefSpecialty(e.target.value)} className={cn(selectStyle, "flex-1")} style={selectInlineStyle}>
                    <option value="">Select specialty...</option>
                    {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={refUrgent} onChange={e => setRefUrgent(e.target.checked)} className="rounded" />
                    <span className="text-xs font-semibold text-red-600">Urgent</span>
                  </label>
                </div>
                <textarea
                  value={refNotes}
                  onChange={e => setRefNotes(e.target.value)}
                  placeholder="Referral notes for specialist..."
                  rows={2}
                  className={selectStyle}
                  style={{ ...selectInlineStyle, resize: 'none' }}
                />
                <Button size="sm" variant="secondary" className="gap-2" onClick={() => {
                  if (!refSpecialty) return
                  addReferral({ specialty: refSpecialty, notes: refNotes, urgent: refUrgent })
                  toast.success(`Referral to ${refSpecialty} recorded`)
                  setRefSpecialty(""); setRefNotes(""); setRefUrgent(false)
                }}>
                  <ArrowRight className="h-4 w-4" /> Add Referral
                </Button>
                <AnimatePresence>
                  {referrals.map(ref => (
                    <motion.div key={ref.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                      className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: ORDER_STYLES.referral.light }}
                    >
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 flex-shrink-0" style={{ color: ORDER_STYLES.referral.text }} />
                        <span className="text-sm font-medium" style={{ color: '#0F172A' }}>{ref.specialty}</span>
                        {ref.urgent && <NeonBadge variant="danger" className="text-[10px]">Urgent</NeonBadge>}
                      </div>
                      <button onClick={() => removeReferral(ref.id)} className="p-1 rounded cursor-pointer" style={{ color: '#94A3B8' }}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </OrderPanel>

            <OrderPanel title="Admit Patient" icon={Bed} styleKey="admission">
              <div className="space-y-3 mt-3">
                {admissionOrder?.sent ? (
                  <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: '#F0FDF4' }}>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-bold text-green-900">Admission Card Sent to Bed Manager</p>
                      <p className="text-xs text-green-700 mt-0.5">{admissionOrder.admissionType} · {admissionOrder.reason}</p>
                      <p className="text-xs text-green-600 mt-0.5">
                        {prescriptions.length} Rx · {labOrders.length} lab · {radiologyOrders.length} radiology orders bundled
                      </p>
                    </div>
                  </div>
                ) : (
                  <Button variant="danger" className="w-full gap-2" onClick={() => setShowAdmModal(true)}>
                    <UserPlus className="h-4 w-4" /> Create Admission Card
                  </Button>
                )}
              </div>
            </OrderPanel>

            {/* Admission Card Modal */}
            <AnimatePresence>
              {showAdmModal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                  onClick={() => setShowAdmModal(false)}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#EF4444,#DC2626)', boxShadow: '0 3px 8px rgba(239,68,68,0.25)' }}>
                            <Bed className="h-4.5 w-4.5 text-white" />
                          </div>
                          <div>
                            <h2 className="text-base font-bold text-[#0F172A]">Admission Card</h2>
                            <p className="text-xs font-medium" style={{ color: '#94A3B8' }}>{currentPatient?.name} · {currentPatient?.id}</p>
                          </div>
                        </div>
                        <button onClick={() => setShowAdmModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                          <X className="h-4 w-4 text-slate-500" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        {/* Ward type + Urgency */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#94A3B8' }}>Ward Type</label>
                            <Select value={admType} onChange={e => setAdmType(e.target.value as typeof admType)} className={selectStyle} style={selectInlineStyle}>
                              <option>General Ward</option><option>ICU</option><option>Private Room</option><option>Semi-Private</option><option>Day Care</option>
                            </Select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#94A3B8' }}>Urgency</label>
                            <Select value={admUrgency} onChange={e => setAdmUrgency(e.target.value as typeof admUrgency)} className={selectStyle} style={selectInlineStyle}>
                              <option>Routine</option><option>Urgent</option><option>Emergency</option>
                            </Select>
                          </div>
                        </div>

                        {/* Live bed availability for the chosen ward */}
                        <div className={cn("flex items-center justify-between rounded-xl px-3.5 py-2.5", wardFree > 0 ? "bg-green-50" : "bg-amber-50")}>
                          <span className={cn("text-[12.5px] font-semibold flex items-center gap-1.5", wardFree > 0 ? "text-green-700" : "text-amber-700")}>
                            <Bed className="h-4 w-4" />
                            {wardFree > 0 ? `${wardFree} of ${wardTotal} ${admType} bed${wardFree !== 1 ? 's' : ''} free at this branch` : `No ${admType} beds free at this branch`}
                          </span>
                          <Link href="/doctor/beds" className="text-[12px] font-bold text-[#0E7490] hover:text-[#0E7490] flex items-center gap-1 flex-shrink-0">
                            {wardFree > 0 ? 'View beds' : 'Other branches'} <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>

                        {/* Reason */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#94A3B8' }}>Reason for Admission</label>
                          <Input placeholder="E.g. Post-PCI monitoring, IV therapy required..." value={admReason} onChange={e => setAdmReason(e.target.value)} className="bg-[#F8FAFC]" />
                        </div>

                        {/* Allergies */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#94A3B8' }}>Allergies</label>
                          <Input placeholder="E.g. Penicillin, sulpha drugs..." value={admAllergies} onChange={e => setAdmAllergies(e.target.value)} className="bg-[#F8FAFC]" />
                        </div>

                        {/* Comorbidities */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#94A3B8' }}>Co-morbidities</label>
                          <Input placeholder="E.g. Hypertension, T2 Diabetes, CKD..." value={admComorbidities} onChange={e => setAdmComorbidities(e.target.value)} className="bg-[#F8FAFC]" />
                        </div>

                        {/* Special Instructions */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#94A3B8' }}>Special Instructions for Ward</label>
                          <textarea
                            className="w-full rounded-xl px-4 py-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none resize-none"
                            style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.06)' }}
                            placeholder="E.g. Continuous cardiac monitoring, NPO, isolation precautions..."
                            rows={2}
                            value={admSpecialInstructions}
                            onChange={e => setAdmSpecialInstructions(e.target.value)}
                          />
                        </div>

                        {/* Bundle summary */}
                        <div className="rounded-xl p-4 space-y-2" style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.06)' }}>
                          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Documents to be bundled</p>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-xs font-medium text-[#334155]">
                              <div className="h-1.5 w-1.5 rounded-full bg-[rgba(14,116,144,0.07)]0 flex-shrink-0" />
                              <span>{prescriptions.length} prescription(s) · {labOrders.length} lab order(s) · {radiologyOrders.length} radiology order(s)</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-medium text-[#334155]">
                              <div className="h-1.5 w-1.5 rounded-full bg-[rgba(14,116,144,0.07)]0 flex-shrink-0" />
                              <span>Diagnosis: {diagnosis || '(not set)'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-medium" style={{ color: '#16A34A' }}>
                              <CheckCircle2 className="h-3 w-3" />
                              <span>All documents auto-sent to Bed Manager</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                          <Button variant="secondary" className="flex-1" onClick={() => setShowAdmModal(false)}>Cancel</Button>
                          <Button variant="danger" className="flex-1 gap-2" onClick={handleSendAdmission}>
                            <Send className="h-4 w-4" /> Send to Bed Manager
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* ── Right Sidebar: AI Assistant only ──────────── */}
          <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-4 lg:overflow-hidden">
            <div
              className="flex-1 flex flex-col overflow-hidden rounded-2xl p-4"
              style={{
                background: 'linear-gradient(135deg, rgba(14,116,144,0.06) 0%, rgba(14,116,144,0.03) 100%)',
                border: '1px solid rgba(14,116,144,0.10)',
                boxShadow: '0 4px 16px rgba(14,116,144,0.10)',
              }}
            >
              <div className="flex items-center gap-2 mb-4 flex-shrink-0">
                <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0B5A6E,#0E7490)', boxShadow: '0 3px 8px rgba(14,116,144,0.30)' }}>
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="font-bold text-sm text-[#0F172A]">AI Assistant</span>
                <span className="ai-badge ml-auto">AI</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2">
                <AnimatePresence>
                  {aiSuggestions.map((s, idx) => (
                    <motion.button
                      key={s}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => acceptAISuggestion(s)}
                      className="w-full text-left text-xs rounded-xl p-3 flex items-center justify-between group cursor-pointer transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.7)',
                        color: '#0B5A6E',
                        boxShadow: '0 1px 4px rgba(14,116,144,0.10)',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(14,116,144,0.20)'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 4px rgba(14,116,144,0.10)'}
                    >
                      <span className="font-semibold leading-tight pr-2">{s}</span>
                      <Plus className="h-3.5 w-3.5 flex-shrink-0 opacity-60 group-hover:opacity-100" />
                    </motion.button>
                  ))}
                </AnimatePresence>
                {aiSuggestions.length === 0 && (
                  <div className="text-center py-3">
                    <CheckCircle2 className="h-5 w-5 mx-auto mb-1" style={{ color: '#6EC9DC' }} />
                    <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>No new suggestions</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {dialogView}

      {/* ── Prescriptions Slide Drawer ──────────────────────────────── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
        {showRxDrawer && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(2px)' }}
              onClick={() => setShowRxDrawer(false)}
            />

            {/* Drawer panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 right-0 bottom-0 z-50 flex flex-col w-full max-w-sm"
              style={{ background: 'white', boxShadow: '-8px 0 40px rgba(15,23,42,0.18)' }}
            >
              {/* Drawer header */}
              <div className="flex-shrink-0 flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: 'linear-gradient(135deg,rgba(14,116,144,0.07),rgba(14,116,144,0.03))' }}>
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0E7490,#0B5A6E)', boxShadow: '0 3px 8px rgba(14,116,144,0.30)' }}>
                    <Pill className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-[15px] font-bold text-[#0F172A]">Prescriptions</span>
                  {prescriptions.length > 0 && (
                    <span className="h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: 'rgba(14,116,144,0.12)', color: '#0E7490' }}>
                      {prescriptions.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowRxDrawer(false)}
                  className="h-8 w-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                  style={{ background: 'rgba(15,23,42,0.06)', color: '#64748B' }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(15,23,42,0.10)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(15,23,42,0.06)'}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Add medicine form */}
              <div className="flex-shrink-0 px-5 py-4" style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                {diagnosis && prescriptions.length === 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: '#0B5A6E' }}>
                      <Sparkles className="h-3 w-3" /> AI Suggests
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {['Paracetamol 500mg', 'Amoxicillin 500mg', 'Pantoprazole 40mg'].map(drug => (
                        <button key={drug} onClick={() => addMed(drug)} className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full cursor-pointer transition-all" style={{ background: 'rgba(14,116,144,0.12)', color: '#0B5A6E' }}>
                          + {drug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search + autocomplete */}
                <div className="relative mb-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#94A3B8' }} />
                      <Input
                        placeholder="Search medicine..."
                        value={medSearch}
                        onChange={e => { setMedSearch(e.target.value); setShowDrugs(true) }}
                        onKeyDown={e => e.key === 'Enter' && addMed(medSearch)}
                        className="pl-9 h-10"
                      />
                    </div>
                    <Button onClick={() => addMed(medSearch)} size="sm" className="h-10 px-4">Add</Button>
                  </div>
                  <AnimatePresence>
                    {showDrugs && filtered.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-full mt-1 left-0 right-0 z-20 rounded-xl bg-white overflow-hidden"
                        style={{ boxShadow: '0 8px 24px rgba(15,23,42,0.14)' }}
                      >
                        {filtered.slice(0, 6).map(d => (
                          <button
                            key={d}
                            onClick={() => { setMedSearch(d); setShowDrugs(false) }}
                            className="w-full text-left text-sm px-4 py-2.5 text-[#334155] font-medium transition-colors cursor-pointer"
                            style={{ borderBottom: '1px solid rgba(15,23,42,0.04)' }}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFC'}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'white'}
                          >
                            {d}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Dosage fields — 2×2 grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: 'Dosage',   value: dosage,    setter: setDosage,    p: '1-0-1' },
                    { label: 'Duration', value: duration,  setter: setDuration,  p: '5 days' },
                    { label: 'Freq',     value: frequency, setter: setFrequency, p: 'TDS' },
                    { label: 'Qty',      value: qty,       setter: setQty,       p: '10' },
                  ].map(({ label, value, setter, p }) => (
                    <div key={label}>
                      <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#94A3B8' }}>{label}</label>
                      <Input value={value} onChange={e => setter(e.target.value)} placeholder={p} className="h-8 text-sm" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Medicine list — fills all remaining height, scrollable */}
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2" style={{ background: '#F8FAFC' }}>
                {prescriptions.length > 0 && (
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#94A3B8' }}>
                    Added Medicines
                  </p>
                )}
                <AnimatePresence>
                  {prescriptions.map(p => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.18 }}
                      className="flex items-start justify-between p-3.5 rounded-xl"
                      style={{ background: 'white', boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-[#0F172A] truncate">{p.medicine}</p>
                        <p className="text-[11px] font-medium mt-0.5" style={{ color: '#94A3B8' }}>
                          {p.dosage} · {p.duration} · {p.instructions}
                        </p>
                      </div>
                      <button
                        onClick={() => removePrescription(p.id)}
                        className="p-1.5 rounded-lg ml-2 flex-shrink-0 cursor-pointer transition-colors"
                        style={{ color: '#CBD5E1' }}
                        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#EF4444'}
                        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#CBD5E1'}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {prescriptions.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-40">
                    <Pill className="h-10 w-10" style={{ color: '#CBD5E1' }} />
                    <p className="text-[13px] font-medium" style={{ color: '#94A3B8' }}>No medicines added yet</p>
                  </div>
                )}
              </div>

              {/* Footer — always pinned to bottom */}
              <div className="flex-shrink-0 px-5 py-4 space-y-2.5" style={{ borderTop: '1px solid rgba(15,23,42,0.06)', background: 'white' }}>
                {prescriptions.length > 0 && (
                  <button
                    onClick={printRx}
                    className="w-full h-10 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    style={{ background: '#F1F5F9', color: '#64748B' }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#E2E8F0'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#F1F5F9'}
                  >
                    <FileText className="h-4 w-4" /> Print / Export Prescription
                  </button>
                )}
                <button
                  onClick={() => { sendRx(); setShowRxDrawer(false) }}
                  disabled={prescriptions.length === 0 || isPharmacySent}
                  className="w-full h-11 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 text-white transition-all cursor-pointer disabled:opacity-50"
                  style={isPharmacySent
                    ? { background: 'linear-gradient(135deg,#16A34A,#0B5A6E)', boxShadow: '0 4px 14px rgba(22,163,74,0.30)' }
                    : { background: 'linear-gradient(135deg,#0E7490,#0B5A6E)', boxShadow: '0 4px 14px rgba(14,116,144,0.30)' }
                  }
                >
                  {isPharmacySent
                    ? <><CheckCircle2 className="h-4 w-4" /> Sent to Pharmacy</>
                    : <><Send className="h-4 w-4" /> Send to Pharmacy</>
                  }
                </button>
                {isPharmacySent && (
                  <p className="text-center text-[11px] font-semibold text-green-600">Pharmacy is preparing medicines</p>
                )}
              </div>
            </motion.div>
          </>
        )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
