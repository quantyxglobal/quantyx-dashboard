'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Users, UserPlus, Trash2, Edit, Mail } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import ManageTeamMembersDialog from './manage-team-members-dialog'
import EditTeamDialog from './edit-team-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface TeamCardProps {
  team: {
    id: string
    name: string | null
    manager: {
      id: string
      first_name: string
      last_name: string
      email: string
      role: string
    }
    members: Array<{
      id: string
      first_name: string
      last_name: string
      email: string
      role: string
    }>
  }
  onDeleted: () => void
  onUpdated: () => void
}

export default function TeamCard({ team, onDeleted, onUpdated }: TeamCardProps) {
  const [manageMembersOpen, setManageMembersOpen] = useState(false)
  const [editTeamOpen, setEditTeamOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  const handleDelete = async () => {
    try {
      setDeleting(true)
      const response = await fetch(`/api/teams/${team.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete team')
      }

      onDeleted()
    } catch (error) {
      console.error('Error deleting team:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete team',
        variant: 'destructive'
      })
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  const teamName = team.name || `${team.manager.first_name} ${team.manager.last_name}'s Team`

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="text-lg">{teamName}</CardTitle>
              <CardDescription className="mt-1">
                <div className="flex items-center gap-1 text-sm">
                  <Mail className="h-3 w-3" />
                  {team.manager.email}
                </div>
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setManageMembersOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Manage Members
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditTeamOpen(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Team
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Team
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Manager Info */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Manager</p>
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials(team.manager.first_name, team.manager.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">
                    {team.manager.first_name} {team.manager.last_name}
                  </p>
                  <Badge variant="secondary" className="text-xs">
                    {team.manager.role}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Members Count */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Team Members</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {team.members?.length || 0} {team.members?.length === 1 ? 'member' : 'members'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManageMembersOpen(true)}
                >
                  Manage
                </Button>
              </div>
            </div>

            {/* Members Preview */}
            {team.members && team.members.length > 0 && (
              <div className="flex -space-x-2">
                {team.members.slice(0, 5).map(member => (
                  <Avatar key={member.id} className="h-8 w-8 border-2 border-background">
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                      {getInitials(member.first_name, member.last_name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {team.members.length > 5 && (
                  <div className="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
                    +{team.members.length - 5}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Manage Members Dialog */}
      <ManageTeamMembersDialog
        open={manageMembersOpen}
        onOpenChange={setManageMembersOpen}
        team={team}
        onUpdated={onUpdated}
      />

      {/* Edit Team Dialog */}
      <EditTeamDialog
        open={editTeamOpen}
        onOpenChange={setEditTeamOpen}
        team={team}
        onUpdated={onUpdated}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{teamName}"?
              {team.members && team.members.length > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  This team has {team.members.length} member(s). Please remove all members before deleting.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting || (team.members && team.members.length > 0)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
