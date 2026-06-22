import { wrapAiResponse } from '@/lib/ai-helpers'
import type { AiEnvelope } from '@/types/ai'

export interface TriageAssessment {
  esiLevel: 1 | 2 | 3 | 4 | 5
  label: string
  color: string
  expectedWaitMinutes: number
  immediateActions: string[]
  reasoning: string
}

export async function assessTriage(
  vitals: Record<string, string | number>,
  chiefComplaint: string
): Promise<AiEnvelope<TriageAssessment>> {
  await new Promise((r) => setTimeout(r, 300))
  void vitals
  void chiefComplaint
  return wrapAiResponse<TriageAssessment>(
    {
      esiLevel: 2,
      label: 'Emergent',
      color: '#EF4444',
      expectedWaitMinutes: 10,
      immediateActions: ['12-lead ECG within 10 min', 'IV access × 2', 'Troponin + D-Dimer STAT', 'Cardiac monitor'],
      reasoning: 'Chest pain with SpO2 <94% and diaphoresis — high-risk features for ACS. ESI-2 warranted.',
    },
    0.89,
    'Vital sign pattern matches ESI-2 criteria (high risk, requires immediate evaluation).'
  )
}
