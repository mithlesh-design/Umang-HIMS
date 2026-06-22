"use client"

import { CheckCircle, AlertTriangle, Clock, Package, ShoppingCart, Bed, Pill, Droplets, Activity, Sparkles } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { usePharmacyStore } from "@/store/usePharmacyStore"
import { useInpatientStore, type Inpatient } from "@/store/useInpatientStore"
import { useShiftStore, ALL_WARDS } from "@/store/useShiftStore"
import { WardSwitcher } from "@/components/nurse/ShiftBanner"
import { buildMar, slotStatus, type MarSlot, type MarStatus } from "@/lib/mar"
import { AdministerModal } from "@/components/nurse/AdministerModal"
import { NeonBadge } from "@/components/ui/neon-badge"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { useAuthStore } from "@/store/useAuthStore"

const STATUS_CONFIG: Record<MarStatus, { color: string; icon: React.ElementType; label: string }> = {
  given:     { color: 'text-green-600 bg-green-50',   icon: CheckCircle,   label: 'Given' },
  held:      { color: 'text-orange-600 bg-orange-50', icon: AlertTriangle, label: 'Held' },
  missed:    { color: 'text-red-600 bg-red-50',       icon: AlertTriangle, label: 'Missed' },
  due:       { color: 'text-amber-600 bg-amber-50',   icon: Clock,         label: 'Due' },
  scheduled: { color: 'text-slate-500 bg-slate-100',  icon: Clock,         label: 'Scheduled' },
  running:   { color: 'text-[#0E7490] bg-[rgba(14,116,144,0.07)]',     icon: Droplets,      label: 'Running' },
  prn:       { color: 'text-[#0E7490] bg-[rgba(14,116,144,0.07)]', icon: Pill,          label: 'PRN' },
}
const ORDER: Record<MarStatus, number> = { missed: 0, due: 1, prn: 2, running: 3, scheduled: 4, held: 5, given: 6 }

