"use client"

import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Calendar, Clock, ArrowRight, CheckCircle2, Video, Building2, Settings, Plane } from "lucide-react"
import { usePatientStore, type QueueStatus } from "@/store/usePatientStore"
import { useAuthStore } from "@/store/useAuthStore"
import { useConsultationStore } from "@/store/useConsultationStore"
import { useDoctorProfileStore } from "@/store/useDoctorProfileStore"
import { cn } from "@/lib/utils"

const SLOT_STYLE: Record<string, { badge: string; label: string; row: string }> = {
  done:        { badge: 'bg-green-600 text-white',  label: 'Seen',        row: 'bg-green-50/50 border-green-100' },
  'in-progress':{ badge: 'bg-[#0E7490] text-white',  label: 'In progress', row: 'bg-[rgba(14,116,144,0.07)]/50 border-[rgba(14,116,144,0.20)]' },
  upcoming:    { badge: 'bg-amber-50 text-amber-700',label: 'Upcoming',    row: 'bg-white border-slate-200' },
}
function slotStatus(q: QueueStatus): keyof typeof SLOT_STYLE {
  if (['pharmacy', 'billing', 'done'].includes(q)) return 'done'
  if (q === 'consulting') return 'in-progress'
  return 'upcoming'
}
// "09:10 AM" / "03:20 PM" → minutes since midnight (for correct chronological sort).
function toMinutes(t: string): number {
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return 0
  let h = parseInt(m[1]) % 12
  if (/pm/i.test(m[3])) h += 12
  return h * 60 + parseInt(m[2])
}

export default function DoctorSchedule() {
  const router = useRouter()
  const patients = usePatientStore(s => s.patients)
  const appointments = usePatientStore(s => s.appointments)
  const currentUser = useAuthStore(s => s.currentUser)
  const setCurrentPatient = useConsultationStore(s => s.setCurrentPatient)
  const profile = useDoctorProfileStore()

  const today = new Date().toISOString().slice(0, 10)
  const mine = patients
    .filter(p => p.doctor === currentUser?.name && (p.registeredDate ?? today) === today)
    .sort((a, b) => toMinutes(a.registeredAt) - toMinutes(b.registeredAt))

  const upcomingAppts = appointments
    .filter(a => a.doctorName === currentUser?.name && a.date > today && a.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date))

  const openConsult = (patientId: string) => {
    const p = patients.find(x => x.id === patientId)
    if (p) setCurrentPatient(p)
    router.push('/doctor/dashboard')
  }

  return (
    <div className="max-w-3xl mx-auto pb-8 space-y-5">
      <div>
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">My Schedule</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · {mine.length} patients today</p>
      </div>

      {/* Availability — driven by Settings */}
      <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-4 flex flex-wrap items-center gap-2.5">
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-800"><Clock className="h-4 w-4 text-[#0E7490]" /> {profile.hoursStart}–{profile.hoursEnd}</span>
        <span className={cn("text-[11.5px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1", profile.availableForOPD ? "bg-[rgba(14,116,144,0.07)] text-[#0E7490]" : "bg-slate-100 text-slate-400")}><Building2 className="h-3 w-3" /> OPD {profile.availableForOPD ? 'on' : 'off'}</span>
        <span className={cn("text-[11.5px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1", profile.availableForOnline ? "bg-[rgba(14,116,144,0.07)] text-[#0E7490]" : "bg-slate-100 text-slate-400")}><Video className="h-3 w-3" /> Online {profile.availableForOnline ? 'on' : 'off'}</span>
        {profile.onLeave && <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1"><Plane className="h-3 w-3" /> On leave{profile.leaveUntil ? ` · until ${new Date(profile.leaveUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}</span>}
        <Link href="/doctor/settings" className="ml-auto text-[12px] font-semibold text-[#0E7490] hover:text-[#0E7490] flex items-center gap-1"><Settings className="h-3.5 w-3.5" /> Edit</Link>
      </div>

      <div className="space-y-2.5">
        {mine.length === 0 && (
          <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-10 text-center text-[13px] text-slate-400">No patients scheduled today.</div>
        )}
        {mine.map((p, i) => {
          const st = SLOT_STYLE[slotStatus(p.queueStatus)]
          const done = slotStatus(p.queueStatus) === 'done'
          return (
            <motion.div key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className={cn("flex items-center gap-4 rounded-2xl border p-4", st.row)}>
              <div className="w-20 text-[13px] font-bold text-slate-500 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-slate-400" />{p.registeredAt}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-slate-900 truncate">{p.name}</p>
                <p className="text-[12px] text-slate-500 truncate">{p.age}y · {p.symptoms[0] ?? p.department}</p>
              </div>
              <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0", st.badge)}>{st.label}</span>
              {done ? (
                <span className="w-28 text-[12px] font-semibold text-green-600 flex items-center justify-end gap-1"><CheckCircle2 className="h-4 w-4" /> Done</span>
              ) : (
                <button onClick={() => openConsult(p.id)} className="w-28 h-9 rounded-xl bg-[#0E7490] hover:bg-[#0B5A6E] text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5 active:scale-95 transition">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </motion.div>
          )
        })}
      </div>

      {upcomingAppts.length > 0 && (
        <div>
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-400 mb-2 mt-6">Upcoming appointments</h3>
          <div className="space-y-2.5">
            {upcomingAppts.map(a => (
              <div key={a.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
                <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0", a.mode === 'online' ? 'bg-[rgba(14,116,144,0.07)] text-[#0E7490]' : 'bg-[rgba(14,116,144,0.07)] text-[#0E7490]')}>
                  {a.mode === 'online' ? <Video className="h-4.5 w-4.5" /> : <Building2 className="h-4.5 w-4.5" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-slate-900 truncate">{a.patientName ?? a.patientId}</p>
                  <p className="text-[12px] text-slate-500">{a.specialty} · {a.mode === 'online' ? 'Video' : 'In-person'}</p>
                </div>
                <span className="text-[12.5px] font-semibold text-slate-600 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-slate-400" /> {new Date(a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {a.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
