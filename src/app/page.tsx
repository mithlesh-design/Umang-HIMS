"use client"

import { LandingNav } from "@/components/landing/LandingNav"
import { LandingHero } from "@/components/landing/LandingHero"
import { TrustStrip } from "@/components/landing/TrustStrip"
import { AiIntelligenceSection } from "@/components/landing/AiIntelligenceSection"
import { ModulesBento } from "@/components/landing/ModulesBento"
import { TrustGovernanceSection } from "@/components/landing/TrustGovernanceSection"
import { OutcomesMetrics } from "@/components/landing/OutcomesMetrics"
import { PortalLauncher } from "@/components/landing/PortalLauncher"
import { FinalCta } from "@/components/landing/FinalCta"
import { LandingFooter } from "@/components/landing/LandingFooter"

// Umang HIMS — world-class enterprise healthcare landing.
// Long-scroll, elevated-minimal (deep-blue + clinical-green, Calibri).
// The role-selection gateway lives in <PortalLauncher/> with behavior preserved.
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#0B1220]">
      <LandingNav />
      <main>
        <LandingHero />
        <TrustStrip />
        <AiIntelligenceSection />
        <ModulesBento />
        <TrustGovernanceSection />
        <OutcomesMetrics />
        <PortalLauncher />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  )
}
