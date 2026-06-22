"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Volume2, FlaskConical, User, Clock, Droplet, AlertTriangle, CheckCircle2,
  Barcode, X, ChevronRight, Activity, Phone, ShieldX,
} from "lucide-react"
import { useLabOrdersStore, type LabOrder, type LabSource } from "@/store/useLabOrdersStore"
import { useAuthStore } from "@/store/useAuthStore"
import { LAB_CATALOG, type Priority } from "@/lib/labCatalog"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const SOURCE_TINT: Record<LabSource, string> = {
  OPD: 'bg-[rgba(14,116,144,0.07)] text-[#0E7490] border-[rgba(14,116,144,0.20)]',
  IPD: 'bg-[rgba(14,116,144,0.07)] text-[#0E7490] border-indigo-200',
  ICU: 'bg-red-50 text-red-700 border-red-200',
  OT:  'bg-[rgba(14,116,144,0.07)] text-[#0E7490] border-[rgba(14,116,144,0.20)]',
  ER:  'bg-orange-50 text-orange-700 border-orange-200',
}
const PRIORITY_RANK: Record<Priority, number> = { STAT: 0, Urgent: 1, Routine: 2 }
const PRIORITY_TINT: Record<Priority, string> = {
  STAT: 'bg-red-100 text-red-700',
  Urgent: 'bg-amber-100 text-amber-700',
  Routine: 'bg-slate-100 text-slate-600',
}

const minsAgo = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60000)

