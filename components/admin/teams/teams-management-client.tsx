'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Users, UserCircle, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import CreateTeamDialog from './create-team-dialog'
import TeamCard from './team-card'

interface Team {
  id: string
  name: string | null
  created_at: string
  updated_at: string
  manager: {
    id: string
    first_name: string
    last_name: string
    email: string
    role: string
  }
  organization: {
    id: string
    name: string
    display_name: string
  }
  members: Array<{
    id: string
    first_name: string
    last_name: string
    email: string
    role: string
  }>
}

export default function TeamsManagementClient() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const { toast } = useToast()

  const fetchTeams = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/teams')
      
      if (!response.ok) {
        throw new Error('Failed to fetch teams')
      }

      const data = await response.json()
      setTeams(data.teams || [])
    } catch (error) {
      console.error('Error fetching teams:', error)
      toast({
        title: 'Error',
        description: 'Failed to load teams. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTeams()
  }, [])

  const handleTeamCreated = () => {
    setCreateDialogOpen(false)
    fetchTeams()
    toast({
      title: 'Success',
      description: 'Team created successfully'
    })
  }

  const handleTeamDeleted = () => {
    fetchTeams()
    toast({
      title: 'Success',
      description: 'Team deleted successfully'
    })
  }

  const handleTeamUpdated = () => {
    fetchTeams()
    toast({
      title: 'Success',
      description: 'Team updated successfully'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teams.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <UserCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teams.reduce((sum, team) => sum + (team.members?.length || 0), 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Team Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teams.length > 0
                ? Math.round(
                    teams.reduce((sum, team) => sum + (team.members?.length || 0), 0) / teams.length
                  )
                : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Team Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">All Teams</h2>
          <p className="text-sm text-muted-foreground">
            {teams.length} {teams.length === 1 ? 'team' : 'teams'} total
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Team
        </Button>
      </div>

      {/* Teams Grid */}
      {teams.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Teams Yet</CardTitle>
            <CardDescription>
              Create your first team to start organizing employees under managers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map(team => (
            <TeamCard
              key={team.id}
              team={team}
              onDeleted={handleTeamDeleted}
              onUpdated={handleTeamUpdated}
            />
          ))}
        </div>
      )}

      {/* Create Team Dialog */}
      <CreateTeamDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onTeamCreated={handleTeamCreated}
      />
    </div>
  )
}
