"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, Send, BrainCircuit, ShieldAlert } from "lucide-react"
import { useInpatientStore } from "@/store/useInpatientStore"
import { useShiftStore, ALL_WARDS } from "@/store/useShiftStore"
import { runCopilot, type CopilotCtx } from "@/lib/copilotLLM"
import { WardSwitcher } from "@/components/nurse/ShiftBanner"
import { cn } from "@/lib/utils"

const QUICK_PROMPTS = [
  "Which rounds are due?",
  "Who are my most acute patients?",
  "Who's ready for discharge?",
  "Summarise Kiran Patil for handover",
  "Show current meds for Kiran Patil",
  "Who has diabetes?",
]

type Msg = { role: "user" | "ai"; text: string }

function Rich({ text }: { text: string }) {
  return <>{text.split("\n").map((line, i) => (
    <span key={i} className="block min-h-[2px]">{line.split(/(\*\*[^*]+\*\*)/g).map((s, j) => /^\*\*[^*]+\*\*$/.test(s) ? <strong key={j} className="font-bold">{s.slice(2, -2)}</strong> : <span key={j}>{s}</span>)}</span>
  ))}</>
}

export default function NurseAiAssistant() {
  const inpatients = useInpatientStore(s => s.inpatients)
  const activeWard = useShiftStore(s => s.activeWard)
  const nurseName = useShiftStore(s => s.currentNurseName)
  const wardInpatients = useMemo(() => inpatients.filter(i => activeWard === ALL_WARDS || i.ward === activeWard), [inpatients, activeWard])

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }) }, [messages.length, thinking])

  const send = (raw: string) => {
    const text = raw.trim()
    if (!text || thinking) return
    setMessages(m => [...m, { role: "user", text }])
    setInput("")
    setThinking(true)
    const ctx: CopilotCtx = { patients: [], visits: [], inpatients: wardInpatients, focusId: null, doctorName: nurseName }
    setTimeout(() => {
      const reply = runCopilot(text, ctx)
      const body = reply.draft ? `${reply.text}\n\n${reply.draft.content}` : reply.text
      setMessages(m => [...m, { role: "ai", text: body }])
      setThinking(false)
    }, 500)
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#0E7490] to-[#0B5A6E] flex items-center justify-center shadow-sm"><BrainCircuit className="h-4.5 w-4.5 text-white" /></span>
          <div>
            <h1 className="text-[15.5px] font-bold text-slate-900 leading-tight">Nursing Copilot</h1>
            <p className="text-[11px] text-slate-400">Grounded in {wardInpatients.length} patient(s) · {activeWard}</p>
          </div>
        </div>
        <WardSwitcher />
      </div>

      <section className="flex-1 flex flex-col min-w-0 rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 min-h-0 bg-[#FBFBFE]">
          {messages.length === 0 && !thinking ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto px-4">
              <span className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#0E7490] to-[#0B5A6E] flex items-center justify-center shadow-lg mb-4"><Sparkles className="h-7 w-7 text-white" /></span>
              <h2 className="text-[20px] font-bold text-slate-900">Your nursing copilot</h2>
              <p className="text-[13.5px] text-slate-500 mt-1.5 leading-relaxed">Ask about your ward — acuity, rounds, meds, vitals, discharges — or get a handover summary. Grounded in the live record.</p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {QUICK_PROMPTS.map(p => (
                  <button key={p} onClick={() => send(p)} className="text-[12.5px] font-medium text-slate-600 bg-white border border-slate-200 rounded-full px-3.5 py-2 hover:border-[rgba(14,116,144,0.30)] hover:text-[#0E7490] hover:bg-[rgba(14,116,144,0.10)] transition cursor-pointer">{p}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role === "ai" && <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#0E7490] to-[#0B5A6E] flex items-center justify-center flex-shrink-0 mt-0.5"><BrainCircuit className="h-4 w-4 text-white" /></span>}
                  <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed", m.role === "user" ? "bg-[#0E7490] text-white rounded-br-md" : "bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm")}>
                    <Rich text={m.text} />
                  </div>
                </motion.div>
              ))}
              {thinking && (
                <div className="flex gap-2.5 justify-start">
                  <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#0E7490] to-[#0B5A6E] flex items-center justify-center flex-shrink-0"><BrainCircuit className="h-4 w-4 text-white animate-pulse" /></span>
                  <div className="rounded-2xl rounded-bl-md bg-white border border-slate-200 px-4 py-3 shadow-sm flex items-center gap-1">
                    {[0, 1, 2].map(i => <span key={i} className="h-1.5 w-1.5 rounded-full bg-[#1E97B2] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 px-4 py-3 bg-white">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) } }} rows={1}
              placeholder="Ask about your ward, a patient, meds, or a handover summary…"
              className="flex-1 resize-none max-h-32 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[14px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-[rgba(14,116,144,0.30)] focus:ring-2 focus:ring-blue-100" />
            <button onClick={() => send(input)} disabled={!input.trim() || thinking} aria-label="Send"
              className="h-11 w-11 flex-shrink-0 rounded-2xl bg-gradient-to-br from-[#0E7490] to-[#0B5A6E] text-white flex items-center justify-center disabled:opacity-40 hover:opacity-95 transition cursor-pointer"><Send className="h-4.5 w-4.5" /></button>
          </div>
          <p className="text-[10.5px] text-slate-400 mt-2 flex items-center justify-center gap-1.5"><ShieldAlert className="h-3 w-3" /> AI · answers drawn from the live ward record · verify before acting</p>
        </div>
      </section>
    </div>
  )
}
