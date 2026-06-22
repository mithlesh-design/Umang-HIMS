"use client"

import Link from "next/link"
import { useWard } from "@/lib/useWard"
import { useShiftStore } from "@/store/useShiftStore"
import { WardSwitcher } from "@/components/nurse/ShiftBanner"
import { Bed, AlertCircle, ChevronRight } from "lucide-react"
import { NeonBadge } from "@/components/ui/neon-badge"
import { Card } from "@/components/ui/card"

export default function NursePatientsPage() {
  const { patients } = useWard()
  const activeWard = useShiftStore(s => s.activeWard)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">My Ward</h1>
          <p className="text-sm text-[#64748B] mt-1">{activeWard} · patients under nursing care this shift</p>
        </div>
        <WardSwitcher />
      </div>

      {patients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Bed className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-base font-semibold">No patients in {activeWard}</p>
          <p className="text-sm mt-1">Switch ward above, or patients will appear here when admitted</p>
        </div>
      ) : (
        <div className="space-y-3">
          {patients.map(patient => (
            <Link key={patient.id} href={`/nurse/patients/${patient.id}`} className="block">
            <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0">
                    <Bed className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[#0F172A]">{patient.name}</h3>
                      <NeonBadge
                        variant={patient.condition === 'Critical' ? 'danger' : patient.condition === 'Stable' ? 'success' : 'warning'}
                      >
                        {patient.condition}
                      </NeonBadge>
                      {patient.news && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          patient.news.band === 'high' ? 'bg-red-100 text-red-700'
                            : patient.news.band === 'medium' ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          NEWS {patient.news.score}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#64748B] mt-0.5 flex items-center gap-1">
                      <Bed className="h-3.5 w-3.5" /> {patient.bedNumber}
                    </p>
                  </div>
                </div>

                <div className="hidden md:grid grid-cols-4 gap-6 text-center">
                  {[
                    { label: 'HR',   value: `${patient.vitals.hr} bpm`, abnormal: patient.vitals.hr > 100 },
                    { label: 'BP',   value: patient.vitals.bp,           abnormal: false },
                    { label: 'SpO2', value: `${patient.vitals.spo2}%`,   abnormal: patient.vitals.spo2 < 95 },
                    { label: 'Temp', value: `${patient.vitals.temp}°F`,  abnormal: patient.vitals.temp > 100 },
                  ].map(({ label, value, abnormal }) => (
                    <div key={label}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">{label}</p>
                      <p className={`text-sm font-bold mt-0.5 ${abnormal ? 'text-red-600' : 'text-[#0F172A]'}`}>{value}</p>
                    </div>
                  ))}
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-[#64748B]">Last checked</p>
                  <p className="text-sm font-bold text-[#0F172A]">{patient.lastChecked}</p>
                  {patient.aiAlert && (
                    <div className="flex items-center gap-1 mt-1 text-xs font-bold text-red-600">
                      <AlertCircle className="h-3 w-3" /> {patient.aiAlert}
                    </div>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 ml-2 flex-shrink-0" />
              </div>
            </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
