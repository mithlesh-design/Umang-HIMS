"use client"

import { useAuthStore } from "@/store/useAuthStore"
import { StaffMessages } from "@/components/messaging/StaffMessages"
import { ClientOnly } from "@/components/ClientOnly"

export default function NurseMessages() {
  const meId = useAuthStore(s => s.currentUser?.id ?? 'NR-402')
  return (
    <div className="pb-2 h-full flex flex-col min-h-0">
      <div className="mb-4">
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">Messages</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Message doctors and colleagues across the hospital</p>
      </div>
      <ClientOnly fallback={<div className="flex-1 flex items-center justify-center"><div className="h-7 w-7 rounded-full border-4 border-[rgba(14,116,144,0.20)] border-t-blue-600 animate-spin" role="status" aria-label="Loading" /></div>}>
        <StaffMessages meId={meId} />
      </ClientOnly>
    </div>
  )
}
