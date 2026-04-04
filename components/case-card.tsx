import Link from 'next/link'
import { Case } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
// Updated icons - removed Archive for new status system
import { FileText, Clock, CheckCircle, AlertCircle, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/date-utils'

interface CaseCardProps {
  caseData: Case
}

const statusConfig = {
  PENDING: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-accent/10 text-accent-foreground border-accent/20'
  },
  IN_PROGRESS: {
    label: 'In Progress',
    icon: FileText,
    className: 'bg-primary/10 text-primary border-primary/20'
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    icon: AlertCircle,
    className: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20'
  },
  COMPLETED: {
    label: 'Completed',
    icon: CheckCircle,
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20'
  },
  DELIVERED: {
    label: 'Delivered',
    icon: CheckCircle,
    className: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20'
  },
  ON_HOLD: {
    label: 'On Hold',
    icon: Clock,
    className: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20'
  }
}

const timelineConfig = {
  SUPER_RUSH: {
    label: 'Super Rush (1-2 days)',
    className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
  },
  EXPEDITE: {
    label: 'Expedite (3 days)',
    className: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20'
  },
  NORMAL: {
    label: 'Normal (1 week)',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
  }
}

export function CaseCard({ caseData }: CaseCardProps) {
  // Add comprehensive safety checks for undefined data
  if (!caseData || !caseData.id || !caseData.status) {
    console.warn('[CaseCard] Invalid case data received:', caseData)
    return null
  }

  // Ensure all required fields have fallback values
  const safeCase = {
    id: caseData.id,
    title: caseData.title || 'Untitled Case',
    case_number: caseData.case_number || 'N/A',
    status: caseData.status || 'PENDING',
    priority: caseData.priority || 'NORMAL',
    created_at: caseData.created_at || new Date().toISOString()
  }

  const status = statusConfig[safeCase.status] || statusConfig.PENDING
  const timeline = timelineConfig[safeCase.priority] || timelineConfig.NORMAL
  const StatusIcon = status.icon
  
  const formattedDate = formatDate(safeCase.created_at)
  
  return (
    <Link href={`/dashboard/case/${safeCase.id}`} className="block h-full group">
      <Card className="relative overflow-hidden transition-all duration-500 hover:shadow-elegant hover:border-primary/30 hover:-translate-y-2 cursor-pointer h-full min-h-[240px] bg-white/60 backdrop-blur-sm border-[hsl(240_15%_88%)] group-hover:bg-white/80">
        {/* Background gradient decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <CardHeader className="pb-4 relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl font-bold line-clamp-2 leading-tight group-hover:text-primary transition-colors duration-300">
                {safeCase.title}
              </CardTitle>
              {/* Prominent Case ID Display */}
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-mono text-sm">
                  {safeCase.case_number}
                </Badge>
              </div>
            </div>
            <Badge variant="outline" className={cn(
              'flex items-center gap-2 shrink-0 min-h-[36px] px-3 py-1.5 font-medium transition-all duration-300 group-hover:scale-105', 
              status.className
            )}>
              <StatusIcon className="h-4 w-4" />
              <span className="text-sm">{status.label}</span>
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 relative z-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-[hsl(240_8%_46%)]">
              <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <span className="font-medium">Created {formattedDate}</span>
            </div>
            
            {/* Timeline Information */}
            <div className="flex items-center gap-3 text-sm">
              <div className="p-1.5 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors duration-300">
                <Timer className="h-4 w-4 text-accent" />
              </div>
              <Badge variant="outline" className={cn('text-xs', timeline.className)}>
                {timeline.label}
              </Badge>
            </div>
          </div>
          
          {/* Hover indicator */}
          <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-primary-glow flex items-center justify-center shadow-glow">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
