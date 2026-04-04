'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { deleteCase } from '@/app/actions/delete-entities'

interface DeleteCaseModalProps {
  caseId: string
  caseNumber: string
  caseTitle: string
}

export function DeleteCaseModal({ caseId, caseNumber, caseTitle }: DeleteCaseModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)

    try {
      const result = await deleteCase(caseId)
      
      if (result.success) {
        setIsOpen(false)
        router.refresh()
      } else {
        setError(result.error || 'Failed to delete case')
      }
    } catch (error) {
      setError('An unexpected error occurred')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 hover:border-destructive/30"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Case
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Case
          </DialogTitle>
        </DialogHeader>
        
        <div className="text-left space-y-3">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete case <strong className="text-foreground">{caseNumber}</strong>?
          </p>
          <p className="text-sm text-muted-foreground">
            Title: <span className="text-foreground">{caseTitle}</span>
          </p>
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <div className="text-sm text-destructive font-medium">
              ⚠️ This action cannot be undone
            </div>
            <div className="text-xs text-destructive/80 mt-1">
              All case data including files, services, and audit logs will be permanently deleted.
              Files will also be removed from S3 storage.
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Case
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
