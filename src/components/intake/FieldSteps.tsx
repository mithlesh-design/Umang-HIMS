"use client"

import { motion, AnimatePresence } from "framer-motion"
import { User, Phone, AlertTriangle, CreditCard, Camera, CheckCircle, QrCode } from "lucide-react"
import { usePatientStore } from "@/store/usePatientStore"
import { ChoiceStep } from "./ChoiceStep"
import { INSURERS, type IntakeForm, type Gender } from "@/lib/intake/data"
import { cn } from "@/lib/utils"

type Update = (patch: Partial<IntakeForm>) => void

/** Name + mobile + age + gender on a single compact screen (no scroll, no autofocus). */
export function AboutStep({ form, update }: { form: IntakeForm; update: Update }) {
  const patients = usePatientStore(s => s.patients)
  const phone = form.phone.replace(/\D/g, '')
  const name = form.name.trim().toLowerCase()
  const duplicate = (phone.length < 6 && name.length < 3) ? null : (patients.find(p => {
    const pPhone = p.phone.replace(/\D/g, '')
    if (phone.length === 10 && pPhone === phone) return true
    if (phone.length >= 6 && pPhone.startsWith(phone.slice(0, 6)) && name.length >= 3) {
      return p.name.toLowerCase().includes(name.split(' ')[0])
    }
    return false
  }) ?? null)

  const rowCls = "flex items-center gap-3 px-4 h-[54px]"
  const inputCls = "intake-input w-full h-full bg-transparent border-none text-slate-900 text-[16px] placeholder:text-slate-400"

  return (
    <div className="space-y-3.5">
      <div className="bg-white rounded-[18px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] divide-y divide-slate-100 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 transition-shadow">
        <label className={rowCls}>
          <User className="h-5 w-5 flex-shrink-0 text-slate-400" aria-hidden="true" />
          <input className={inputCls} placeholder="Full name" aria-label="Full name" value={form.name} onChange={e => update({ name: e.target.value })} />
        </label>
        <label className={rowCls}>
          <Phone className="h-5 w-5 flex-shrink-0 text-slate-400" aria-hidden="true" />
          <input className={inputCls} placeholder="10-digit mobile number" aria-label="Mobile number" type="tel" inputMode="tel" maxLength={10} value={form.phone} onChange={e => update({ phone: e.target.value })} />
        </label>
        <label className={rowCls}>
          <span className="text-[12px] font-bold w-5 text-center flex-shrink-0 text-slate-400" aria-hidden="true">AGE</span>
          <input className={inputCls} placeholder="Age in years (1–120)" aria-label="Age in years" type="text" inputMode="numeric" maxLength={3} value={form.age} onChange={e => update({ age: e.target.value.replace(/\D/g, '') })} />
        </label>
      </div>

      <div>
        <p className="text-[12px] uppercase text-slate-400 font-semibold ml-1 mb-2 tracking-wide">Gender</p>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Gender">
          {(['Male', 'Female', 'Other'] as Gender[]).map(g => {
            const sel = form.gender === g
            return (
              <button
                key={g}
                onClick={() => update({ gender: g })}
                aria-pressed={sel}
                className={cn(
                  "h-12 rounded-[14px] text-[15px] font-semibold border transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7490]",
                  sel ? "bg-[#0E7490] border-[#0E7490] text-white shadow-[0_4px_12px_rgba(14,116,144,0.25)]" : "bg-white border-slate-200 text-slate-700"
                )}
              >
                {g}
              </button>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {duplicate && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-[14px]">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-[13px] font-bold text-amber-900">Possible match: {duplicate.name}</p>
              <p className="text-[12px] text-amber-700 mt-0.5">Registered as {duplicate.id}. Continue only if this is a different patient.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function InsuranceStep({ form, update }: { form: IntakeForm; update: Update }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0">
        <div className="bg-white rounded-[16px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center gap-3 px-4 h-[54px] focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 transition-shadow">
          <CreditCard className="h-5 w-5 flex-shrink-0 text-slate-400" aria-hidden="true" />
          <input className="intake-input w-full h-full bg-transparent border-none text-slate-900 text-[16px] placeholder:text-slate-400" placeholder="Health / Insurance card no." aria-label="Insurance card number" value={form.insuranceCardNo} onChange={e => update({ insuranceCardNo: e.target.value })} />
        </div>
        <p className="text-[12px] uppercase text-slate-400 font-semibold ml-1 mt-4 mb-2 tracking-wide">Your insurer <span className="text-amber-600 normal-case font-medium">· required</span></p>
      </div>
      <div className="flex-1 min-h-0">
        <ChoiceStep fill options={INSURERS.map(i => ({ value: i, label: i }))} value={form.insurer ? [form.insurer] : []} onChange={v => update({ insurer: v[0] ?? '' })} multi={false} otherEnabled otherPlaceholder="Insurer name…" />
      </div>
    </div>
  )
}

export function ReportsStep({ form, update }: { form: IntakeForm; update: Update }) {
  return (
    <div className="space-y-3">
      <button
        onClick={() => update({ hasReports: !form.hasReports })}
        aria-pressed={form.hasReports}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-4 rounded-[16px] transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7490]",
          form.hasReports ? "bg-[#0E7490] text-white shadow-[0_6px_16px_rgba(14,116,144,0.25)]" : "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        )}
      >
        <span className={cn("h-9 w-9 rounded-full flex items-center justify-center", form.hasReports ? "bg-white/20" : "bg-slate-100")}>
          {form.hasReports ? <CheckCircle className="h-5 w-5 text-white" aria-hidden="true" /> : <Camera className="h-5 w-5 text-slate-500" aria-hidden="true" />}
        </span>
        <span className="text-[16px] font-semibold">{form.hasReports ? 'Yes — I have old reports' : 'Yes, I have old reports'}</span>
      </button>
      <p className="text-[13px] text-slate-400 ml-1">Optional — you can skip and show them at the desk.</p>
    </div>
  )
}

export function FamilyStep({ form, update }: { form: IntakeForm; update: Update }) {
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-[16px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <button onClick={() => update({ dishaConsent: !form.dishaConsent })} aria-pressed={form.dishaConsent} className="w-full flex items-center justify-between px-4 py-3.5 focus:outline-none focus-visible:bg-[rgba(14,116,144,0.07)]/40">
          <span className="flex items-center gap-3">
            <span className={cn("h-9 w-9 rounded-full flex items-center justify-center", form.dishaConsent ? "bg-[rgba(14,116,144,0.12)]" : "bg-slate-100")}>
              <QrCode className={cn("h-5 w-5", form.dishaConsent ? "text-[#0E7490]" : "text-slate-500")} aria-hidden="true" />
            </span>
            <span className="text-left">
              <span className="block text-[15px] font-semibold text-slate-900">Yes, share with family</span>
              <span className="block text-[12px] text-slate-400 mt-0.5">DISHA compliant · non-clinical only</span>
            </span>
          </span>
          <span className={cn("h-6 w-11 rounded-full transition-colors flex-shrink-0", form.dishaConsent ? "bg-[rgba(14,116,144,0.07)]0" : "bg-slate-200")}>
            <span className={cn("block h-6 w-6 rounded-full bg-white shadow transition-transform", form.dishaConsent ? "translate-x-5" : "translate-x-0")} />
          </span>
        </button>
        <AnimatePresence>
          {form.dishaConsent && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden border-t border-slate-100">
              <div className="px-4 py-3 flex items-center gap-3">
                <Phone className="h-5 w-5 text-slate-400 flex-shrink-0" aria-hidden="true" />
                <input className="intake-input w-full bg-transparent border-none text-slate-900 text-[16px] placeholder:text-slate-400" placeholder="Family member's phone" type="tel" inputMode="tel" maxLength={10} aria-label="Family member's phone" value={form.familyPhone} onChange={e => update({ familyPhone: e.target.value })} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="text-[13px] text-slate-400 ml-1">Optional — tap Continue to skip.</p>
    </div>
  )
}
