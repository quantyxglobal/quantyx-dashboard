'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, Users, Calendar, User, Building2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ManagerAssignCaseDialog from './manager-assign-case-dialog'

interface CaseDetail {
  id: string
  case_number: string
  title: string
  status: string
  priority: string
  client_name: string
  client_email: string
  created_at: string
  description?: string
  special_instructions?: string
  organization?: {
    name: string
    display_name: string
  }
}

interface Assignment {
  id: string
  first_name: string
  last_name: string
  email: string
}

interface ManagerCaseDetailClientProps {
  caseId: string
}

export default function ManagerCaseDetailClient({ caseId }: ManagerCaseDetailClientProps) {
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    fetchCaseDetail()
    fetchAssignments()
  }, [caseId])

  const fetchCaseDetail = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/manager/cases/${caseId}`)

      if (response.status === 404) {
        toast({
          title: 'Not Found',
          description: 'Case not found or you do not have access to it',
          variant: 'destructive'
        })
        router.push('/manager/cases')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch case details')
      }

      const data = await response.json()
      setCaseDetail(data)
    } catch (error) {
      console.error('Error fetching case details:', error)
      toast({
        title: 'Error',
        description: 'Failed to load case details',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchAssignments = async () => {
    try {
      const response = await fetch(`/api/manager/cases/${caseId}/assign`)

      if (response.ok) {
        const data = await response.json()
        setAssignments(data.employees || [])
      }
    } catch (error) {
      console.error('Error fetching assignments:', error)
    }
  }

  const handleAssignmentUpdated = () => {
    fetchAssignments()
    setAssignDialogOpen(false)
    toast({
      title: 'Success',
      description: 'Case assignments updated successfully'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'new':
      case 'assigned':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
      case 'in_progress':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300'
      case 'pending_review':
        return 'bg-orange-500/10 text-orange-700 dark:text-orange-300'
      case 'completed':
        return 'bg-green-500/10 text-green-700 dark:text-green-300'
      case 'delivered':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-300'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-200'
      case 'high':
        return 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200'
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-200'
      case 'low':
        return 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-200'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!caseDetail) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">Case not found</p>
          <Link href="/manager/cases">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Cases
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/manager/cases">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Cases
        </Button>
      </Link>

      {/* Case Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{caseDetail.case_number}</CardTitle>
              <CardDescription className="mt-2 text-base">
                {caseDetail.title}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className={getPriorityColor(caseDetail.priority)}>
                {caseDetail.priority}
              </Badge>
              <Badge className={getStatusColor(caseDetail.status)}>
                {caseDetail.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Client:</span>
              <span className="text-sm font-medium">{caseDetail.client_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Created:</span>
              <span className="text-sm font-medium">{formatDate(caseDetail.created_at)}</span>
            </div>
            {caseDetail.organization && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Organization:</span>
                <span className="text-sm font-medium">{caseDetail.organization.display_name}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assignment Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Assignments
              </CardTitle>
              <CardDescription className="mt-1">
                Assign this case to your team members
              </CardDescription>
            </div>
            <Button onClick={() => setAssignDialogOpen(true)}>
              Manage Assignments
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No team members assigned yet</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setAssignDialogOpen(true)}
              >
                Assign Team Members
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-3">
                {assignments.length} team member{assignments.length !== 1 ? 's' : ''} assigned
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {assignments.map(assignment => (
                  <div
                    key={assignment.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {assignment.first_name} {assignment.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {assignment.email}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Special Instructions */}
      {caseDetail.special_instructions && (
        <Card>
          <CardHeader>
            <CardTitle>Special Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {caseDetail.special_instructions}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Assignment Dialog */}
      <ManagerAssignCaseDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        caseId={caseId}
        currentAssignments={assignments}
        onAssignmentUpdated={handleAssignmentUpdated}
      />
    </div>
  )
}
