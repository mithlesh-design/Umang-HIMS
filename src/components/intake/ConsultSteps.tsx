"use client"

import { useState } from "react"
import { Building2, Video, Stethoscope, CalendarDays, Clock, Wallet, ShieldCheck, Smartphone, CreditCard, Store, CheckCircle, Loader2, User, FileText, Heart, HelpCircle, XCircle } from "lucide-react"
import { ChoiceStep } from "./ChoiceStep"
import { DOCTORS, SLOT_TIMES, INSURERS, upcomingDays, consultFee, type IntakeForm } from "@/lib/intake/data"
import { cn } from "@/lib/utils"
import { checkAbhaEligibility } from "@/lib/intake/abha-mock"
import type { AbhaEligibilityResult } from "@/lib/intake/abha-mock"

type Update = (patch: Partial<IntakeForm>) => void

// ── Consultation type ───────────────────────────────────────────────
const TYPES = [
  { value: 'in_person' as const, label: 'In-person visit', desc: 'Come to the hospital — vitals, doctor & pharmacy on-site', icon: Building2 },
  { value: 'video' as const, label: 'Online video consult', desc: 'Talk to a doctor from home over a video call', icon: Video },
]

export function ConsultTypeStep({ form, update }: { form: IntakeForm; update: Update }) {
  return (
    <div className="pt-2 space-y-3">
      {TYPES.map(t => {
        const Icon = t.icon
        const sel = form.consultationType === t.value
        return (
          <button key={t.value} onClick={() => update({ consultationType: t.value })} aria-pressed={sel}
            className={cn("w-full flex items-center gap-4 p-4 rounded-[20px] border text-left transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7490]",
              sel ? "bg-[#0E7490] border-[#0E7490] shadow-[0_8px_20px_rgba(14,116,144,0.25)]" : "bg-white border-slate-200")}>
            <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0", sel ? "bg-white/15" : "bg-[rgba(14,116,144,0.07)]")}>
              <Icon className={cn("h-6 w-6", sel ? "text-white" : "text-[#0E7490]")} aria-hidden="true" />
            </div>
            <div>
              <p className={cn("text-[17px] font-semibold", sel ? "text-white" : "text-slate-900")}>{t.label}</p>
              <p className={cn("text-[13px]", sel ? "text-[rgba(255,255,255,0.75)]" : "text-slate-400")}>{t.desc}</p>
            </div>
          </button>
        )
      })}
      <p className="text-[13px] text-slate-400 text-center pt-1">You can pay the consultation fee in the next steps.</p>
    </div>
  )
}

