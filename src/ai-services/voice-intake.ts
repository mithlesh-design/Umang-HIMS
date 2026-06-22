import { wrapAiResponse } from '@/lib/ai-helpers'
import type { AiEnvelope } from '@/types/ai'

export interface VoiceIntakeResult {
  extractedName?: string
  extractedAge?: number
  extractedGender?: 'Male' | 'Female' | 'Other'
  extractedSymptoms: string[]
  extractedDepartmentPreference?: string
  detectedLanguage: 'en' | 'hi'
  rawTranscript: string
}

const SYMPTOM_KEYWORDS: Record<string, string> = {
  'fever': 'Fever', 'बुखार': 'Fever',
  'headache': 'Headache', 'सिरदर्द': 'Headache',
  'chest pain': 'Chest Pain', 'सीने में दर्द': 'Chest Pain',
  'shortness of breath': 'Shortness of Breath', 'सांस': 'Shortness of Breath',
  'cough': 'Cough', 'खांसी': 'Cough',
  'nausea': 'Nausea / Vomiting', 'vomiting': 'Nausea / Vomiting', 'उल्टी': 'Nausea / Vomiting',
  'abdominal pain': 'Abdominal Pain', 'stomach pain': 'Abdominal Pain', 'पेट दर्द': 'Abdominal Pain',
  'dizziness': 'Dizziness', 'चक्कर': 'Dizziness',
  'back pain': 'Back Pain', 'कमर दर्द': 'Back Pain',
  'joint pain': 'Joint Pain', 'जोड़ों में दर्द': 'Joint Pain',
  'fatigue': 'Fatigue', 'tiredness': 'Fatigue', 'थकान': 'Fatigue',
  'skin rash': 'Skin Rash', 'rash': 'Skin Rash', 'चकत्ते': 'Skin Rash',
}

const DEPARTMENT_KEYWORDS: Record<string, string> = {
  'heart': 'Cardiology', 'cardio': 'Cardiology', 'cardiac': 'Cardiology', 'दिल': 'Cardiology',
  'bone': 'Orthopedics', 'ortho': 'Orthopedics', 'joint': 'Orthopedics', 'हड्डी': 'Orthopedics',
  'neuro': 'Neurology', 'brain': 'Neurology', 'nerve': 'Neurology', 'दिमाग': 'Neurology',
  'skin': 'Dermatology', 'derma': 'Dermatology', 'त्वचा': 'Dermatology',
  'ear': 'ENT', 'nose': 'ENT', 'throat': 'ENT', 'ent': 'ENT', 'कान': 'ENT',
  'eye': 'Ophthalmology', 'vision': 'Ophthalmology', 'आंख': 'Ophthalmology',
  'stomach': 'Gastroenterology', 'gastro': 'Gastroenterology', 'पेट': 'Gastroenterology',
  'general': 'General Medicine', 'medicine': 'General Medicine',
}

const HINDI_MARKERS = ['मेरा', 'मेरी', 'मुझे', 'है', 'हूं', 'हैं', 'और', 'दर्द', 'बुखार', 'खांसी', 'नाम']

function detectLanguage(text: string): 'en' | 'hi' {
  const lower = text.toLowerCase()
  return HINDI_MARKERS.some(m => lower.includes(m)) ? 'hi' : 'en'
}

function extractName(text: string): string | undefined {
  const enMatch = text.match(/(?:my name is|i am|i'm|name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
  if (enMatch) return enMatch[1]
  const hiMatch = text.match(/(?:मेरा नाम|नाम है|मैं)\s+([^\s,।]+(?:\s+[^\s,।]+)?)/i)
  if (hiMatch) return hiMatch[1]
  return undefined
}

function extractAge(text: string): number | undefined {
  const match = text.match(/(?:i am|i'm|age is|aged?|years? old|साल|उम्र|वर्ष)\s*(?:is\s*)?(\d{1,3})/i)
    ?? text.match(/(\d{1,3})\s*(?:years? old|साल|वर्ष)/i)
  if (match) {
    const age = parseInt(match[1])
    if (age >= 1 && age <= 120) return age
  }
  return undefined
}

function extractGender(text: string): 'Male' | 'Female' | 'Other' | undefined {
  const lower = text.toLowerCase()
  if (/\b(male|man|boy|husband|father|पुरुष|लड़का)\b/.test(lower)) return 'Male'
  if (/\b(female|woman|girl|wife|mother|महिला|लड़की)\b/.test(lower)) return 'Female'
  return undefined
}

export async function extractIntakeFromVoice(
  transcript: string,
  language: 'en' | 'hi',
): Promise<AiEnvelope<VoiceIntakeResult>> {
  await new Promise(r => setTimeout(r, 300))

  const lower = transcript.toLowerCase()

  const symptoms: string[] = []
  for (const [keyword, symptomName] of Object.entries(SYMPTOM_KEYWORDS)) {
    if (lower.includes(keyword) && !symptoms.includes(symptomName)) {
      symptoms.push(symptomName)
    }
  }

  let dept: string | undefined
  for (const [keyword, deptName] of Object.entries(DEPARTMENT_KEYWORDS)) {
    if (lower.includes(keyword)) { dept = deptName; break }
  }

  const detectedLang = detectLanguage(transcript) === 'hi' ? 'hi' : language

  const result: VoiceIntakeResult = {
    extractedName: extractName(transcript),
    extractedAge: extractAge(transcript),
    extractedGender: extractGender(transcript),
    extractedSymptoms: symptoms,
    extractedDepartmentPreference: dept,
    detectedLanguage: detectedLang,
    rawTranscript: transcript,
  }

  const fieldsFound = Object.entries(result)
    .filter(([k, v]) => k !== 'rawTranscript' && k !== 'detectedLanguage' && v !== undefined && (Array.isArray(v) ? v.length > 0 : true))
    .length

  return wrapAiResponse<VoiceIntakeResult>(
    result,
    0.75 + fieldsFound * 0.03,
    `Voice extraction from ${language.toUpperCase()} speech. Detected: ${fieldsFound} fields. Transcript: "${transcript.slice(0, 80)}…"`,
  )
}
