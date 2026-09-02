'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { Loader2, UserMinus } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ManageTeamMembersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  team: {
    id: string
    name: string | null
    manager: {
      first_name: string
      last_name: string
    }
    members: Array<{
      id: string
      first_name: string
      last_name: string
      email: string
      role: string
    }>
  }
  onUpdated: () => void
}

interface Employee {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
  team_id: string | null
}

export default function ManageTeamMembersDialog({
  open,
  onOpenChange,
  team,
  onUpdated
}: ManageTeamMembersDialogProps) {
  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([])
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [removingMember, setRemovingMember] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      fetchAvailableEmployees()
    }
  }, [open])

  const fetchAvailableEmployees = async () => {
    try {
      setLoadingEmployees(true)
      // Fetch employees without a team
      const response = await fetch('/api/users?role=EMPLOYEE&withoutTeam=true')
      
      if (!response.ok) {
        throw new Error('Failed to fetch employees')
      }

      const data = await response.json()
      setAvailableEmployees(data.users || [])
    } catch (error) {
      console.error('Error fetching employees:', error)
      toast({
        title: 'Error',
        description: 'Failed to load available employees',
        variant: 'destructive'
      })
    } finally {
      setLoadingEmployees(false)
    }
  }

  const handleAddMembers = async () => {
    if (selectedEmployees.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one employee',
        variant: 'destructive'
      })
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/teams/${team.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedEmployees })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add members')
      }

      toast({
        title: 'Success',
        description: `Added ${selectedEmployees.length} member(s) to team`
      })

      setSelectedEmployees([])
      onUpdated()
      fetchAvailableEmployees()
    } catch (error) {
      console.error('Error adding members:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add members',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      setRemovingMember(memberId)
      const response = await fetch(`/api/teams/${team.id}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [memberId] })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to remove member')
      }

      toast({
        title: 'Success',
        description: 'Member removed from team'
      })

      onUpdated()
      fetchAvailableEmployees()
    } catch (error) {
      console.error('Error removing member:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove member',
        variant: 'destructive'
      })
    } finally {
      setRemovingMember(null)
    }
  }

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployees(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    )
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  const teamName = team.name || `${team.manager.first_name} ${team.manager.last_name}'s Team`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Team Members</DialogTitle>
          <DialogDescription>{teamName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Members */}
          <div>
            <h3 className="font-medium mb-3">
              Current Members ({team.members?.length || 0})
            </h3>
            <ScrollArea className="h-48 rounded-md border">
              {team.members && team.members.length > 0 ? (
                <div className="p-4 space-y-2">
                  {team.members.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-secondary text-xs">
                            {getInitials(member.first_name, member.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {member.first_name} {member.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={removingMember === member.id}
                      >
                        {removingMember === member.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <UserMinus className="h-4 w-4 mr-1" />
                            Remove
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  No members yet
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Add Members */}
          <div>
            <h3 className="font-medium mb-3">Add Members</h3>
            <ScrollArea className="h-64 rounded-md border">
              {loadingEmployees ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : availableEmployees.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  No available employees
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {availableEmployees.map(employee => (
                    <label
                      key={employee.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedEmployees.includes(employee.id)}
                        onCheckedChange={() => toggleEmployee(employee.id)}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-secondary text-xs">
                          {getInitials(employee.first_name, employee.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {employee.first_name} {employee.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{employee.email}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {employee.role}
                      </Badge>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {selectedEmployees.length} selected
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                onClick={handleAddMembers}
                disabled={loading || selectedEmployees.length === 0}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Selected
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