export default function MedicationMAR() {
  const { prescriptions, requestProcurement } = usePharmacyStore()
  const allInpatients = useInpatientStore(s => s.inpatients)
  const activeWard = useShiftStore(s => s.activeWard)
  const inpatients = allInpatients.filter(i => activeWard === ALL_WARDS || i.ward === activeWard)
  const administerMed = useInpatientStore(s => s.administerMed)
  const currentUser = useAuthStore(s => s.currentUser)
  const [activeTab, setActiveTab] = useState<'mar' | 'ipd'>('mar')
  const [admin, setAdmin] = useState<{ slot: MarSlot; ip: Inpatient } | null>(null)

  // Compute "now" only after mount to avoid SSR/client time mismatch.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => { const d = new Date(); setNow(d.getHours() * 60 + d.getMinutes()) }, [])
  const nowMin = now ?? -1

  const ipdPending = prescriptions.filter(p => p.procurementStatus === 'deferred_ipd')
  const ipdRequested = prescriptions.filter(p => p.procurementStatus === 'procurement_requested')

  const rows = useMemo(() => {
    const slots = buildMar(inpatients)
    return slots.map(slot => {
      const ip = inpatients.find(i => i.patientId === slot.patientId)!
      const { status, rec } = slotStatus(slot, ip.mar, nowMin)
      return { slot, ip, status, rec }
    }).sort((a, b) =>
      (ORDER[a.status] - ORDER[b.status]) ||
      a.slot.patientName.localeCompare(b.slot.patientName) ||
      ((a.slot.scheduledMin ?? 9999) - (b.slot.scheduledMin ?? 9999)),
    )
  }, [inpatients, nowMin])

  const missedCount = rows.filter(r => r.status === 'missed').length
  const dueCount = rows.filter(r => r.status === 'due').length

  const nurseName = currentUser?.name ?? 'Nurse'
  const doAdminister = (note?: string) => {
    if (!admin) return
    administerMed(admin.ip.patientId, { medName: admin.slot.medName, slot: admin.slot.slot, action: 'given', note })
    notifyAndAudit({
      to: 'doctor', type: 'system', priority: note ? 'high' : 'low',
      title: `Med given · ${admin.slot.medName} · ${admin.slot.patientName}`,
      body: `${admin.slot.medName} ${admin.slot.dose} ${admin.slot.route} administered to ${admin.slot.patientName} (${admin.slot.ward} ${admin.slot.bed}) at ${admin.slot.slot} by ${nurseName}${note ? ` — ${note}` : ''}.`,
      patientName: admin.slot.patientName,
      audit: { action: 'nurse_med_administered', resource: 'mar_slot', resourceId: `${admin.ip.patientId}:${admin.slot.medName}:${admin.slot.slot}`, detail: `${admin.slot.medName} given to ${admin.slot.patientName}${note ? ` · ${note}` : ''}`, userName: nurseName },
    })
    toast.success(`${admin.slot.medName} administered to ${admin.slot.patientName}${note ? ' (override logged)' : ''}`)
  }
  const doHold = (note?: string) => {
    if (!admin) return
    administerMed(admin.ip.patientId, { medName: admin.slot.medName, slot: admin.slot.slot, action: 'held', note })
    notifyAndAudit({
      to: 'doctor', type: 'system', priority: 'medium',
      title: `Med held · ${admin.slot.medName} · ${admin.slot.patientName}`,
      body: `${admin.slot.medName} held for ${admin.slot.patientName} (${admin.slot.ward} ${admin.slot.bed}) at ${admin.slot.slot} by ${nurseName}${note ? ` — ${note}` : ''}.`,
      patientName: admin.slot.patientName,
      audit: { action: 'nurse_med_administered', resource: 'mar_slot', resourceId: `${admin.ip.patientId}:${admin.slot.medName}:${admin.slot.slot}`, detail: `${admin.slot.medName} held for ${admin.slot.patientName}${note ? ` · ${note}` : ''}`, userName: nurseName },
    })
    toast(`${admin.slot.medName} held for ${admin.slot.patientName}`)
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Medication Administration</h2>
          <p className="text-slate-500 text-sm mt-1">{activeWard} · live MAR from the doctor&apos;s active orders</p>
        </div>
        <WardSwitcher />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-xl w-fit" style={{ background: '#F1F5F9' }}>
        {[
          { key: 'mar', label: 'MAR', count: dueCount + missedCount },
          { key: 'ipd', label: 'IPD Procurement', count: ipdPending.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as 'mar' | 'ipd')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer",
              activeTab === tab.key ? 'bg-white text-[#0F172A] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", activeTab === tab.key ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-500')}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'mar' && (
        <>
          {/* AI missed-dose alert */}
          {missedCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800 font-semibold flex items-center gap-2" role="alert">
              <Sparkles className="h-4 w-4 flex-shrink-0 text-red-600" />
              AI alert: {missedCount} dose{missedCount > 1 ? 's' : ''} overdue / missed — administer or document a reason.
            </div>
          )}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            5-rights and allergy/interaction checks run automatically at administration.
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{['Patient', 'Bed', 'Drug', 'Route', 'Time', 'Status', 'By', 'Action'].map(h => (
                  <th key={h} scope="col" className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ slot, ip, status, rec }) => {
                  const cfg = STATUS_CONFIG[status]
                  const Icon = cfg.icon
                  const actionable = status === 'due' || status === 'missed' || status === 'prn'
                  return (
                    <tr key={slot.key} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-800">{slot.patientName}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{slot.ward} · {slot.bed}</td>
                      <td className="px-4 py-3 font-medium">{slot.medName} {slot.dose}</td>
                      <td className="px-4 py-3 text-slate-500">{slot.route}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{slot.slot}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${cfg.color}`}>
                          <Icon className="h-3 w-3" /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {rec ? `${rec.by} @ ${new Date(rec.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {actionable && (
                          <button onClick={() => setAdmin({ slot, ip })} className="px-3 py-1.5 text-xs font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">
                            {status === 'prn' ? 'Give PRN' : 'Administer'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" /> No active medication orders on the ward.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'ipd' && (
        <div className="space-y-6">
          <div className="bg-[rgba(14,116,144,0.07)] border border-[rgba(14,116,144,0.20)] rounded-xl p-3 text-sm text-[#0B5A6E] font-semibold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 flex-shrink-0" />
            IPD prescriptions are held until the ward nursing staff confirms the patient has arrived and procurement is required
          </div>

          {ipdRequested.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" /> Requested — Pharmacy Preparing ({ipdRequested.length})
              </h3>
              <div className="space-y-3">
                {ipdRequested.map(rx => (
                  <div key={rx.id} className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-slate-900">{rx.patientName}</p>
                          {rx.wardBed && <span className="flex items-center gap-1 text-xs text-slate-500"><Bed className="h-3 w-3" />{rx.wardBed}</span>}
                          <NeonBadge variant="warning">Requested</NeonBadge>
                        </div>
                        <div className="space-y-1 mt-2">
                          {rx.medicines.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                              <Package className="h-3 w-3 text-orange-500 flex-shrink-0" />
                              {m.name} — {m.dosage}
                            </div>
                          ))}
                        </div>
                      </div>
                      <CheckCircle className="h-5 w-5 text-orange-400 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ipdPending.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-[#0E7490]" /> Pending Your Request ({ipdPending.length})
              </h3>
              <div className="space-y-3">
                {ipdPending.map(rx => (
                  <div key={rx.id} className="bg-white border border-[rgba(14,116,144,0.15)] rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-bold text-slate-900">{rx.patientName}</p>
                          {rx.wardBed && <span className="flex items-center gap-1 text-xs text-slate-500"><Bed className="h-3 w-3" />{rx.wardBed}</span>}
                          {rx.triageLevel && <NeonBadge variant={rx.triageLevel === 'Critical' ? 'danger' : rx.triageLevel === 'High' ? 'warning' : 'muted'}>{rx.triageLevel}</NeonBadge>}
                        </div>
                        <p className="text-xs text-slate-400 mb-2">{rx.doctorName} · {rx.department}</p>
                        <div className="space-y-1">
                          {rx.medicines.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                              <Package className="h-3.5 w-3.5 text-[#0E7490] flex-shrink-0" />
                              {m.name} — {m.dosage} · {m.frequency}
                            </div>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          requestProcurement(rx.id)
                          toast.success(`Procurement requested for ${rx.patientName} — pharmacy notified`)
                        }}
                        className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl cursor-pointer transition-all"
                        style={{ background: 'linear-gradient(135deg,#0E7490,#0E7490)', boxShadow: '0 2px 8px rgba(14,116,144,0.25)' }}
                      >
                        <ShoppingCart className="h-4 w-4" /> Request Procurement
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ipdPending.length === 0 && ipdRequested.length === 0 && (
            <div className="py-12 text-center">
              <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-500">No IPD procurement items</p>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {admin && (
          <AdministerModal
            slot={admin.slot}
            allergies={admin.ip.allergies}
            comorbidities={admin.ip.comorbidities}
            onClose={() => setAdmin(null)}
            onAdminister={doAdminister}
            onHold={doHold}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
