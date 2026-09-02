'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Briefcase, Users, Clock, CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

interface CaseStats {
  total: number
  assigned: number
  in_progress: number
  pending_review: number
  completed: number
}

interface TeamStats {
  total_members: number
  active_members: number
  total_cases_assigned: number
}

interface RecentCase {
  id: string
  case_number: string
  title: string
  status: string
  priority: string
  created_at: string
}

export default function ManagerDashboardClient() {
  const [caseStats, setCaseStats] = useState<CaseStats | null>(null)
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null)
  const [recentCases, setRecentCases] = useState<RecentCase[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Fetch cases
      const casesResponse = await fetch('/api/manager/cases')
      if (casesResponse.ok) {
        const casesData = await casesResponse.json()
        setCaseStats(casesData.summary || {
          total: 0,
          assigned: 0,
          in_progress: 0,
          pending_review: 0,
          completed: 0
        })
        setRecentCases(casesData.cases?.slice(0, 5) || [])
      }

      // Fetch team
      const teamResponse = await fetch('/api/manager/team')
      if (teamResponse.ok) {
        const teamData = await teamResponse.json()
        setTeamStats({
          total_members: teamData.members?.length || 0,
          active_members: teamData.members?.filter((m: any) => m.total_cases > 0).length || 0,
          total_cases_assigned: teamData.team_stats?.total_cases_assigned || 0
        })
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
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

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{caseStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Assigned to you and your team
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{caseStats?.in_progress || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active cases being worked on
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{caseStats?.pending_review || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamStats?.total_members || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {teamStats?.active_members || 0} with active cases
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Cases and Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Cases */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Cases</CardTitle>
            <CardDescription>Latest cases assigned to you and your team</CardDescription>
          </CardHeader>
          <CardContent>
            {recentCases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Briefcase className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No cases assigned yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentCases.map(caseItem => (
                  <Link
                    key={caseItem.id}
                    href={`/manager/cases/${caseItem.id}`}
                    className="block p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm truncate">
                            {caseItem.case_number}
                          </span>
                          <Badge variant="outline" className={getPriorityColor(caseItem.priority)}>
                            {caseItem.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {caseItem.title}
                        </p>
                      </div>
                      <Badge className={getStatusColor(caseItem.status)}>
                        {caseItem.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </Link>
                ))}
                <Link href="/manager/cases">
                  <Button variant="outline" className="w-full mt-2">
                    View All Cases
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Team Overview</CardTitle>
            <CardDescription>Your team performance summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Team Members</span>
                <span className="text-2xl font-bold">{teamStats?.total_members || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Members with Cases</span>
                <span className="text-2xl font-bold">{teamStats?.active_members || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Cases Assigned</span>
                <span className="text-2xl font-bold">{teamStats?.total_cases_assigned || 0}</span>
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <Link href="/manager/team">
                <Button className="w-full" variant="default">
                  <Users className="h-4 w-4 mr-2" />
                  Manage Team
                </Button>
              </Link>
              <Link href="/manager/cases">
                <Button className="w-full" variant="outline">
                  <Briefcase className="h-4 w-4 mr-2" />
                  Assign Cases
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
