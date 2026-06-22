"use client"

/* M9-F — Doctor consultation workspace.
 *
 * Replaces the prior redirect-only page. Provides a focused workspace for
 * the current OPD encounter: patient strip + SOAP note (auto-saved) +
 * quick-orders rail (Rx · Lab · Imaging · Refer). Each action wires
 * through to existing stores and emits notifyAndAudit handoffs to the
 * next role.
 */

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Stethoscope, Pill, FlaskConical, ScanLine, ArrowLeft, Save, Sparkles, FileText, Send, Plus, X } from "lucide-react"
import { useAuthStore } from "@/store/useAuthStore"
import { usePatientStore } from "@/store/usePatientStore"
import { useLabOrdersStore } from "@/store/useLabOrdersStore"
import { LAB_CATALOG } from "@/lib/labCatalog"
import { Select } from "@/components/ui/Select"
import { toast } from "sonner"
import { notifyAndAudit } from "@/lib/notifyAndAudit"

const LAB_OPTIONS = Object.values(LAB_CATALOG).map(e => ({ code: e.code, name: e.name }))

interface SoapDraft { subjective: string; objective: string; assessment: string; plan: string }
const EMPTY: SoapDraft = { subjective: '', objective: '', assessment: '', plan: '' }
const LS = (patientId: string) => `agentix.doctor.soap.${patientId}`

function loadSoap(patientId: string): SoapDraft {
  if (typeof window === 'undefined') return EMPTY
  try { return { ...EMPTY, ...(JSON.parse(localStorage.getItem(LS(patientId)) ?? '{}') as Partial<SoapDraft>) } } catch { return EMPTY }
}
function saveSoap(patientId: string, s: SoapDraft) {
  try { localStorage.setItem(LS(patientId), JSON.stringify(s)) } catch { /* ignore */ }
}

