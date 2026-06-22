"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, User, Phone, Droplet, Calendar } from "lucide-react"
import { usePatientStore } from "@/store/usePatientStore"
import { useInpatientStore } from "@/store/useInpatientStore"
import { useERStore } from "@/store/useERStore"
import { PatientJourneyTimeline } from "@/components/clinical/PatientJourneyTimeline"
import { AppShell } from "@/components/layout/AppShell"

export default function PatientJourneyPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = use(params)
  const router = useRouter()
  const patient = usePatientStore(s => s.patients.find(p => p.id === patientId))
  const inpatient = useInpatientStore(s => s.inpatients.find(i => i.patientId === patientId))
  const erRecord  = useERStore(s => s.patients.find(e => e.patientId === patientId))
  const name = patient?.name ?? inpatient?.name ?? erRecord?.name ?? 'Unknown patient'
  const age  = patient?.age  ?? inpatient?.age  ?? erRecord?.age
  const gender = patient?.gender ?? inpatient?.gender ?? (erRecord?.gender === 'M' ? 'Male' : erRecord?.gender === 'F' ? 'Female' : undefined)
  const bg   = patient?.bloodGroup
  const phone = patient?.phone

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-900 cursor-pointer">
          <ArrowLeft className="h-4 w-4" />Back
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#0E7490] to-[#1E97B2] text-white flex items-center justify-center font-bold text-xl flex-shrink-0">
              {name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
              <p className="text-sm text-slate-500 mt-0.5">{patientId}</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-slate-600 flex-wrap">
                {age && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{age}y{gender ? ` · ${gender}` : ''}</span>}
                {bg && <span className="flex items-center gap-1"><Droplet className="h-3.5 w-3.5 text-red-400" />{bg}</span>}
                {phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{phone}</span>}
                {inpatient && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Admitted {new Date(inpatient.admittedAt).toLocaleDateString('en-IN')}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-base font-bold text-slate-900 mb-4">Full journey across departments</h2>
          <PatientJourneyTimeline patientId={patientId} patientName={name} variant="full" />
        </div>
      </div>
    </AppShell>
  )
}
