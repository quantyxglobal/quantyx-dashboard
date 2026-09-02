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
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

interface EditTeamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  team: {
    id: string
    name: string | null
    manager: {
      id: string
      first_name: string
      last_name: string
    }
  }
  onUpdated: () => void
}

export default function EditTeamDialog({
  open,
  onOpenChange,
  team,
  onUpdated
}: EditTeamDialogProps) {
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      const defaultName = team.name || `${team.manager.first_name} ${team.manager.last_name}'s Team`
      setTeamName(defaultName)
    }
  }, [open, team])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!teamName.trim()) {
      toast({
        title: 'Error',
        description: 'Team name cannot be empty',
        variant: 'destructive'
      })
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teamName.trim()
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update team')
      }

      onUpdated()
      handleClose()
    } catch (error) {
      console.error('Error updating team:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update team',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Team</DialogTitle>
          <DialogDescription>
            Update team information
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="teamName">Team Name</Label>
            <Input
              id="teamName"
              placeholder="Enter team name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium mb-1">Manager</p>
            <p className="text-muted-foreground">
              {team.manager.first_name} {team.manager.last_name}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              To change the manager, delete this team and create a new one
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
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
