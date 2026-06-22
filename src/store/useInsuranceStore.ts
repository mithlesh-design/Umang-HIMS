import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useAuditStore } from './useAuditStore'

export type InsuranceClaimStatus = 'Pending Pre-Auth' | 'Approved' | 'Rejected' | 'In Process'
export type SubmissionStatus = 'not_submitted' | 'validating' | 'validated' | 'submitted' | 'acknowledged'
export type DocumentStatus = 'verified' | 'pending' | 'rejected'

export type AiValidationFlag = {
  field: string
  severity: 'ok' | 'warning' | 'error'
  message: string
}

export type AiClaimValidation = {
  completeness: number // 0–100
  flags: AiValidationFlag[]
  canSubmit: boolean
  validatedAt: string
}

// AI denial-risk score with explanation.
export type DenialRisk = {
  score: number          // 0–100, higher = riskier
  reasons: string[]
  factors: { label: string; impact: number }[]  // +ve = increases risk, -ve = decreases
  computedAt: string
}

export type ClaimDocument = {
  id: string
  name: string
  status: DocumentStatus
  uploadedAt?: string
  rejectionReason?: string
}

export type ClaimEvent = {
  at: string
  actor: string             // who logged it
  label: string             // human summary
  kind: 'submitted' | 'queried' | 'approved' | 'partially_approved' | 'rejected' | 'document' | 'note'
}

export type InsuranceClaim = {
  id: string
  patientId?: string
  patientName: string
  policyNumber?: string
  policyHolder?: string
  sumInsured?: number
  available?: number
  provider: string
  amount: number
  approvedAmount?: number
  status: InsuranceClaimStatus
  aiProbability?: number
  aiDenialRisk?: DenialRisk
  submissionStatus: SubmissionStatus
  aiValidation?: AiClaimValidation
  documents?: ClaimDocument[]
  timeline?: ClaimEvent[]
  submittedAt?: string
  tpaReferenceId?: string
  diagnosis?: string
  treatmentSummary?: string
}

interface InsuranceState {
  totalClaimsValue: number
  pendingApprovals: number
  claims: InsuranceClaim[]
  setValidation: (claimId: string, validation: AiClaimValidation) => void
  setSubmissionStatus: (claimId: string, status: SubmissionStatus, tpaRef?: string) => void
  setStatus: (claimId: string, status: InsuranceClaimStatus, opts?: { approvedAmount?: number; note?: string; actor?: string }) => void
  uploadDocument: (claimId: string, documentId: string) => void
  computeDenialRisk: (claimId: string) => void
  appendTimeline: (claimId: string, event: Omit<ClaimEvent, 'at'>) => void
}

const STANDARD_DOCS = (filled: boolean): ClaimDocument[] => [
  { id: 'doc-policy',     name: 'Policy copy',            status: filled ? 'verified' : 'verified' },
  { id: 'doc-admission',  name: 'Admission summary',      status: 'verified' },
  { id: 'doc-prescription', name: 'Doctor prescription',  status: 'verified' },
  { id: 'doc-discharge',  name: 'Discharge summary',      status: filled ? 'verified' : 'pending' },
  { id: 'doc-bill',       name: 'Final hospital bill',    status: 'pending' },
  { id: 'doc-receipts',   name: 'Pharmacy & lab receipts', status: 'pending' },
]

// Pure denial-risk heuristic — combines completeness, AI probability, amount banding,
// and provider history into a 0–100 score. Real systems would ML-model on historical data.
function computeRisk(c: InsuranceClaim): DenialRisk {
  const factors: { label: string; impact: number }[] = []
  let score = 50
  const ai = c.aiProbability ?? 70
  // AI approval probability lowers risk
  const probImpact = -Math.round((ai - 50) * 0.6)
  factors.push({ label: `AI approval prob ${ai}%`, impact: probImpact })
  score += probImpact

  // Document completeness
  const docs = c.documents ?? []
  const pending = docs.filter(d => d.status !== 'verified').length
  if (pending > 0) {
    factors.push({ label: `${pending} document(s) pending`, impact: pending * 8 })
    score += pending * 8
  }

  // High-value claims slightly riskier (TPA scrutiny)
  if (c.amount > 100000) { factors.push({ label: 'High-value claim (>₹1L)', impact: 10 }); score += 10 }
  if (c.amount > 250000) { factors.push({ label: 'Premium-value claim (>₹2.5L)', impact: 12 }); score += 12 }

  // Submission status — already submitted = risk locked in
  if (c.submissionStatus === 'submitted' || c.submissionStatus === 'acknowledged') {
    factors.push({ label: 'Already submitted to TPA', impact: -8 })
    score -= 8
  }

  // Diagnostic clarity — lacking diagnosis = +risk
  if (!c.diagnosis) { factors.push({ label: 'Diagnosis line missing', impact: 12 }); score += 12 }

  score = Math.max(0, Math.min(100, score))
  const reasons: string[] = []
  if (pending > 0) reasons.push('Pending documents reduce TPA confidence')
  if (c.amount > 250000) reasons.push('High-value claim attracts additional verification')
  if (!c.diagnosis) reasons.push('Diagnostic justification not yet captured')
  if (ai < 50) reasons.push('AI approval probability below baseline')
  if (reasons.length === 0) reasons.push('Risk is within normal band')

  return { score, reasons, factors, computedAt: new Date().toISOString() }
}

