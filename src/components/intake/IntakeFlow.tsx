"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Activity, ArrowRight } from "lucide-react"
import { usePatientStore } from "@/store/usePatientStore"
import { useAuthStore } from "@/store/useAuthStore"
import { usePatientLiveStore } from "@/store/usePatientLiveStore"
import { notifyAndAuditMany } from "@/lib/notifyAndAudit"
import { NeonBadge } from "@/components/ui/neon-badge"
import {
  initialForm, visibleSteps, canContinue, STEP_TITLES, triageScore, suggestDepartments,
  SYMPTOMS, type IntakeForm, type StepId, type Gender,
} from "@/lib/intake/data"
import { IntakeShell } from "./IntakeShell"
import { ChoiceStep } from "./ChoiceStep"
import { MethodStep, AadhaarScanStep, VoiceStep } from "./CaptureSteps"
import { AboutStep, ReportsStep, FamilyStep } from "./FieldSteps"
import { ConsultTypeStep, SlotStep, PaymentStep } from "./ConsultSteps"
import { ReviewStep, SuccessStep } from "./ReviewSuccess"

export function IntakeFlow() {
  const { patients, addPatient, generateFamilyToken } = usePatientStore()
  const voiceSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const [form, setForm] = useState<IntakeForm>(initialForm)
  const [current, setCurrent] = useState<StepId>('welcome')
  const [history, setHistory] = useState<StepId[]>([])
  const [returnToReview, setReturnToReview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [token, setToken] = useState<number | null>(null)
  const [familyToken, setFamilyToken] = useState<string | null>(null)
  const [estWait, setEstWait] = useState(0)

  const update = (patch: Partial<IntakeForm>) => setForm(f => {
    const clean: Partial<IntakeForm> = {}
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) (clean as Record<string, unknown>)[k] = v
    return { ...f, ...clean }
  })

  const visible = visibleSteps(form)
  const progressSteps = visible.filter(id => id !== 'welcome' && id !== 'success')
  const isSubmitStep = current === 'payment'

  const goNext = () => {
    if (returnToReview) { setReturnToReview(false); setHistory(h => [...h, current]); setCurrent('review'); return }
    const idx = visible.indexOf(current)
    const next = visible[idx + 1]
    if (!next) return
    setHistory(h => [...h, current]); setCurrent(next)
  }

  const goBack = () => {
    if (history.length === 0) return
    setCurrent(history[history.length - 1])
    setHistory(history.slice(0, -1))
    setReturnToReview(false)
  }

  const editFromReview = (id: StepId) => { setReturnToReview(true); setHistory(h => [...h, 'review']); setCurrent(id) }

  const handleSubmit = async () => {
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 1600))
    const mode = form.consultationType === 'video' ? 'video' : 'in_person'
    const newToken = Math.max(...patients.map(p => p.token), 1000) + 1
    const newId = `PT-${Date.now()}`
    const triage = triageScore(form.symptoms)
    const estWaitMins = (patients.filter(p => ['waiting', 'vitals'].includes(p.queueStatus)).length + 1) * 4
    addPatient({
      id: newId,
      name: form.name,
      age: parseInt(form.age, 10),
      gender: (form.gender || 'Male') as Gender,
      phone: form.phone,
      bloodGroup: 'A+',
      token: newToken,
      estimatedWait: estWaitMins,
      doctor: mode === 'video' ? (form.slotDoctor || 'Dr. Priya Nair') : 'Dr. Priya Nair',
      department: form.departments[0] ?? 'General Medicine',
      departments: form.departments,
      visitTypes: [mode === 'video' ? 'Video consult' : 'In-person OPD'],
      insurer: form.payer === 'cashless' ? (form.insurer || undefined) : undefined,
      symptoms: form.symptoms,
      history: [],
      triageLevel: triage.level,
      hasReports: form.hasReports,
    })
    let fToken: string | null = null
    if (form.dishaConsent && form.familyPhone.trim()) fToken = generateFamilyToken(newId, [form.familyPhone.trim()], true)

    // Log in as THIS newly registered patient and start a fresh live journey in the chosen mode.
    const auth = useAuthStore.getState()
    auth.setRole('patient')
    auth.setUser({ id: newId, name: form.name, role: 'patient' })
    usePatientLiveStore.getState().startVisit(newToken, mode)

    // Notify reception + assigned doctor that a new self-check-in arrived.
    notifyAndAuditMany(['reception', 'doctor'], {
      type: 'appointment', priority: triage.level === 'Critical' ? 'critical' : triage.level === 'High' ? 'high' : 'medium',
      title: `Self check-in · ${form.name}`,
      body: `${form.name} just checked in via kiosk. Triage: ${triage.level}. ${form.symptoms.length ? 'Symptoms: ' + form.symptoms.join(', ') + '.' : 'No symptoms provided.'} Token #${newToken}.`,
      patientName: form.name,
      audit: { action: 'reception_registered', resource: 'patient', resourceId: newId, detail: `Kiosk self-check-in completed · token ${newToken}`, userName: form.name },
    })
    setToken(newToken); setFamilyToken(fToken); setEstWait(estWaitMins); setSubmitting(false); setCurrent('success')
  }

  // ── Terminal screens ───────────────────────────────────────────────
  if (current === 'welcome') {
    return (
      <div className="min-h-[100dvh] bg-[#F2F2F7] flex flex-col md:bg-slate-100 md:py-12">
        <div className="flex-1 w-full max-w-[420px] mx-auto flex flex-col items-center justify-center text-center bg-[#F2F2F7] md:rounded-[40px] md:shadow-2xl overflow-hidden border-x border-slate-200/50 md:border md:border-white/50 px-8">
          <img src="/Umang-logo.webp" alt="Umang HIMS" className="h-12 w-auto object-contain mb-8" />
          <h1 className="text-[34px] font-bold text-slate-900 tracking-tight leading-tight">Let&apos;s get you started</h1>
          <p className="text-[16px] text-slate-500 mt-3 mb-10 max-w-[280px]">In-person or online — we&apos;ll guide you one step at a time and get you to the right doctor.</p>
          <button
            onClick={goNext}
            className="w-full max-w-[320px] h-14 rounded-2xl font-semibold text-[17px] text-white bg-[#0E7490] hover:bg-[#0B5A6E] transition-all shadow-[0_8px_20px_rgba(14,116,144,0.25)] active:scale-[0.97] flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7490] focus-visible:ring-offset-2"
          >
            Start <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    )
  }

  if (current === 'success') {
    return <SuccessStep form={form} token={token ?? 1} familyToken={familyToken} wait={estWait} />
  }

  // ── Step body ───────────────────────────────────────────────────────
  const triage = triageScore(form.symptoms)
  const renderBody = () => {
    switch (current) {
      case 'consultType': return <ConsultTypeStep form={form} update={update} />
      case 'method': return <MethodStep form={form} update={update} voiceSupported={voiceSupported} />
      case 'aadhaar': return <AadhaarScanStep form={form} update={update} />
      case 'voice': return <VoiceStep form={form} update={update} />
      case 'about': return <AboutStep form={form} update={update} />
      case 'symptoms': {
        const aiBar = form.symptoms.length > 0 ? (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-[14px] bg-white border border-[rgba(14,116,144,0.15)] shadow-[0_2px_12px_rgba(45,212,191,0.12)]">
            <span className="flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-full bg-[rgba(14,116,144,0.07)] flex items-center justify-center border border-[rgba(14,116,144,0.15)]"><Activity className="h-4 w-4 text-[#0E7490]" aria-hidden="true" /></span>
              <span className="text-[13px] font-bold text-slate-900">AI Assessment</span>
            </span>
            <NeonBadge variant={triage.variant} dot pulse className="px-3 py-1">{triage.level}</NeonBadge>
          </div>
        ) : null
        return <ChoiceStep fill columns={2} compact options={SYMPTOMS.map(s => ({ value: s, label: s }))} value={form.symptoms} onChange={v => update({ symptoms: v, departments: suggestDepartments(v) })} multi otherEnabled otherPlaceholder="Describe your problem…" footer={aiBar} />
      }
      case 'slot': return <SlotStep form={form} update={update} />
      case 'reports': return <ReportsStep form={form} update={update} />
      case 'family': return <FamilyStep form={form} update={update} />
      case 'review': return <ReviewStep form={form} onEdit={editFromReview} />
      case 'payment': return <PaymentStep form={form} update={update} />
      default: return null
    }
  }

  return (
    <IntakeShell
      stepNumber={progressSteps.indexOf(current) + 1}
      totalSteps={progressSteps.length}
      title={STEP_TITLES[current]}
      onBack={history.length > 0 ? goBack : undefined}
      ctaLabel={isSubmitStep ? (form.payer === 'cashless' ? 'Confirm booking' : 'Pay & confirm') : 'Continue'}
      onCta={isSubmitStep ? handleSubmit : goNext}
      ctaDisabled={!canContinue(current, form)}
      ctaLoading={submitting}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="h-full overflow-hidden"
        >
          {renderBody()}
        </motion.div>
      </AnimatePresence>
    </IntakeShell>
  )
}
