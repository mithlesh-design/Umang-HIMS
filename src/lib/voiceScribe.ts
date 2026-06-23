// Ambient voice scribe. Dictation uses the browser's Web Speech API
// (feature-detected, graceful fallback). `toSOAP` turns a free-text/dictated
// note into a structured S/O/A/P note the doctor can refine.

/* eslint-disable @typescript-eslint/no-explicit-any */

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
}

export type Recognition = { stop: () => void }

const browserLang = () =>
  typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US'

// Starts continuous dictation; `onText` receives finalised chunks. Returns a
// handle to stop, or null if unsupported / failed to start.
export function startDictation(onText: (chunk: string) => void, onEnd: () => void): Recognition | null {
  const SR = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null
  if (!SR) return null
  let rec: any
  try { rec = new SR() } catch { return null }
  rec.continuous = true
  rec.interimResults = false
  rec.lang = browserLang()
  rec.onresult = (e: any) => {
    let text = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) text += e.results[i][0].transcript
    }
    if (text.trim()) onText(text.trim())
  }
  rec.onend = onEnd
  // 'aborted' fires when stop() is called — treat it the same as natural end.
  rec.onerror = (e: any) => { if ((e?.error || '') !== 'aborted') onEnd() }
  try { rec.start() } catch { return null }
  return { stop: () => { try { rec.stop() } catch { /* ignore */ } } }
}

// Voice-command dictation for search/assistant: a SINGLE utterance with live
// interim text and explicit error reporting. `onPartial` streams the running
// transcript (replace the input); `onFinal` fires once with the complete phrase
// when the user stops (use it to auto-submit). `onError` surfaces problems like
// blocked-mic ('not-allowed') or 'no-speech' so the UI isn't silently dead.
export function startVoiceCommand(opts: {
  onPartial?: (text: string) => void
  onFinal: (text: string) => void
  onError?: (err: string) => void
  onEnd?: () => void
  lang?: string
}): Recognition | null {
  const SR = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null
  if (!SR) { opts.onError?.('unsupported'); return null }
  let rec: any
  try { rec = new SR() } catch { opts.onError?.('init-failed'); return null }
  rec.continuous = false
  rec.interimResults = true
  rec.lang = opts.lang ?? browserLang()
  let finalText = ''
  rec.onresult = (e: any) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript
      if (e.results[i].isFinal) finalText += t
      else interim += t
    }
    opts.onPartial?.((finalText + interim).trim())
  }
  rec.onerror = (e: any) => {
    const err: string = e?.error || 'error'
    // 'aborted' fires in Chrome when stop() is called or when recognition ends
    // after silence — it is not a real failure. 'no-speech' is also expected.
    // Only propagate errors that actually need user attention.
    if (err !== 'aborted' && err !== 'no-speech') opts.onError?.(err)
  }
  rec.onend = () => { const t = finalText.trim(); if (t) opts.onFinal(t); opts.onEnd?.() }
  try { rec.start() } catch { opts.onError?.('start-failed'); return null }
  return { stop: () => { try { rec.stop() } catch { /* ignore */ } } }
}

export function toSOAP(text: string, opts: { diagnosis?: string; vitals?: string }): string {
  const t = text.trim()
  return [
    `S (Subjective): ${t || '—'}`,
    `O (Objective): ${opts.vitals ? opts.vitals : 'Examination findings / vitals — to complete.'}`,
    `A (Assessment): ${opts.diagnosis?.trim() || 'Working diagnosis — to complete.'}`,
    `P (Plan): Investigations / medications as ordered above; follow-up and red-flag advice given.`,
  ].join('\n')
}