const SEED: InsuranceClaim[] = [
  {
    id: 'CLM-001', patientName: 'Aarav Sharma', provider: 'HDFC Ergo', amount: 45000,
    status: 'In Process', aiProbability: 98, submissionStatus: 'not_submitted',
    diagnosis: 'Acute appendicitis — laparoscopic appendectomy',
  },
  {
    id: 'CLM-002', patientName: 'Meena Devi', provider: 'Star Health', amount: 120000,
    status: 'Pending Pre-Auth', aiProbability: 45, submissionStatus: 'not_submitted',
    diagnosis: 'Suspected malignancy of the chest — CT-guided biopsy',
  },
  {
    id: 'CLM-003', patientName: 'Rahul Verma', provider: 'ICICI Lombard', amount: 35000,
    status: 'Approved', aiProbability: 99, submissionStatus: 'submitted', tpaReferenceId: 'ICICI-2026-78432',
    approvedAmount: 35000,
    diagnosis: 'Lower respiratory tract infection — IV antibiotics',
    documents: STANDARD_DOCS(true),
  },
  // Kiran Patil — default patient login, post-NSTEMI cashless claim
  {
    id: 'CLM-2026-0098', patientId: 'PT-20394', patientName: 'Kiran Patil',
    policyNumber: 'HDFC-ERGO-NCB-77820194', policyHolder: 'Kiran Patil',
    sumInsured: 500000, available: 320000,
    provider: 'HDFC ERGO', amount: 248500,
    status: 'In Process', aiProbability: 88,
    submissionStatus: 'validated',
    diagnosis: 'NSTEMI · PCI with drug-eluting stent (LAD)',
    treatmentSummary: 'Patient presented with chest pain; troponin elevated. Underwent successful PCI with DES placement in LAD. 2-day ICU stay, transitioned to ward, discharged on DAPT + statin + beta-blocker.',
    documents: [
      { id: 'doc-policy', name: 'Policy copy', status: 'verified', uploadedAt: new Date(Date.now() - 36 * 3600000).toISOString() },
      { id: 'doc-admission', name: 'Admission summary', status: 'verified', uploadedAt: new Date(Date.now() - 36 * 3600000).toISOString() },
      { id: 'doc-prescription', name: 'Doctor prescription', status: 'verified', uploadedAt: new Date(Date.now() - 30 * 3600000).toISOString() },
      { id: 'doc-cathlab', name: 'Cath-lab procedure report', status: 'verified', uploadedAt: new Date(Date.now() - 26 * 3600000).toISOString() },
      { id: 'doc-discharge', name: 'Discharge summary', status: 'pending' },
      { id: 'doc-bill', name: 'Final hospital bill', status: 'pending' },
    ],
    timeline: [
      { at: new Date(Date.now() - 36 * 3600000).toISOString(), actor: 'TPA Desk', label: 'Pre-authorisation requested for cardiac procedure', kind: 'submitted' },
      { at: new Date(Date.now() - 32 * 3600000).toISOString(), actor: 'HDFC ERGO', label: 'Pre-auth approved for cath-lab + 48h ICU', kind: 'approved' },
      { at: new Date(Date.now() - 24 * 3600000).toISOString(), actor: 'Insurance Desk', label: 'Stent invoice & implant sticker uploaded', kind: 'document' },
      { at: new Date(Date.now() - 18 * 3600000).toISOString(), actor: 'HDFC ERGO', label: 'Query: confirm stent batch # and BIS-approval cert', kind: 'queried' },
      { at: new Date(Date.now() - 12 * 3600000).toISOString(), actor: 'Insurance Desk', label: 'Replied with batch # and BIS cert', kind: 'note' },
    ],
  },
  // M13.3 — Anil Kumar Verma (IPD post-RTA) — ongoing cashless claim
  {
    id: 'CLM-2026-0102', patientId: 'PT-44012', patientName: 'Anil Kumar Verma',
    policyNumber: 'STAR-HEALTH-FAM-440126', policyHolder: 'Anil Kumar Verma',
    sumInsured: 700000, available: 510000,
    provider: 'Star Health', amount: 186400,
    status: 'In Process', aiProbability: 84,
    submissionStatus: 'validated',
    diagnosis: 'Polytrauma post-RTA · ORIF tibia + observation',
    treatmentSummary: 'RTA · tibial shaft fracture · ORIF with intramedullary nail. Observation for closed head injury. 5-day ward stay.',
    documents: [
      { id: 'doc-anil-policy', name: 'Policy copy', status: 'verified', uploadedAt: new Date(Date.now() - 48 * 3600000).toISOString() },
      { id: 'doc-anil-admission', name: 'Admission summary', status: 'verified', uploadedAt: new Date(Date.now() - 48 * 3600000).toISOString() },
      { id: 'doc-anil-mlc', name: 'MLC certificate', status: 'verified', uploadedAt: new Date(Date.now() - 40 * 3600000).toISOString() },
      { id: 'doc-anil-ot', name: 'OT notes', status: 'pending' },
      { id: 'doc-anil-bill', name: 'Final hospital bill', status: 'pending' },
    ],
    timeline: [
      { at: new Date(Date.now() - 48 * 3600000).toISOString(), actor: 'TPA Desk', label: 'Pre-authorisation requested for ORIF', kind: 'submitted' },
      { at: new Date(Date.now() - 44 * 3600000).toISOString(), actor: 'Star Health', label: 'Pre-auth approved for surgery + 5-day stay', kind: 'approved' },
      { at: new Date(Date.now() - 24 * 3600000).toISOString(), actor: 'Insurance Desk', label: 'MLC certificate uploaded', kind: 'document' },
    ],
  },
]

