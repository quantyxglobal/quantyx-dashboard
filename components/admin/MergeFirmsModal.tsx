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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { GitMerge, Loader2, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Firm {
  id: string
  name: string
  firm_sequence: number
  _count: {
    users: number
    cases: number
  }
}

interface MergeFirmsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceFirm: Firm
  allFirms: Firm[]
  onSuccess: () => void
}

export function MergeFirmsModal({ open, onOpenChange, sourceFirm, allFirms, onSuccess }: MergeFirmsModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [targetFirmId, setTargetFirmId] = useState('')
  const { toast } = useToast()
  const router = useRouter()

  const availableFirms = allFirms.filter(f => f.id !== sourceFirm.id)
  const targetFirm = availableFirms.find(f => f.id === targetFirmId)

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

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/admin/firms/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFirmId: sourceFirm.id,
          targetFirmId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to merge firms')
      }

      toast({
        title: 'Firms Merged',
        description: `${sourceFirm.name} has been merged into ${targetFirm?.name}`
      })

      onSuccess()
      onOpenChange(false)
      router.refresh()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to merge firms',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-purple-600" />
            Merge Firms
          </DialogTitle>
          <DialogDescription>
            Merge {sourceFirm.name} into another firm. All users and cases will be transferred.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This action cannot be undone. The source firm will be deleted after merging.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Source Firm (will be deleted)</Label>
            <div className="p-3 bg-muted rounded border">
              <p className="font-medium">{sourceFirm.name}</p>
              <p className="text-sm text-muted-foreground">
                {sourceFirm._count.users} users • {sourceFirm._count.cases} cases
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetFirm">Target Firm (will receive all data)</Label>
            <Select value={targetFirmId} onValueChange={setTargetFirmId}>
              <SelectTrigger id="targetFirm">
                <SelectValue placeholder="Select target firm" />
              </SelectTrigger>
              <SelectContent>
                {availableFirms.map((firm) => (
                  <SelectItem key={firm.id} value={firm.id}>
                    {firm.name} ({firm._count.users} users, {firm._count.cases} cases)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {targetFirm && (
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                After merge:
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                {targetFirm.name} will have {targetFirm._count.users + sourceFirm._count.users} users and {targetFirm._count.cases + sourceFirm._count.cases} cases
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !targetFirmId}
              variant="destructive"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Merge Firms
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
