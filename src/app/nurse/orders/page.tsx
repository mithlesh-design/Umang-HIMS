"use client"

import { useMemo } from "react"
import { useInpatientStore } from "@/store/useInpatientStore"
import { useShiftStore, ALL_WARDS } from "@/store/useShiftStore"
import { useNotificationStore } from "@/store/useNotificationStore"
import { WardSwitcher } from "@/components/nurse/ShiftBanner"
import { buildOrders, type NurseOrder, type OrderKind } from "@/lib/orders"

const NURSE = "N. Anjali Desai"
import { Card } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { FlaskConical, Pill, Droplets, Send, ArrowUpRight, Scissors, CheckCircle2, Sparkles, Clock, Stethoscope } from "lucide-react"
import { toast } from "sonner"

const KIND: Record<OrderKind, { icon: React.ElementType; tint: string }> = {
  test:     { icon: FlaskConical, tint: "bg-[rgba(14,116,144,0.07)] text-[#0E7490] border-[rgba(14,116,144,0.15)]" },
  med:      { icon: Pill,         tint: "bg-[rgba(14,116,144,0.07)] text-[#0E7490] border-[rgba(14,116,144,0.15)]" },
  iv:       { icon: Droplets,     tint: "bg-[rgba(14,116,144,0.07)] text-[#0E7490] border-[rgba(14,116,144,0.15)]" },
  referral: { icon: Send,         tint: "bg-[rgba(14,116,144,0.07)] text-[#0E7490] border-[rgba(14,116,144,0.15)]" },
  icu:      { icon: ArrowUpRight, tint: "bg-red-50 text-red-600 border-red-100" },
  ot:       { icon: Scissors,     tint: "bg-rose-50 text-rose-600 border-rose-100" },
}
const urgencyStyle = (u: NurseOrder["urgency"]) =>
  u === "high" ? "bg-red-100 text-red-700" : u === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"

const timeAgo = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${Math.max(0, m)} min ago`
  const h = Math.round(m / 60)
  return `${h} hr${h > 1 ? "s" : ""} ago`
}

export default function NurseOrdersPage() {
  const allInpatients = useInpatientStore(s => s.inpatients)
  const acknowledgeOrder = useInpatientStore(s => s.acknowledgeOrder)
  const activeWard = useShiftStore(s => s.activeWard)
  const addNotification = useNotificationStore(s => s.add)
  const inpatients = useMemo(() => allInpatients.filter(i => activeWard === ALL_WARDS || i.ward === activeWard), [allInpatients, activeWard])
  const orders = useMemo(() => buildOrders(inpatients), [inpatients])
  const highCount = orders.filter(o => o.urgency === "high").length

  // Mark done → log to the chart AND notify the doctor who ordered it.
  const action = (o: NurseOrder) => {
    acknowledgeOrder(o.patientId, { key: o.key, label: o.label })
    addNotification({
      type: "order_done", priority: "medium",
      title: `Order completed — ${o.label}`,
      body: `${o.label} for ${o.patientName} (${o.ward} ${o.bed}) — done by ${NURSE}.`,
      targetRole: "doctor", patientName: o.patientName, channels: ["in_app"],
    })
    toast.success(`Done: ${o.label} · ${o.requestedBy} notified`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Doctor Orders</h1>
          <p className="text-sm text-[#64748B] mt-1">{activeWard} · action each order, then the ordering doctor is notified</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <WardSwitcher />
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0E7490] bg-[rgba(14,116,144,0.07)] border border-[rgba(14,116,144,0.15)] rounded-full px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5" /> AI-prioritised{highCount > 0 ? ` · ${highCount} high` : ""}
          </div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <CheckCircle2 className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-base font-semibold">All orders actioned</p>
          <p className="text-sm mt-1">New doctor orders will appear here automatically.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {orders.map(o => {
              const k = KIND[o.kind]
              const Icon = k.icon
              return (
                <motion.div key={o.key} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }}>
                  <Card className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`h-11 w-11 rounded-2xl border flex items-center justify-center flex-shrink-0 ${k.tint}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-wide">{o.kind}</span>
                            <h3 className="font-bold text-[#0F172A]">{o.label}</h3>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${urgencyStyle(o.urgency)}`}>{o.urgency.toUpperCase()}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 font-medium">
                            {o.patientName} · {o.ward} {o.bed}{o.detail ? ` · ${o.detail}` : ""}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-[11px] flex-wrap">
                            <span className="flex items-center gap-1 text-[#0E7490] font-semibold"><Stethoscope className="h-3 w-3" /> Ordered by {o.requestedBy}</span>
                            <span className="flex items-center gap-1 text-slate-400"><Clock className="h-3 w-3" /> {timeAgo(o.at)}</span>
                            <span className="flex items-center gap-1 text-[#0E7490] font-semibold"><Sparkles className="h-3 w-3" /> {o.aiReason}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => action(o)}
                        className="flex flex-col items-center gap-0.5 text-sm font-bold text-white px-4 py-2 rounded-xl cursor-pointer transition-all flex-shrink-0"
                        style={{ background: "linear-gradient(135deg,#16A34A,#0B5A6E)", boxShadow: "0 2px 8px rgba(22,163,74,0.25)" }}
                      >
                        <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Mark done</span>
                        <span className="text-[9px] font-medium text-white/80">notifies {o.requestedBy.replace(/^Dr\.?\s*/, "Dr. ")}</span>
                      </button>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
