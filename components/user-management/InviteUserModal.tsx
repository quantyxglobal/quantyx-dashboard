'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { UserPlus, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { inviteUser } from '@/app/actions/invite-user'
import { toast } from 'sonner'

const inviteSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['client'], { required_error: 'Please select a role' })
})

type InviteFormData = z.infer<typeof inviteSchema>

interface InviteUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  firmId: string
  firmName: string
  onSuccess: () => void
}

export function InviteUserModal({ open, onOpenChange, firmId, firmName, onSuccess }: InviteUserModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, touchedFields },
    setValue,
    watch,
    reset
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    mode: 'onBlur',
    defaultValues: {
      role: 'client'
    }
  })

  const selectedRole = watch('role')

  const onSubmit = async (data: InviteFormData) => {
    setIsSubmitting(true)
    
    try {
      const formData = new FormData()
      formData.append('firstName', data.firstName)
      formData.append('lastName', data.lastName)
      formData.append('email', data.email)
      formData.append('role', data.role)
      formData.append('firmId', firmId)
      
      const result = await inviteUser(formData)
      
      if (result.success) {
        toast.success(result.message)
        reset()
        onSuccess()
      } else {
        toast.error(result.error)
      }
    } catch (error: any) {
      console.error('Invitation error:', error)
      toast.error('Failed to send invitation. Please try again.')
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
          <DialogTitle>Invite User to {firmName}</DialogTitle>
          <DialogDescription>
            Create a new user account for your firm. They&apos;ll receive an email with their login credentials and a secure auto-generated password.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-sm font-medium">First Name</Label>
              <div className="relative">
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  {...register("firstName")}
                  className={errors.firstName ? 'border-destructive focus-visible:ring-destructive' : touchedFields.firstName && !errors.firstName ? 'border-green-500' : 'transition-all focus:ring-2 focus:ring-primary'}
                  disabled={isSubmitting}
                />
                {touchedFields.firstName && !errors.firstName && (
                  <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-600" />
                )}
                {errors.firstName && (
                  <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
                )}
              </div>
              {errors.firstName && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{errors.firstName.message}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-sm font-medium">Last Name</Label>
              <div className="relative">
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Smith"
                  {...register("lastName")}
                  className={errors.lastName ? 'border-destructive focus-visible:ring-destructive' : touchedFields.lastName && !errors.lastName ? 'border-green-500' : 'transition-all focus:ring-2 focus:ring-primary'}
                  disabled={isSubmitting}
                />
                {touchedFields.lastName && !errors.lastName && (
                  <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-600" />
                )}
                {errors.lastName && (
                  <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
                )}
              </div>
              {errors.lastName && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{errors.lastName.message}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                {...register("email")}
                className={errors.email ? 'border-destructive focus-visible:ring-destructive' : touchedFields.email && !errors.email ? 'border-green-500' : 'transition-all focus:ring-2 focus:ring-primary'}
                disabled={isSubmitting}
              />
              {touchedFields.email && !errors.email && (
                <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-600" />
              )}
              {errors.email && (
                <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
              )}
            </div>
            {errors.email && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>{errors.email.message}</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Role</Label>
            <RadioGroup 
              value={selectedRole} 
              onValueChange={(value) => setValue('role', value as 'client')}
              className="space-y-2"
              disabled={isSubmitting}
            >
              <div className="flex items-center space-x-2 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="client" id="client" />
                <div className="flex-1">
                  <Label htmlFor="client" className="font-medium cursor-pointer">
                    Client User
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Can create and manage cases, upload files, and invite other users
                  </p>
                </div>
              </div>
            </RadioGroup>
            {errors.role && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>{errors.role.message}</span>
              </div>
            )}
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-foreground mb-2">What happens next?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• A user account will be created immediately</li>
              <li>• A secure password will be auto-generated</li>
              <li>• Login credentials will be sent via email</li>
              <li>• The user can log in immediately and change their password</li>
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
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create User Account
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}