import Link from 'next/link'
import { Case } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, Timer, DollarSign } from 'lucide-react'
import { formatDate } from '@/lib/date-utils'

interface CaseHeaderProps {
  caseData: Case & {
    organization: {
      id: string
      name: string
    }
    services?: {
      service_id: string
      service: {
        id: string
        name: string
        description?: string
      }
    }[]
  }
}

const statusLabels = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  UNDER_REVIEW: 'Under Review',
  COMPLETED: 'Completed',
  DELIVERED: 'Delivered',
  ON_HOLD: 'On Hold',
}

const timelineLabels = {
  SUPER_RUSH: 'Super Rush (1-2 days)',
  EXPEDITE: 'Expedite (3 days)',
  NORMAL: 'Normal (1 week)',
}

const timelineColors = {
  SUPER_RUSH: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
  EXPEDITE: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  NORMAL: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
}

export function CaseHeader({ caseData }: CaseHeaderProps) {
  const formattedDate = formatDate(caseData.created_at)
  const updatedDate = formatDate(caseData.updated_at)

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center text-sm text-muted-foreground leading-relaxed">
        <Link
          href="/dashboard"
          className="hover:text-foreground transition-colors min-h-[44px] flex items-center"
        >
          Dashboard
        </Link>
        <ChevronRight className="h-4 w-4 mx-2" />
        <span className="text-foreground font-medium truncate">{caseData.title}</span>
      </nav>

      {/* Case Header */}
      <div className="bg-card rounded-lg border border-border p-6 shadow-card">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-foreground mb-2 break-words leading-tight">
              {caseData.title}
            </h1>
            {/* Prominent Case ID Display */}
            <div className="mb-3">
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-mono text-lg px-4 py-2">
                {caseData.case_number}
              </Badge>
            </div>
            <p className="text-base text-muted-foreground leading-relaxed">
              {caseData.organization.name}
            </p>
            
            {/* Services Display */}
            {caseData.services && caseData.services.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-muted-foreground mb-2">Services:</p>
                <div className="flex flex-wrap gap-2">
                  {caseData.services.map((caseService) => (
                    <Badge 
                      key={caseService.service_id} 
                      variant="secondary" 
                      className="bg-accent/10 text-accent-foreground border-accent/20"
                    >
                      {caseService.service.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge
              variant={caseData.status}
              icon={true}
              className="text-sm px-3 py-1.5 min-h-[32px]"
            >
              {statusLabels[caseData.status]}
            </Badge>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-border">
          <div>
            <p className="text-sm text-muted-foreground leading-relaxed">Created</p>
            <p className="text-base font-medium text-foreground mt-1 leading-snug">{formattedDate}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground leading-relaxed">Last Updated</p>
            <p className="text-base font-medium text-foreground mt-1 leading-snug">{updatedDate}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground leading-relaxed flex items-center gap-1">
              <Timer className="h-4 w-4" />
              Timeline
            </p>
            <Badge variant="outline" className={`mt-1 ${timelineColors[caseData.priority] || timelineColors.NORMAL}`}>
              {timelineLabels[caseData.priority] || timelineLabels.NORMAL}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground leading-relaxed flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              Estimate
            </p>
            <p className="text-base font-medium mt-1 leading-snug">
              {caseData.estimate_required ? (
                <span className="text-green-600 dark:text-green-400">Required</span>
              ) : (
                <span className="text-muted-foreground">Not Required</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
