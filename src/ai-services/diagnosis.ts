import { wrapAiResponse } from '@/lib/ai-helpers'
import type { AiEnvelope } from '@/types/ai'

export interface DiagnosisSuggestion {
  icdCode: string
  description: string
  probability: number
  supportingFindings: string[]
  ruledOutBy?: string[]
}

export async function suggestDiagnoses(
  notes: string,
  vitals: Record<string, string | number>
): Promise<AiEnvelope<DiagnosisSuggestion[]>> {
  await new Promise((r) => setTimeout(r, 600))
  void notes
  void vitals
  return wrapAiResponse<DiagnosisSuggestion[]>(
    [
      { icdCode: 'J18.9', description: 'Pneumonia, unspecified organism', probability: 0.62, supportingFindings: ['Fever 38.9°C', 'Productive cough', 'SpO2 91%', 'Crepitations L base'] },
      { icdCode: 'J45.901', description: 'Unspecified asthma with acute exacerbation', probability: 0.25, supportingFindings: ['Wheeze', 'History of childhood asthma'], ruledOutBy: ['No prior bronchodilator use', 'Fever present'] },
      { icdCode: 'I50.9', description: 'Heart failure, unspecified', probability: 0.13, supportingFindings: ['Pedal oedema', 'JVD'], ruledOutBy: ['No prior cardiac history'] },
    ],
    0.72,
    'Differential based on presenting vitals and clinical notes. Chest X-ray and CBC required to confirm.'
  )
}
