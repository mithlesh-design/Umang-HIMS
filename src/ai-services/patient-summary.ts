import { wrapAiResponse } from '@/lib/ai-helpers'
import type { AiEnvelope } from '@/types/ai'

export interface PatientSummary { patientId: string; headline: string; activeProblems: string[]; keyMetrics: Array<{ label: string; value: string; trend: 'up' | 'down' | 'stable' }>; nextActions: string[] }
export async function generatePatientSummary(patientId: string): Promise<AiEnvelope<PatientSummary>> {
  await new Promise((r) => setTimeout(r, 350))
  return wrapAiResponse<PatientSummary>({ patientId, headline: '52M with T2DM and Hypertension, admitted with CAP — Day 4, improving.', activeProblems: ['Community Acquired Pneumonia (resolving)', 'Type 2 Diabetes Mellitus (poorly controlled)', 'Hypertension (controlled)', 'CKD Stage 3'], keyMetrics: [{ label: 'SpO2', value: '97% RA', trend: 'up' }, { label: 'WBC', value: '11,200', trend: 'down' }, { label: 'Blood Glucose', value: '142 mg/dL', trend: 'down' }], nextActions: ['Plan for discharge tomorrow', 'Discharge medications to be reconciled', 'Follow-up appointments to be booked'] }, 0.88, 'Summary synthesised from active problems list, vitals trends, and clinical notes.')
}
