import { Case } from '@prisma/client'
import { CaseCard } from '@/components/case-card'
import { CreateCaseModal } from '@/components/create-case-modal'
import { usePrefetch } from '@/components/route-preloader'
import { FileText } from 'lucide-react'

interface CaseListProps {
  cases: Case[]
}

export function CaseList({ cases }: CaseListProps) {
  const { prefetchCaseRoute } = usePrefetch();

  // Add comprehensive safety checks
  if (!Array.isArray(cases)) {
    console.error('[CaseList] Invalid cases prop:', cases)
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Unable to load cases. Please refresh the page.</p>
      </div>
    )
  }

  // Filter out invalid cases and add safety checks
  const validCases = cases.filter(caseData => {
    if (!caseData) return false
    if (!caseData.id || typeof caseData.id !== 'string') return false
    if (!caseData.status) return false
    return true
  })

  if (validCases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 sm:py-20 px-4">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full blur-xl" />
          <div className="relative rounded-full bg-gradient-to-br from-muted to-secondary p-8 sm:p-10 mb-6 shadow-card">
            <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-primary mx-auto" />
          </div>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent mb-3">
          No Cases Yet
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground text-center max-w-lg leading-relaxed mb-6">
          You haven&apos;t created any cases yet. Get started by creating your first medilegal case.
        </p>
        <CreateCaseModal />
        <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10">
          <p className="text-sm text-primary font-medium text-center">
            Cases help you organize documents, track progress, and manage your medilegal work
          </p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
        {validCases.map((caseData, index) => {
          try {
            return (
              <div 
                key={caseData.id} 
                className="fade-in-up"
                style={{ animationDelay: `${index * 0.1}s` }}
                onMouseEnter={() => {
                  try {
                    prefetchCaseRoute(caseData.id)
                  } catch (error) {
                    console.error('[CaseList] Prefetch error:', error)
                  }
                }}
              >
                <CaseCard caseData={caseData} />
              </div>
            )
          } catch (error) {
            console.error('[CaseList] Error rendering case:', caseData.id, error)
            return (
              <div key={caseData.id} className="p-4 border border-destructive/20 rounded-lg">
                <p className="text-destructive text-sm">Error loading case: {caseData.title || caseData.id}</p>
              </div>
            )
          }
        })}
      </div>
    </div>
  )
}
