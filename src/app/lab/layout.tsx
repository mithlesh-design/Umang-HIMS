import { RoleGuard } from "@/components/layout/RoleGuard"

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard allowedRole="lab">{children}</RoleGuard>
}