export default function PhlebotomyBench() {
  const orders = useLabOrdersStore(s => s.orders)
  const collectOrder = useLabOrdersStore(s => s.collectOrder)
  const currentUser = useAuthStore(s => s.currentUser)
  const meName = currentUser?.name ?? 'Phlebo Saira'

  const [calledOrderId, setCalledOrderId] = useState<string | null>(null)
  const [collectingOrder, setCollectingOrder] = useState<LabOrder | null>(null)
  const [tubeChecks, setTubeChecks] = useState<Record<string, boolean>>({})
  const [barcode, setBarcode] = useState('')

  // Queue: orders that still have at least one test awaiting_collection.
  const queue = useMemo(() => {
    const awaiting = orders.filter(o => o.tests.some(t => t.status === 'awaiting_collection'))
    return awaiting.sort((a, b) => {
      // STAT first → Urgent → Routine, then oldest first
      const ap = Math.min(...a.tests.filter(t => t.status === 'awaiting_collection').map(t => PRIORITY_RANK[t.priority]))
      const bp = Math.min(...b.tests.filter(t => t.status === 'awaiting_collection').map(t => PRIORITY_RANK[t.priority]))
      if (ap !== bp) return ap - bp
      return new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime()
    })
  }, [orders])

  const statCount = queue.filter(o => o.tests.some(t => t.status === 'awaiting_collection' && t.priority === 'STAT')).length

  const announceNext = () => {
    const next = queue[0]
    if (!next) {
      toast('Queue empty — all samples collected.')
      return
    }
    setCalledOrderId(next.id)
    // Token announcement via SpeechSynthesis (best-effort)
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(`${next.patientName}, please proceed to phlebotomy.`)
        window.speechSynthesis.speak(u)
      }
    } catch { /* optional */ }
    toast.success(`Calling ${next.patientName}`, { description: `${next.source} · ${next.tests.length} test${next.tests.length !== 1 ? 's' : ''}` })
  }

  const openCollect = (o: LabOrder) => {
    setCollectingOrder(o)
    const sigTubes = Array.from(new Set(o.specimens.map(s => s.accession)))
    const initial: Record<string, boolean> = {}
    for (const acc of sigTubes) initial[acc] = false
    setTubeChecks(initial)
    // Auto-fill a barcode so the demo flows.
    setBarcode(`BC-${Date.now().toString(36).toUpperCase().slice(-6)}`)
  }

  const allTubesCollected = Object.values(tubeChecks).length > 0 && Object.values(tubeChecks).every(Boolean)

  const confirmCollect = () => {
    if (!collectingOrder) return
    if (!allTubesCollected) {
      toast.error('Tick every tube as drawn before saving.')
      return
    }
    if (!barcode.trim()) {
      toast.error('Scan or enter a barcode.')
      return
    }
    collectOrder(collectingOrder.id, meName)
    notifyAndAudit({
      to: 'lab', type: 'system', priority: 'medium',
      title: `Sample collected · ${collectingOrder.patientName}`,
      body: `${collectingOrder.specimens.length} tube${collectingOrder.specimens.length !== 1 ? 's' : ''} drawn (${barcode}). ${collectingOrder.tests.length} test${collectingOrder.tests.length !== 1 ? 's' : ''} routed to bench.`,
      patientName: collectingOrder.patientName,
      audit: { action: 'lab_order', resource: 'lab_specimen', resourceId: collectingOrder.id, detail: `Collected by ${meName} · barcode ${barcode}`, userName: meName },
    })
    toast.success(`${collectingOrder.patientName} — samples drawn · routed to bench`)
    setCollectingOrder(null)
    setCalledOrderId(null)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header + call-next */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-amber-600" />Phlebotomy bench
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Call the next patient · draw samples · barcode + route to section bench
          </p>
        </div>
        <button onClick={announceNext} disabled={queue.length === 0}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white cursor-pointer disabled:opacity-50 transition-all"
          style={{ background: 'linear-gradient(135deg,#F59E0B,#DC2626)', boxShadow: '0 4px 12px rgba(245,158,11,0.35)' }}>
          <Volume2 className="h-4 w-4" />Next patient please
          {statCount > 0 && (
            <span className="ml-1 bg-white/30 text-[10px] font-bold px-1.5 py-0.5 rounded">
              {statCount} STAT
            </span>
          )}
        </button>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'In queue', val: queue.length, tint: 'bg-amber-50 text-amber-700 border-amber-200' },
          { label: 'STAT priority', val: statCount, tint: 'bg-red-50 text-red-700 border-red-200' },
          { label: 'Currently calling', val: calledOrderId ? '1' : '—', tint: 'bg-[rgba(14,116,144,0.07)] text-[#0E7490] border-[rgba(14,116,144,0.20)]' },
          { label: 'My collections today', val: orders.flatMap(o => o.specimens).filter(s => s.collectedBy === meName).length, tint: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        ].map(s => (
          <div key={s.label} className={cn("rounded-xl border p-3", s.tint)}>
            <p className="text-2xl font-bold">{s.val}</p>
            <p className="text-xs font-semibold mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Queue */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2">Awaiting collection</h2>
        {queue.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Queue is clear</p>
            <p className="text-xs text-slate-400 mt-1">Every ordered sample has been drawn.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {queue.map((o, idx) => {
              const top = idx === 0
              const called = o.id === calledOrderId
              const tests = o.tests.filter(t => t.status === 'awaiting_collection')
              const priority: Priority = tests.reduce<Priority>((acc, t) => PRIORITY_RANK[t.priority] < PRIORITY_RANK[acc] ? t.priority : acc, 'Routine')
              const specs = o.specimens
              const minsOld = minsAgo(o.orderedAt)
              return (
                <motion.div key={o.id} layout
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={cn("rounded-xl bg-white border p-4 flex items-start gap-3 flex-wrap",
                    called ? 'border-[rgba(14,116,144,0.30)] ring-2 ring-blue-100'
                    : top ? 'border-amber-200 ring-2 ring-amber-100'
                    : 'border-slate-200')}>
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500 to-red-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-bold text-slate-900">{o.patientName}</p>
                      <span className="text-[11px] font-bold text-slate-400">{o.patientId}</span>
                      <span className={cn("text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border", SOURCE_TINT[o.source])}>{o.source}</span>
                      {o.wardBed && <span className="text-[11px] text-slate-500">· {o.wardBed}</span>}
                      <span className={cn("text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded", PRIORITY_TINT[priority])}>{priority}</span>
                      {called && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[rgba(14,116,144,0.12)] text-[#0E7490] flex items-center gap-1">
                          <Volume2 className="h-2.5 w-2.5" />Called
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Ordered by {o.doctorName} · {minsOld}m ago
                    </p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {tests.map(t => (
                        <span key={t.id} className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {t.name}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                      <Droplet className="h-3 w-3 text-red-400" />
                      Tubes: {specs.map(s => `${s.type} (${s.container})`).join(' · ')}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <button onClick={() => openCollect(o)}
                      className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap",
                        top ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700')}>
                      <Activity className="h-3.5 w-3.5" />Collect
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tip — what happens next */}
      <div className="bg-[rgba(14,116,144,0.07)] border border-[rgba(14,116,144,0.20)] rounded-xl p-4">
        <p className="text-xs font-bold text-[#0B5A6E] flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3" />Pipeline downstream
        </p>
        <p className="text-[11px] text-[#0E7490] mt-1">
          After collection, samples auto-route to their section bench (Biochem · Hema · Immuno · Urine · Micro).
          Section tech claims → enters values → pathologist verifies → result released to doctor + auto-billed.
        </p>
      </div>

      {/* Collect modal */}
      <AnimatePresence>
        {collectingOrder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setCollectingOrder(null)}>
            <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Draw samples · {collectingOrder.patientName}</h2>
                  <p className="text-xs text-slate-500">{collectingOrder.patientId} · {collectingOrder.source}{collectingOrder.wardBed ? ` · ${collectingOrder.wardBed}` : ''}</p>
                </div>
                <button onClick={() => setCollectingOrder(null)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Tubes to draw</p>
                  <div className="space-y-1.5">
                    {collectingOrder.specimens.map(s => (
                      <label key={s.accession} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={tubeChecks[s.accession] ?? false}
                          onChange={e => setTubeChecks(prev => ({ ...prev, [s.accession]: e.target.checked }))}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                        <span className="text-slate-800 font-medium">{s.type}</span>
                        <span className="text-xs text-slate-500">· {s.container}</span>
                        <span className="text-[10px] font-mono text-slate-400">{s.accession}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <Barcode className="h-3 w-3" />Sample barcode
                  </label>
                  <input value={barcode} onChange={e => setBarcode(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-slate-50"
                    placeholder="Scan barcode…" />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-800 flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  Verify identity (name + DOB), tube colours, and adequate volume before saving.
                </div>
              </div>

              <div className="flex gap-2 px-5 py-4 border-t border-slate-100">
                <button onClick={() => setCollectingOrder(null)}
                  className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
                  Cancel
                </button>
                <button onClick={confirmCollect} disabled={!allTubesCollected || !barcode.trim()}
                  className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer disabled:opacity-50">
                  Save & route to bench
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
