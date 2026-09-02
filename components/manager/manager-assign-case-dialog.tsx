'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Users, X } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface TeamMember {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
}

interface Assignment {
  id: string
  first_name: string
  last_name: string
  email: string
}

interface ManagerAssignCaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: string
  currentAssignments: Assignment[]
  onAssignmentUpdated: () => void
}

export default function ManagerAssignCaseDialog({
  open,
  onOpenChange,
  caseId,
  currentAssignments,
  onAssignmentUpdated
}: ManagerAssignCaseDialogProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>(
    currentAssignments.map(a => a.id)
  )
  const [loading, setLoading] = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      fetchTeamMembers()
      setSelectedIds(currentAssignments.map(a => a.id))
    }
  }, [open, currentAssignments])

  const fetchTeamMembers = async () => {
    try {
      setLoadingMembers(true)
      const response = await fetch('/api/manager/team')

      if (!response.ok) {
        throw new Error('Failed to fetch team members')
      }

      const data = await response.json()
      setTeamMembers(data.members || [])
    } catch (error) {
      console.error('Error fetching team members:', error)
      toast({
        title: 'Error',
        description: 'Failed to load team members',
        variant: 'destructive'
      })
    } finally {
      setLoadingMembers(false)
    }
  }

  const handleToggleMember = (memberId: string) => {
    setSelectedIds(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId)
      } else {
        return [...prev, memberId]
      }
    })
  }

  const handleRemoveMember = (memberId: string) => {
    setSelectedIds(prev => prev.filter(id => id !== memberId))
  }

  const handleApply = async () => {
    if (loading) return

    setLoading(true)

    try {
      const response = await fetch(`/api/manager/cases/${caseId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeIds: selectedIds
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to assign case')
      }

      onAssignmentUpdated()
    } catch (error) {
      console.error('Error assigning case:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign case',
        variant: 'destructive'
      })
      // Revert selection on error
      setSelectedIds(currentAssignments.map(a => a.id))
    } finally {
      setLoading(false)
    }
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  const getSelectedMembers = () => {
    return teamMembers.filter(m => selectedIds.includes(m.id))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign Case to Team Members</DialogTitle>
          <DialogDescription>
            Select team members to assign this case to. Only your team members are shown.
          </DialogDescription>
        </DialogHeader>

        {loadingMembers ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Team Members List */}
            <div>
              <h4 className="text-sm font-medium mb-3">Select Team Members</h4>
              <ScrollArea className="h-72 rounded-md border p-4">
                {teamMembers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Users className="h-12 w-12 text-muted-foreground mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      No team members available
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Contact your administrator to add members to your team
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {teamMembers.map(member => (
                      <div
                        key={member.id}
                        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted"
                      >
                        <Checkbox
                          id={`member-${member.id}`}
                          checked={selectedIds.includes(member.id)}
                          onCheckedChange={() => handleToggleMember(member.id)}
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-secondary text-xs">
                            {getInitials(member.first_name, member.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <label
                          htmlFor={`member-${member.id}`}
                          className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                        >
                          {member.first_name} {member.last_name}
                          <span className="text-muted-foreground text-xs block">{member.email}</span>
                        </label>
                        <Badge variant="outline" className="text-xs">
                          {member.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Selected Members Preview */}
            {selectedIds.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Selected ({selectedIds.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {getSelectedMembers().map(member => (
                    <Badge key={member.id} variant="secondary" className="gap-1 pr-1">
                      {member.first_name} {member.last_name}
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="ml-1 hover:bg-muted rounded-full p-0.5"
                        disabled={loading}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedIds(currentAssignments.map(a => a.id))
              onOpenChange(false)
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={loading || loadingMembers}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              'Apply Assignments'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
