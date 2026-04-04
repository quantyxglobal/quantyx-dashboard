'use client'

import { Case, CaseStatus } from '@prisma/client'
import { useState, useMemo } from 'react'
import { CaseList } from '@/components/case-list'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Filter, ArrowUpDown, X } from 'lucide-react'

interface CaseFiltersProps {
  cases: Case[]
}

type SortOption = 'date-desc' | 'date-asc' | 'status-asc' | 'status-desc'

const statusOrder: Record<CaseStatus, number> = {
  PENDING: 0,
  IN_PROGRESS: 1,
  UNDER_REVIEW: 2,
  COMPLETED: 3,
  DELIVERED: 4,
  ON_HOLD: 5
}

export function CaseFilters({ cases }: CaseFiltersProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('date-desc')

  // Add safety check for cases prop
  if (!Array.isArray(cases)) {
    console.error('[CaseFilters] Invalid cases prop:', cases)
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Unable to load cases. Please refresh the page.</p>
      </div>
    )
  }

  const filteredAndSortedCases = useMemo(() => {
    // Apply status filter
    let filtered = cases
    if (statusFilter !== 'all') {
      filtered = cases.filter(c => c.status === statusFilter)
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'date-asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'status-asc':
          return statusOrder[a.status] - statusOrder[b.status]
        case 'status-desc':
          return statusOrder[b.status] - statusOrder[a.status]
        default:
          return 0
      }
    })

    return sorted
  }, [cases, statusFilter, sortBy])

  const hasActiveFilters = statusFilter !== 'all' || sortBy !== 'date-desc'

  const clearFilters = () => {
    setStatusFilter('all')
    setSortBy('date-desc')
  }

  return (
    <div className="space-y-8">
      {/* Enhanced Filter Card */}
      <Card className="bg-white/60 backdrop-blur-sm border-[hsl(240_15%_88%)] shadow-card">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10">
                <Filter className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-[hsl(240_15%_15%)]">Filter & Sort Cases</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(240_15%_15%)] flex items-center gap-2 leading-none">
                  <Filter className="h-4 w-4 text-primary" />
                  Filter by Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:border-primary/50 transition-colors">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="DELIVERED">Delivered</SelectItem>
                    <SelectItem value="ON_HOLD">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(240_15%_15%)] flex items-center gap-2 leading-none">
                  <ArrowUpDown className="h-4 w-4 text-primary" />
                  Sort by
                </label>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                  <SelectTrigger className="bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:border-primary/50 transition-colors">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-desc">Date (Newest First)</SelectItem>
                    <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
                    <SelectItem value="status-asc">Status (Pending → On Hold)</SelectItem>
                    <SelectItem value="status-desc">Status (On Hold → Pending)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    size="default"
                    onClick={clearFilters}
                    className="w-full bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:bg-destructive/5 hover:border-destructive/50 hover:text-destructive transition-all"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
            
            {/* Results Summary */}
            <div className="flex items-center justify-between pt-4 border-t border-[hsl(240_15%_88%)]">
              <span className="text-sm text-[hsl(240_8%_46%)]">
                Showing {filteredAndSortedCases.length} of {cases.length} cases
              </span>
              {hasActiveFilters && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs text-primary font-medium">Filters Active</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <CaseList cases={filteredAndSortedCases} />
    </div>
  )
}
