'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserCheck, Loader2, AlertCircle, Building2 } from 'lucide-react'
import { assignUserToFirm } from '@/app/actions/assign-user-to-firm'
import { toast } from 'sonner'

const assignUserSchema = z.object({
  userId: z.string().min(1, 'Please select a user'),
  firmId: z.string().min(1, 'Please select a firm'),
})

type AssignUserFormData = z.infer<typeof assignUserSchema>

interface User {
  id: string
  name: string
  email: string
  role: string
  created_at: Date
}

interface Firm {
  id: string
  name: string
  firm_sequence: number
}

interface AssignUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orphanedUsers: User[]
  firms: Firm[]
  onSuccess: () => void
}

export function AssignUserModal({ open, onOpenChange, orphanedUsers, firms, onSuccess }: AssignUserModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<AssignUserFormData>({
    resolver: zodResolver(assignUserSchema),
    mode: 'onBlur',
  })

  const selectedUserId = watch('userId')
  const selectedFirmId = watch('firmId')
  const selectedUser = orphanedUsers.find(user => user.id === selectedUserId)
  const selectedFirm = firms.find(firm => firm.id === selectedFirmId)

  const onSubmit = async (data: AssignUserFormData) => {
    setIsSubmitting(true)
    
    try {
      const formData = new FormData()
      formData.append('userId', data.userId)
      formData.append('firmId', data.firmId)
      
      const result = await assignUserToFirm(formData)
      
      if (result.success) {
        toast.success(result.message)
        reset()
        onSuccess()
      } else {
        toast.error(result.error)
      }
    } catch (error: any) {
      console.error('Assign user error:', error)
      toast.error('Failed to assign user. Please try again.')
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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Assign User to Firm</DialogTitle>
          <DialogDescription>
            Assign unassigned users to law firms so they can access the system properly.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Select User</Label>
            <Select 
              value={selectedUserId || ''} 
              onValueChange={(value) => setValue('userId', value)}
              disabled={isSubmitting}
            >
              <SelectTrigger className={errors.userId ? 'border-destructive' : ''}>
                <SelectValue placeholder="Choose a user to assign" />
              </SelectTrigger>
              <SelectContent>
                {orphanedUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium">
                          {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.userId && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>{errors.userId.message}</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Select Firm</Label>
            <Select 
              value={selectedFirmId || ''} 
              onValueChange={(value) => setValue('firmId', value)}
              disabled={isSubmitting}
            >
              <SelectTrigger className={errors.firmId ? 'border-destructive' : ''}>
                <SelectValue placeholder="Choose a firm" />
              </SelectTrigger>
              <SelectContent>
                {firms.map((firm) => (
                  <SelectItem key={firm.id} value={firm.id}>
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-primary" />
                      <div>
                        <p className="font-medium">{firm.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Firm #{firm.firm_sequence.toString().padStart(4, '0')}
                        </p>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.firmId && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>{errors.firmId.message}</span>
              </div>
            )}
          </div>

          {selectedUser && selectedFirm && (
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-foreground mb-2">Assignment Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User:</span>
                  <span className="font-medium">{selectedUser.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span>{selectedUser.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Will be assigned to:</span>
                  <span className="font-medium">{selectedFirm.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Firm sequence:</span>
                  <span>#{selectedFirm.firm_sequence.toString().padStart(4, '0')}</span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="text-sm font-medium text-blue-900 mb-2">What happens next?</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• The user will be assigned to the selected firm</li>
              <li>• They will gain access to all cases belonging to that firm</li>
              <li>• Cases they create will use the firm&apos;s sequence number</li>
              <li>• They can&apos;t invite other users to join the same firm</li>
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
              disabled={isSubmitting || !selectedUserId || !selectedFirmId}
              className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 text-primary-foreground shadow-elegant transition-all duration-300"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Assign User
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}