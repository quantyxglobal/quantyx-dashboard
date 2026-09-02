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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

interface CreateTeamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTeamCreated: () => void
}

interface Manager {
  id: string
  first_name: string
  last_name: string
  email: string
  organization_id: string
}

export default function CreateTeamDialog({
  open,
  onOpenChange,
  onTeamCreated
}: CreateTeamDialogProps) {
  const [teamName, setTeamName] = useState('')
  const [selectedManager, setSelectedManager] = useState('')
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingManagers, setLoadingManagers] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      fetchAvailableManagers()
    }
  }, [open])

  const fetchAvailableManagers = async () => {
    try {
      setLoadingManagers(true)
      // Fetch users with MANAGER role who don't have a team yet
      const response = await fetch('/api/users?role=MANAGER&withoutTeam=true')
      
      if (!response.ok) {
        throw new Error('Failed to fetch managers')
      }

      const data = await response.json()
      setManagers(data.users || [])
    } catch (error) {
      console.error('Error fetching managers:', error)
      toast({
        title: 'Error',
        description: 'Failed to load available managers',
        variant: 'destructive'
      })
    } finally {
      setLoadingManagers(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedManager) {
      toast({
        title: 'Error',
        description: 'Please select a manager',
        variant: 'destructive'
      })
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teamName || undefined,
          managerId: selectedManager
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create team')
      }

      onTeamCreated()
      handleClose()
    } catch (error) {
      console.error('Error creating team:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create team',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setTeamName('')
    setSelectedManager('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Team</DialogTitle>
          <DialogDescription>
            Assign a manager to create a new team. Team name is optional and will be auto-generated if not provided.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manager">Manager *</Label>
            <Select
              value={selectedManager}
              onValueChange={setSelectedManager}
              disabled={loadingManagers || loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a manager" />
              </SelectTrigger>
              <SelectContent>
                {loadingManagers ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : managers.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    No available managers found
                  </div>
                ) : (
                  managers.map(manager => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.first_name} {manager.last_name} ({manager.email})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only managers without an existing team are shown
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="teamName">Team Name (Optional)</Label>
            <Input
              id="teamName"
              placeholder="e.g., East Coast Team, Team Alpha"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to auto-generate based on manager's name
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !selectedManager}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Team
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
