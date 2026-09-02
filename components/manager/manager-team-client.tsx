'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Loader2, Users, Briefcase, CheckCircle, Clock, Mail, User } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface TeamMember {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
  total_cases: number
  active_cases: number
  completed_cases: number
  pending_cases: number
}

interface TeamStats {
  total_cases_assigned: number
  cases_in_progress: number
  cases_completed: number
  average_cases_per_member: number
}

interface TeamData {
  team: {
    id: string
    name: string | null
  }
  members: TeamMember[]
  team_stats: TeamStats
}

export default function ManagerTeamClient() {
  const [teamData, setTeamData] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchTeamData()
  }, [])

  const fetchTeamData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/manager/team')

      if (!response.ok) {
        throw new Error('Failed to fetch team data')
      }

      const data = await response.json()
      setTeamData(data)
    } catch (error) {
      console.error('Error fetching team data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load team data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!teamData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Team Found</CardTitle>
          <CardDescription>
            You don't have a team assigned yet. Please contact your administrator.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { team, members, team_stats } = teamData

  return (
    <div className="space-y-6">
      {/* Team Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{team_stats.total_cases_assigned}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Assigned to team members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{team_stats.cases_in_progress}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently being worked on
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{team_stats.cases_completed}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Successfully completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members
              </CardTitle>
              <CardDescription className="mt-1">
                {team.name || 'Your Team'} - {members.length} member{members.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-sm">
              Avg: {team_stats.average_cases_per_member.toFixed(1)} cases/member
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No team members yet</p>
              <p className="text-xs mt-1">Team members will appear here once they are assigned to your team</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {members.map(member => (
                <Card key={member.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(member.first_name, member.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">
                          {member.first_name} {member.last_name}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{member.email}</span>
                        </div>
                        <Badge variant="outline" className="mt-2 text-xs">
                          {member.role}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Total Cases</span>
                        <span className="font-semibold">{member.total_cases}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Active
                        </span>
                        <span className="font-semibold text-yellow-600">
                          {member.active_cases}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Completed
                        </span>
                        <span className="font-semibold text-green-600">
                          {member.completed_cases}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Pending</span>
                        <span className="font-semibold text-blue-600">
                          {member.pending_cases}
                        </span>
                      </div>
                      
                      {/* Performance indicator */}
                      <div className="pt-2 border-t">
                        {member.total_cases === 0 ? (
                          <Badge variant="outline" className="w-full justify-center text-xs">
                            No cases assigned
                          </Badge>
                        ) : member.active_cases === 0 && member.pending_cases === 0 ? (
                          <Badge variant="secondary" className="w-full justify-center text-xs bg-green-500/10 text-green-700">
                            All cases completed
                          </Badge>
                        ) : member.active_cases > 5 ? (
                          <Badge variant="secondary" className="w-full justify-center text-xs bg-orange-500/10 text-orange-700">
                            High workload
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="w-full justify-center text-xs bg-blue-500/10 text-blue-700">
                            Active
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Team Performance Summary</CardTitle>
          <CardDescription>Overall team statistics and insights</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-medium mb-3">Case Distribution</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Assigned</span>
                  <span className="font-semibold">{team_stats.total_cases_assigned}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">In Progress</span>
                  <span className="font-semibold">{team_stats.cases_in_progress}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Completed</span>
                  <span className="font-semibold">{team_stats.cases_completed}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Completion Rate</span>
                  <span className="font-semibold">
                    {team_stats.total_cases_assigned > 0
                      ? `${Math.round((team_stats.cases_completed / team_stats.total_cases_assigned) * 100)}%`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-3">Team Capacity</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Team Members</span>
                  <span className="font-semibold">{members.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg Cases per Member</span>
                  <span className="font-semibold">{team_stats.average_cases_per_member.toFixed(1)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Active Members</span>
                  <span className="font-semibold">
                    {members.filter(m => m.active_cases > 0).length}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Utilization</span>
                  <span className="font-semibold">
                    {members.length > 0
                      ? `${Math.round((members.filter(m => m.total_cases > 0).length / members.length) * 100)}%`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
