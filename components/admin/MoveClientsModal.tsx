'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { UserCog, Loader2 } from 'lucide-react'

interface User {
  id: string
  name: string
  email: string
  role: string
}

interface Firm {
  id: string
  name: string
  firm_sequence: number
  users: User[]
}

interface MoveClientsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceFirm: Firm
  allFirms: Firm[]
  onSuccess: () => void
}

export function MoveClientsModal({ open, onOpenChange, sourceFirm, allFirms, onSuccess }: MoveClientsModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [targetFirmId, setTargetFirmId] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const { toast } = useToast()
  const router = useRouter()

  const availableFirms = allFirms.filter(f => f.id !== sourceFirm.id)
  const targetFirm = availableFirms.find(f => f.id === targetFirmId)

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const toggleAll = () => {
    if (selectedUserIds.length === sourceFirm.users.length) {
      setSelectedUserIds([])
    } else {
      setSelectedUserIds(sourceFirm.users.map(u => u.id))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!targetFirmId) {
      toast({
        title: 'Error',
        description: 'Please select a target firm',
        variant: 'destructive'
      })
      return
    }

    if (selectedUserIds.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one user to move',
        variant: 'destructive'
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/admin/firms/move-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: selectedUserIds,
          targetFirmId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to move users')
      }

      toast({
        title: 'Users Moved',
        description: `${selectedUserIds.length} user(s) moved to ${targetFirm?.name}`
      })

      onSuccess()
      onOpenChange(false)
      setSelectedUserIds([])
      setTargetFirmId('')
      router.refresh()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to move users',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-orange-600" />
            Move Users Between Firms
          </DialogTitle>
          <DialogDescription>
            Select users from {sourceFirm.name} to move to another firm
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="targetFirm">Target Firm</Label>
            <Select value={targetFirmId} onValueChange={setTargetFirmId}>
              <SelectTrigger id="targetFirm">
                <SelectValue placeholder="Select target firm" />
              </SelectTrigger>
              <SelectContent>
                {availableFirms.map((firm) => (
                  <SelectItem key={firm.id} value={firm.id}>
                    {firm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Users to Move</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleAll}
              >
                {selectedUserIds.length === sourceFirm.users.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            
            <div className="border rounded-md p-4 space-y-3 max-h-[300px] overflow-y-auto">
              {sourceFirm.users.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No users in this firm
                </p>
              ) : (
                sourceFirm.users.map((user) => (
                  <div key={user.id} className="flex items-center space-x-3 p-2 hover:bg-muted rounded">
                    <Checkbox
                      id={user.id}
                      checked={selectedUserIds.includes(user.id)}
                      onCheckedChange={() => toggleUser(user.id)}
                    />
                    <label
                      htmlFor={user.id}
                      className="flex-1 cursor-pointer"
                    >
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </label>
                    <span className="text-xs px-2 py-1 bg-muted rounded capitalize">
                      {user.role.toLowerCase()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {selectedUserIds.length > 0 && targetFirm && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                {selectedUserIds.length} user(s) will be moved to {targetFirm.name}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                setSelectedUserIds([])
                setTargetFirmId('')
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !targetFirmId || selectedUserIds.length === 0}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Move Users
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