// ── Slot picker (video only) ────────────────────────────────────────
export function SlotStep({ form, update }: { form: IntakeForm; update: Update }) {
  const days = upcomingDays(4)
  return (
    <div className="h-full overflow-y-auto pr-1 pt-1 space-y-4">
      <div>
        <p className="text-[12px] uppercase text-slate-400 font-semibold ml-1 mb-2 tracking-wide">Choose a doctor</p>
        <div className="space-y-2">
          {DOCTORS.map(d => {
            const sel = form.slotDoctor === d.name
            return (
              <button key={d.id} onClick={() => update({ slotDoctor: d.name })} aria-pressed={sel}
                className={cn("w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl border text-left transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7490]",
                  sel ? "bg-[rgba(14,116,144,0.07)] border-[#1E97B2] ring-1 ring-blue-300" : "bg-white border-slate-200")}>
                <span className="h-10 w-10 rounded-full bg-[rgba(14,116,144,0.12)] flex items-center justify-center flex-shrink-0"><Stethoscope className="h-5 w-5 text-[#0E7490]" /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold text-slate-900">{d.name}</span>
                  <span className="block text-[12.5px] text-slate-500">{d.specialty}</span>
                </span>
                <span className="text-[13px] font-bold text-slate-700">₹{d.fee}</span>
                {sel && <CheckCircle className="h-5 w-5 text-[#0E7490] flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      </div>

      {form.slotDoctor && (
        <>
          <div>
            <p className="text-[12px] uppercase text-slate-400 font-semibold ml-1 mb-2 tracking-wide flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Date</p>
            <div className="flex flex-wrap gap-2">
              {days.map(d => (
                <button key={d.value} onClick={() => update({ slotDate: d.value })} aria-pressed={form.slotDate === d.value}
                  className={cn("px-4 py-2 rounded-xl text-[14px] font-medium border transition-all active:scale-95",
                    form.slotDate === d.value ? "bg-[#0E7490] border-[#0E7490] text-white" : "bg-white border-slate-200 text-slate-700")}>{d.label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[12px] uppercase text-slate-400 font-semibold ml-1 mb-2 tracking-wide flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Time</p>
            <div className="flex flex-wrap gap-2">
              {SLOT_TIMES.map(t => (
                <button key={t} onClick={() => update({ slotTime: t })} aria-pressed={form.slotTime === t}
                  className={cn("px-4 py-2 rounded-xl text-[14px] font-medium border transition-all active:scale-95",
                    form.slotTime === t ? "bg-[#0E7490] border-[#0E7490] text-white" : "bg-white border-slate-200 text-slate-700")}>{t}</button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Payment ─────────────────────────────────────────────────────────
export function PaymentStep({ form, update }: { form: IntakeForm; update: Update }) {
  const fee = consultFee(form)
  const isVideo = form.consultationType === 'video'
  const [checking, setChecking] = useState(false)
  const [govtChecking, setGovtChecking] = useState(false)
  const [govtResult, setGovtResult] = useState<AbhaEligibilityResult | null>(null)
  const [showAadhaarFallback, setShowAadhaarFallback] = useState(false)
  const [aadhaarNo, setAadhaarNo] = useState('')
  const methods = [
    { value: 'upi' as const, label: 'UPI', icon: Smartphone },
    { value: 'card' as const, label: 'Card', icon: CreditCard },
    ...(!isVideo ? [{ value: 'counter' as const, label: 'Pay at counter', icon: Store }] : []),
  ]
  const canVerify = !!form.insurer && form.policyId.trim().length >= 4 && form.policyHolder.trim().length > 0
  const verify = async () => { setChecking(true); await new Promise(r => setTimeout(r, 900)); update({ insuranceVerified: true }); setChecking(false) }

  const formatAbhaId = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 14)
    if (digits.length <= 2) return digits
    if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10)}`
  }

  const canVerifyGovt = form.abhaId.length >= 8 && form.ayushmanCardNo.trim().length >= 6
  const canVerifyAadhaar = aadhaarNo.replace(/\D/g, '').length === 12

  const verifyGovt = async (abhaId: string, cardNo: string) => {
    setGovtChecking(true)
    setGovtResult(null)
    const result = await checkAbhaEligibility(abhaId, cardNo)
    setGovtResult(result)
    if (result.eligible) {
      update({ govtSchemeVerified: true, schemeName: result.schemeName })
    } else {
      update({ govtSchemeVerified: false, schemeName: '' })
    }
    setGovtChecking(false)
  }

  const fieldCard = "bg-white rounded-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center gap-3 px-4 h-[50px] focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 transition-shadow"
  const fieldInput = "intake-input w-full h-full bg-transparent border-none text-slate-900 text-[15px] placeholder:text-slate-400"

  return (
    <div className="h-full overflow-y-auto pr-1 pt-1 space-y-4">
      {/* Fee card */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-[rgba(14,116,144,0.06)] border border-slate-200 p-4 flex items-center justify-between">
        <div>
          <p className="text-[12px] uppercase text-slate-400 font-semibold tracking-wide">Consultation fee</p>
          <p className="text-[13px] text-slate-500">{isVideo ? `${form.slotDoctor || 'Video consult'}` : `${form.departments[0] ?? 'OPD'} · in-person`}</p>
        </div>
        <p className="text-[26px] font-bold text-slate-900">
          {form.payer === 'cashless'
            ? <span className="text-[15px] font-bold text-[#0E7490]">Cashless</span>
            : form.payer === 'govtScheme'
              ? <span className="text-[14px] font-bold text-green-600">Cashless · {form.schemeName || 'Ayushman'}</span>
              : `₹${fee}`}
        </p>
      </div>

      {/* Payer */}
      <div>
        <p className="text-[12px] uppercase text-slate-400 font-semibold ml-1 mb-2 tracking-wide">How will you pay?</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            ['self', 'Self-pay', Wallet],
            ['cashless', 'Cashless', ShieldCheck],
            ['govtScheme', 'Govt Scheme', Heart],
          ] as const).map(([val, label, Icon]) => {
            const sel = form.payer === val
            const isGovt = val === 'govtScheme'
            return (
              <button
                key={val}
                onClick={() => update({ payer: val, govtSchemeVerified: false, schemeName: '' })}
                aria-pressed={sel}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7490]",
                  sel
                    ? isGovt ? "bg-green-600 border-green-600 text-white" : "bg-[#0E7490] border-[#0E7490] text-white"
                    : "bg-white border-slate-200 text-slate-700",
                )}
              >
                <Icon className={cn("h-5 w-5", sel ? "text-white" : isGovt ? "text-green-600" : "text-[#0E7490]")} />
                <span className="text-[12px] font-semibold text-center leading-tight">{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Self-pay → method */}
      {form.payer === 'self' && (
        <div>
          <p className="text-[12px] uppercase text-slate-400 font-semibold ml-1 mb-2 tracking-wide">Payment method</p>
          <div className="flex flex-wrap gap-2">
            {methods.map(m => {
              const Icon = m.icon
              const sel = form.payMethod === m.value
              return (
                <button key={m.value} onClick={() => update({ payMethod: m.value })} aria-pressed={sel}
                  className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-[14px] font-medium border transition-all active:scale-95",
                    sel ? "bg-[#0E7490] border-[#0E7490] text-white" : "bg-white border-slate-200 text-slate-700")}>
                  <Icon className="h-4 w-4" /> {m.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Cashless → insurer + policy details + verification */}
      {form.payer === 'cashless' && (
        <div className="space-y-3">
          <div>
            <p className="text-[12px] uppercase text-slate-400 font-semibold ml-1 mb-2 tracking-wide">Insurer / TPA</p>
            <ChoiceStep options={INSURERS.map(i => ({ value: i, label: i }))} value={form.insurer ? [form.insurer] : []} onChange={v => update({ insurer: v[0] ?? '', insuranceVerified: false })} multi={false} otherEnabled otherPlaceholder="Insurer / TPA name…" />
          </div>
          <div className={fieldCard}>
            <FileText className="h-5 w-5 text-slate-400 flex-shrink-0" aria-hidden="true" />
            <input className={fieldInput} placeholder="Policy / Member ID" aria-label="Policy or member ID" value={form.policyId} onChange={e => update({ policyId: e.target.value, insuranceVerified: false })} />
          </div>
          <div className={fieldCard}>
            <User className="h-5 w-5 text-slate-400 flex-shrink-0" aria-hidden="true" />
            <input className={fieldInput} placeholder="Policyholder name" aria-label="Policyholder name" value={form.policyHolder} onChange={e => update({ policyHolder: e.target.value, insuranceVerified: false })} />
            {form.name && form.policyHolder !== form.name && (
              <button onClick={() => update({ policyHolder: form.name, insuranceVerified: false })} className="text-[11px] font-semibold text-[#0E7490] whitespace-nowrap flex-shrink-0">Same as me</button>
            )}
          </div>

          {form.insuranceVerified ? (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-green-50 border border-green-200">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13.5px] font-bold text-green-900">Policy verified — {form.insurer}</p>
                <p className="text-[12.5px] text-green-700">Cashless eligible · pre-auth will be initiated. Nothing to pay now.</p>
              </div>
            </div>
          ) : (
            <>
              <button onClick={verify} disabled={!canVerify || checking}
                className={cn("w-full h-12 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
                  (!canVerify || checking) ? "bg-slate-200 text-slate-400" : "bg-[#0E7490] text-white")}>
                {checking ? <><Loader2 className="h-4.5 w-4.5 animate-spin" /> Checking with {form.insurer || 'insurer'}…</> : <><ShieldCheck className="h-4.5 w-4.5" /> Verify policy</>}
              </button>
              <p className="text-[12px] text-slate-400 ml-1">We confirm your policy is active &amp; cashless-eligible before you continue.</p>
            </>
          )}
        </div>
      )}

      {/* Govt Scheme → ABHA ID + Ayushman Card */}
      {form.payer === 'govtScheme' && (
        <div className="space-y-3">
          {/* ABHA ID */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <p className="text-[12px] uppercase text-slate-400 font-semibold tracking-wide">ABHA ID</p>
              <span title="14-digit Ayushman Bharat Health Account number from your ABHA card or DigiLocker">
                <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
              </span>
            </div>
            <div className={fieldCard}>
              <Heart className="h-5 w-5 text-green-500 flex-shrink-0" aria-hidden="true" />
              <input
                className={fieldInput}
                placeholder="14-XXXX-XXXX-XXXX"
                aria-label="ABHA ID"
                value={form.abhaId}
                onChange={e => {
                  update({ abhaId: formatAbhaId(e.target.value), govtSchemeVerified: false, schemeName: '' })
                  setGovtResult(null)
                }}
              />
            </div>
          </div>

          {/* Ayushman Card No */}
          <div className={fieldCard}>
            <ShieldCheck className="h-5 w-5 text-green-500 flex-shrink-0" aria-hidden="true" />
            <input
              className={fieldInput}
              placeholder="Ayushman Card / Family ID"
              aria-label="Ayushman Card or Family ID"
              value={form.ayushmanCardNo}
              onChange={e => {
                update({ ayushmanCardNo: e.target.value, govtSchemeVerified: false, schemeName: '' })
                setGovtResult(null)
              }}
            />
          </div>

          {/* Aadhaar fallback */}
          {showAadhaarFallback && (
            <div className={fieldCard}>
              <FileText className="h-5 w-5 text-slate-400 flex-shrink-0" aria-hidden="true" />
              <input
                className={fieldInput}
                placeholder="Aadhaar number (12 digits)"
                aria-label="Aadhaar number"
                value={aadhaarNo}
                onChange={e => setAadhaarNo(e.target.value.replace(/\D/g, '').slice(0, 12))}
              />
            </div>
          )}

          {/* Verified */}
          {form.govtSchemeVerified && govtResult?.eligible && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-green-50 border border-green-200">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13.5px] font-bold text-green-900">Eligible — {govtResult.schemeName}</p>
                <p className="text-[12.5px] text-green-700">{govtResult.coverage} · pre-auth ref: {govtResult.preAuthRef}</p>
                <p className="text-[11px] text-green-600 mt-0.5">Nothing to pay now.</p>
              </div>
            </div>
          )}

          {/* Not eligible */}
          {govtResult && !govtResult.eligible && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 space-y-2">
              <div className="flex items-start gap-2">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-bold text-red-800">Beneficiary not found</p>
                  <p className="text-[12px] text-red-600">Check your card number or try Aadhaar-linked search.</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setShowAadhaarFallback(true)}
                  className="text-[12px] font-semibold text-[#0E7490] underline underline-offset-2"
                >
                  Try Aadhaar-linked search
                </button>
                <span className="text-slate-300">·</span>
                <button
                  onClick={() => update({ payer: 'self', govtSchemeVerified: false, schemeName: '' })}
                  className="text-[12px] font-semibold text-slate-500 underline underline-offset-2"
                >
                  Pay myself instead
                </button>
              </div>
            </div>
          )}

          {/* Verify button — hidden once verified */}
          {!form.govtSchemeVerified && (
            <>
              <button
                onClick={() => showAadhaarFallback
                  ? verifyGovt(`aadhaar-${aadhaarNo}`, form.ayushmanCardNo)
                  : verifyGovt(form.abhaId, form.ayushmanCardNo)
                }
                disabled={showAadhaarFallback ? !canVerifyAadhaar : (!canVerifyGovt || govtChecking)}
                className={cn(
                  "w-full h-12 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
                  (showAadhaarFallback ? !canVerifyAadhaar : (!canVerifyGovt || govtChecking))
                    ? "bg-slate-200 text-slate-400"
                    : "bg-green-600 text-white hover:bg-green-700",
                )}
              >
                {govtChecking
                  ? <><Loader2 className="h-4.5 w-4.5 animate-spin" /> Checking with NHA…</>
                  : <><ShieldCheck className="h-4.5 w-4.5" /> Verify Ayushman eligibility</>}
              </button>
              <p className="text-[12px] text-slate-400 ml-1">We confirm your Ayushman beneficiary status before you continue.</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