export const useInsuranceStore = create<InsuranceState>()(persist((set, get) => ({
  totalClaimsValue: 1250000,
  pendingApprovals: 8,
  claims: SEED,

  setValidation: (claimId, validation) =>
    set((s) => ({
      claims: s.claims.map(c =>
        c.id === claimId ? { ...c, aiValidation: validation, submissionStatus: 'validated' } : c
      ),
    })),

  setSubmissionStatus: (claimId, status, tpaRef) => {
    set((s) => ({
      claims: s.claims.map(c =>
        c.id === claimId
          ? { ...c, submissionStatus: status, submittedAt: status === 'submitted' ? new Date().toISOString() : c.submittedAt, tpaReferenceId: tpaRef ?? c.tpaReferenceId }
          : c
      ),
    }))
    if (status === 'submitted') {
      useAuditStore.getState().log({
        userId: 'INS-SYS', userName: 'Insurance Desk',
        action: 'insurance_claim_submitted', resource: 'claim', resourceId: claimId,
        detail: `Claim submitted${tpaRef ? ' · TPA ref ' + tpaRef : ''}`,
      })
    }
  },

  setStatus: (claimId, status, opts) =>
    set((s) => ({
      claims: s.claims.map(c => {
        if (c.id !== claimId) return c
        const kind: ClaimEvent['kind'] =
          status === 'Approved' ? 'approved'
          : status === 'Rejected' ? 'rejected'
          : 'note'
        const label = status === 'Approved'
          ? `Claim approved${opts?.approvedAmount ? ` for ₹${opts.approvedAmount.toLocaleString('en-IN')}` : ''}${opts?.note ? ` — ${opts.note}` : ''}`
          : status === 'Rejected'
            ? `Claim rejected${opts?.note ? ` — ${opts.note}` : ''}`
            : `Status changed to ${status}${opts?.note ? ` — ${opts.note}` : ''}`
        return {
          ...c,
          status,
          approvedAmount: status === 'Approved' ? (opts?.approvedAmount ?? c.amount) : c.approvedAmount,
          timeline: [
            ...(c.timeline ?? []),
            { at: new Date().toISOString(), actor: opts?.actor ?? 'Insurance Desk', label, kind },
          ],
        }
      }),
    })),

  uploadDocument: (claimId, documentId) =>
    set((s) => ({
      claims: s.claims.map(c => c.id !== claimId ? c : ({
        ...c,
        documents: (c.documents ?? []).map(d => d.id === documentId
          ? { ...d, status: 'verified', uploadedAt: new Date().toISOString() }
          : d),
      })),
    })),

  computeDenialRisk: (claimId) => {
    const claim = get().claims.find(c => c.id === claimId)
    if (!claim) return
    set((s) => ({
      claims: s.claims.map(c => c.id === claimId ? { ...c, aiDenialRisk: computeRisk(c) } : c),
    }))
  },

  appendTimeline: (claimId, event) =>
    set((s) => ({
      claims: s.claims.map(c => c.id !== claimId ? c : ({
        ...c,
        timeline: [...(c.timeline ?? []), { ...event, at: new Date().toISOString() }],
      })),
    })),
}),
  {
    name: 'agentix-insurancestore', version: 2,
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
  },
))