export default function DoctorConsultation() {
  const router = useRouter()
  const currentUser = useAuthStore(s => s.currentUser)
  const patients = usePatientStore(s => s.patients)
  // Pick the first consulting / vitals patient as the "active" encounter.
  const active = useMemo(() =>
    patients.find(p => p.queueStatus === 'consulting') ??
    patients.find(p => p.queueStatus === 'vitals') ??
    patients[0],
  [patients])

  const addLabOrder = useLabOrdersStore(s => s.addOrder)

  const [soap, setSoap] = useState<SoapDraft>(EMPTY)
  const [hydrated, setHydrated] = useState(false)
  // Lab tests selected for the current encounter (catalog codes).
  const [labTests, setLabTests] = useState<string[]>([])
  const [labPick, setLabPick] = useState("")
  // Hydrate the SOAP draft and reset the lab basket whenever the patient changes.
  useEffect(() => {
    if (active) { setSoap(loadSoap(active.id)); setHydrated(true) }
    setLabTests([]); setLabPick("")
  }, [active?.id])

  if (!active) {
    return (
      <div className="max-w-4xl mx-auto pt-10 text-center">
        <Stethoscope className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <p className="text-[15px] font-semibold text-slate-700">No active patient.</p>
        <p className="text-[12.5px] text-slate-500 mt-1">Pick a patient from the queue to start a consultation.</p>
        <button onClick={() => router.push('/doctor/dashboard')} className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0E7490] hover:bg-[#0B5A6E] text-white text-[12.5px] font-semibold cursor-pointer">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </button>
      </div>
    )
  }

  function persist(next: SoapDraft) {
    setSoap(next)
    if (active) saveSoap(active.id, next)
  }

  function signNote() {
    if (!active) return
    notifyAndAudit({
      to: 'nurse', type: 'system', priority: 'low',
      title: `Note signed · ${active.name}`,
      body: `Doctor has signed the OPD note. Plan: ${soap.plan || 'see chart'}.`,
      patientName: active.name,
      audit: { action: 'prescription_create', resource: 'consultation_note', resourceId: active.id, detail: `SOAP signed for ${active.name}`, userName: currentUser?.name ?? 'Doctor' },
    })
    toast.success(`SOAP note signed for ${active.name} · nurse notified`)
  }

  function orderRx() {
    notifyAndAudit({
      to: 'pharmacy', type: 'medicines_ready', priority: 'high',
      title: `New Rx · ${active.name}`,
      body: `Doctor prescribed Rx for ${active.name}. Begin dispense workflow.`,
      patientName: active.name,
      audit: { action: 'prescription_create', resource: 'consultation', resourceId: active.id, detail: `Rx ordered for ${active.name}`, userName: currentUser?.name ?? 'Doctor' },
    })
    toast.success(`Rx sent · pharmacy notified`)
  }
  const addLabTest = () => {
    if (!labPick || labTests.includes(labPick)) return
    setLabTests(t => [...t, labPick])
    setLabPick("")
  }
  const removeLabTest = (code: string) => setLabTests(t => t.filter(c => c !== code))

  function orderLab() {
    if (!active) return
    if (labTests.length === 0) { toast.error('Select at least one test to order'); return }
    // Persist a real lab order so it lands in the Laboratory queue (awaiting collection).
    addLabOrder({
      patientId: active.id,
      patientName: active.name,
      source: 'OPD',
      doctorName: currentUser?.name ?? active.doctor ?? 'Doctor',
      paymentMode: 'Cash',
      testCodes: labTests,
    })
    notifyAndAudit({
      to: 'lab', type: 'system', priority: 'medium',
      title: `Lab order · ${active.name}`,
      body: `Doctor ordered ${labTests.length} test(s) for ${active.name}: ${labTests.map(c => LAB_CATALOG[c]?.name ?? c).join(', ')}. Assessment: ${soap.assessment || soap.plan || '—'}.`,
      patientName: active.name,
      audit: { action: 'lab_order', resource: 'consultation', resourceId: active.id, detail: `Lab ordered for ${active.name}`, userName: currentUser?.name ?? 'Doctor' },
    })
    toast.success(`${labTests.length} lab test(s) sent to Laboratory`)
    setLabTests([])
  }
  function orderImaging() {
    notifyAndAudit({
      to: 'radiology', type: 'system', priority: 'medium',
      title: `Imaging order · ${active.name}`,
      body: `Doctor ordered imaging for ${active.name}.`,
      patientName: active.name,
      audit: { action: 'radiology_order', resource: 'consultation', resourceId: active.id, detail: `Imaging ordered for ${active.name}`, userName: currentUser?.name ?? 'Doctor' },
    })
    toast.success(`Imaging ordered · radiology notified`)
  }
  function refer() {
    notifyAndAudit({
      to: 'reception', type: 'appointment', priority: 'medium',
      title: `Referral · ${active.name}`,
      body: `Doctor referred ${active.name} for specialist consultation. Please book a follow-up appointment.`,
      patientName: active.name,
      audit: { action: 'reception_registered', resource: 'referral', resourceId: active.id, detail: `Referral for ${active.name}`, userName: currentUser?.name ?? 'Doctor' },
    })
    toast.success(`Referral logged · reception notified`)
  }

  if (!hydrated) return null

  return (
    <div className="max-w-5xl mx-auto pb-10 space-y-4">
      {/* Patient header */}
      <div className="flex items-center gap-3 rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-4">
        <button onClick={() => router.push('/doctor/dashboard')} aria-label="Back" className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer">
          <ArrowLeft className="h-4 w-4 text-slate-500" />
        </button>
        <span className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#0E7490] to-[#1E97B2] flex items-center justify-center text-white text-[15px] font-bold">
          {active.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-bold text-slate-900">{active.name}</p>
          <p className="text-[12px] text-slate-500">{active.id} · {active.age}y · {active.gender} · {active.department}</p>
          {active.symptoms?.length ? <p className="text-[11.5px] text-slate-600 mt-0.5">Chief complaint: <b>{active.symptoms.join(', ')}</b></p> : null}
        </div>
        <span className="text-[10.5px] font-semibold text-[#0E7490] bg-[rgba(14,116,144,0.07)] border border-[rgba(14,116,144,0.15)] rounded-full px-2 py-0.5 inline-flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> AI scribe ready
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* SOAP note */}
        <div className="lg:col-span-2 rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#0E7490]" />
            <h3 className="text-[14px] font-semibold text-slate-900">SOAP note</h3>
            <span className="ml-auto text-[10.5px] text-slate-400">auto-saves as you type</span>
          </div>
          {(['subjective', 'objective', 'assessment', 'plan'] as const).map((k) => (
            <div key={k}>
              <label className="block text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 mb-1">{k}</label>
              <textarea value={soap[k]} onChange={(e) => persist({ ...soap, [k]: e.target.value })}
                rows={k === 'plan' ? 3 : 2}
                placeholder={k === 'subjective' ? 'Patient reports…' : k === 'objective' ? 'On examination…' : k === 'assessment' ? 'Most likely…' : 'Plan: Rx, labs, follow-up, red-flag advice…'}
                className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] focus:outline-none focus:ring-[#1E97B2] resize-none" />
            </div>
          ))}
          <button onClick={signNote} className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0E7490] hover:bg-[#0B5A6E] text-white text-[13.5px] font-semibold cursor-pointer">
            <Save className="h-4 w-4" /> Sign &amp; save SOAP
          </button>
        </div>

        {/* Quick-orders rail */}
        <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-4 space-y-2">
          <h3 className="text-[14px] font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#0E7490]" /> Quick orders
          </h3>
          <button onClick={orderRx} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(14,116,144,0.07)] hover:bg-[rgba(14,116,144,0.14)] text-[#0B5A6E] text-[12.5px] font-semibold cursor-pointer">
            <Pill className="h-4 w-4" /> Send Rx to pharmacy
          </button>
          <div className="rounded-lg bg-rose-50 p-2.5 space-y-2">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-rose-800">
              <FlaskConical className="h-4 w-4" /> Order labs
            </div>
            <div className="flex gap-1.5">
              <Select value={labPick} onChange={e => setLabPick(e.target.value)} className="flex-1 h-8 rounded-lg border border-rose-200 bg-white text-[12px] px-2 text-slate-700">
                <option value="">Select test…</option>
                {LAB_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
              </Select>
              <button onClick={addLabTest} aria-label="Add test" className="h-8 w-8 flex-shrink-0 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 flex items-center justify-center cursor-pointer">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {labTests.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {labTests.map(code => (
                  <span key={code} className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-800 bg-white border border-rose-200 rounded-full pl-2.5 pr-1.5 py-0.5">
                    {LAB_CATALOG[code]?.name ?? code}
                    <button onClick={() => removeLabTest(code)} aria-label={`Remove ${code}`} className="hover:text-rose-600 cursor-pointer"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <button onClick={orderLab} disabled={labTests.length === 0} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[12.5px] font-semibold cursor-pointer">
              <Send className="h-3.5 w-3.5" /> Send {labTests.length > 0 ? `${labTests.length} ` : ''}to Laboratory
            </button>
          </div>
          <button onClick={orderImaging} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(14,116,144,0.07)] hover:bg-[rgba(14,116,144,0.12)] text-[#0B5A6E] text-[12.5px] font-semibold cursor-pointer">
            <ScanLine className="h-4 w-4" /> Order imaging
          </button>
          <button onClick={refer} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[12.5px] font-semibold cursor-pointer">
            <Send className="h-4 w-4" /> Refer for specialist consult
          </button>
          <p className="text-[10.5px] text-slate-400 mt-2">Each action audited; the right role is notified.</p>
        </div>
      </div>
    </div>
  )
}
