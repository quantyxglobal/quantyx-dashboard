'use client'

import { useState, useMemo } from 'react'
import { Case, Organization } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePrefetch } from '@/components/route-preloader'
import { FolderOpen, Shield } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/date-utils'

interface CaseWithOrganization extends Case {
  organization: Organization
}

interface SuperAdminCaseListProps {
  cases: CaseWithOrganization[]
}

export function SuperAdminCaseList({ cases }: SuperAdminCaseListProps) {
  const router = useRouter()
  const { prefetchSuperAdminCaseRoute } = usePrefetch()
  const [firmFilter, setFirmFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  // Get unique organizations for filter dropdown
  const firms = useMemo(() => {
    const uniqueOrganizations = new Map<string, string>()
    cases.forEach(c => {
      uniqueOrganizations.set(c.organization.id, c.organization.name)
    })
    return Array.from(uniqueOrganizations.entries()).map(([id, name]) => ({ id, name }))
  }, [cases])
  
  // Filter cases based on selected filters
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      const matchesFirm = firmFilter === 'all' || c.organization_id === firmFilter
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter
      return matchesFirm && matchesStatus
    })
  }, [cases, firmFilter, statusFilter])
  
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-accent/20 text-accent-foreground border border-accent/30'
      case 'in_progress':
        return 'bg-primary/20 text-primary border border-primary/30'
      case 'under_review':
        return 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-500/30'
      case 'completed':
        return 'bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30'
      case 'delivered':
        return 'bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-500/30'
      case 'on_hold':
        return 'bg-gray-500/20 text-gray-700 dark:text-gray-400 border border-gray-500/30'
      default:
        return 'bg-muted text-muted-foreground border border-border'
    }
  }
  
  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }
  
  if (cases.length === 0) {
    return (
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-gradient-to-br from-destructive/20 to-destructive/10">
              <FolderOpen className="h-5 w-5 text-destructive" />
            </div>
            All Cases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base text-muted-foreground text-center py-8 leading-relaxed">
            No cases found in the system.
          </p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className="border-destructive/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <div className="p-2 rounded-lg bg-gradient-to-br from-destructive/20 to-destructive/10">
            <FolderOpen className="h-5 w-5 text-destructive" />
          </div>
          All Cases ({filteredCases.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px] space-y-2">
            <label className="block text-sm font-medium text-foreground leading-none">
              Filter by Organization
            </label>
            <select
              value={firmFilter}
              onChange={(e) => setFirmFilter(e.target.value)}
              className="w-full px-3 py-2 border border-destructive/20 rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-destructive text-base leading-snug"
            >
              <option value="all">All Organizations</option>
              {firms.map(firm => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex-1 min-w-[200px] space-y-2">
            <label className="block text-sm font-medium text-foreground leading-none">
              Filter by Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-destructive/20 rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-destructive text-base leading-snug"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="under_review">Under Review</option>
              <option value="completed">Completed</option>
              <option value="delivered">Delivered</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
        </div>
        
        {/* Cases Table */}
        <div className="overflow-x-auto rounded-lg border border-destructive/20">
          <table className="w-full">
            <thead className="bg-destructive/5">
              <tr className="border-b border-destructive/20">
                <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                  Case Title
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                  Organization
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                  Created
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((caseItem) => (
                <tr 
                  key={caseItem.id}
                  onClick={() => router.push(`/superadmin/case/${caseItem.id}`)}
                  onMouseEnter={() => prefetchSuperAdminCaseRoute(caseItem.id)}
                  className="border-b border-destructive/10 last:border-0 hover:bg-destructive/5 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-4 text-base font-medium text-foreground leading-snug">
                    {caseItem.title}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground leading-relaxed">
                    {caseItem.organization.name}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(caseItem.status)}`}>
                      {formatStatus(caseItem.status)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground leading-relaxed">
                    {formatDate(caseItem.created_at)}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground leading-relaxed">
                    {formatDate(caseItem.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredCases.length === 0 && (
          <p className="text-base text-muted-foreground text-center py-8 leading-relaxed">
            No cases match the selected filters.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
