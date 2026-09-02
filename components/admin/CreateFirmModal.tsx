'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Building2, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { createFirm } from '@/app/actions/create-firm'
import { toast } from 'sonner'

const createFirmSchema = z.object({
  name: z.string().min(2, 'Firm name must be at least 2 characters'),
})

type CreateFirmFormData = z.infer<typeof createFirmSchema>

interface CreateFirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateFirmModal({ open, onOpenChange, onSuccess }: CreateFirmModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, touchedFields },
    reset
  } = useForm<CreateFirmFormData>({
    resolver: zodResolver(createFirmSchema),
    mode: 'onBlur',
  })

  const onSubmit = async (data: CreateFirmFormData) => {
    setIsSubmitting(true)
    
    try {
      const formData = new FormData()
      formData.append('name', data.name)
      
      console.log('[CreateFirmModal] Submitting firm creation:', data.name)
      const result = await createFirm(formData)
      console.log('[CreateFirmModal] Result:', result)
      
      if (result.success) {
        toast.success(result.message)
        reset()
        onSuccess()
      } else {
        console.error('[CreateFirmModal] Error from server:', result.error)
        toast.error(result.error)
      }
    } catch (error: any) {
      console.error('[CreateFirmModal] Exception during firm creation:', error)
      console.error('[CreateFirmModal] Error stack:', error?.stack)
      toast.error(`Failed to create firm: ${error?.message || 'Unknown error'}. Please try again.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen)
      if (!newOpen) {
        reset()
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Firm</DialogTitle>
          <DialogDescription>
            Create a new law firm entity. Users can be assigned to this firm after creation.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">Firm Name</Label>
            <div className="relative">
              <Input
                id="name"
                type="text"
                placeholder="Smith & Associates Law Firm"
                {...register("name")}
                className={errors.name ? 'border-destructive focus-visible:ring-destructive' : touchedFields.name && !errors.name ? 'border-green-500' : 'transition-all focus:ring-2 focus:ring-primary'}
                disabled={isSubmitting}
              />
              {touchedFields.name && !errors.name && (
                <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-600" />
              )}
              {errors.name && (
                <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
              )}
            </div>
            {errors.name && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>{errors.name.message}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              The firm will be assigned the next available sequence number for case ID generation
            </p>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-foreground mb-2">What happens next?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• A new firm entity will be created with a unique sequence number</li>
              <li>• Users can be assigned to this firm through the user management interface</li>
              <li>• Cases created by firm users will use the firm&apos;s sequence in their case IDs</li>
            </ul>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              className="transition-all hover:bg-muted"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 text-primary-foreground shadow-elegant transition-all duration-300"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4 mr-2" />
                  Create Firm
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}