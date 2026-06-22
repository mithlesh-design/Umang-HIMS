import { type LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="h-16 w-16 rounded-2xl bg-surface-sunken border border-border flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-foreground-placeholder" aria-hidden="true" />
      </div>
      <p className="t-title text-foreground-muted">{title}</p>
      {description && <p className="t-body text-foreground-lighter mt-1 max-w-sm">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
