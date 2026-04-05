'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { resetClientPassword } from '@/app/actions/reset-client-password'

interface ResetPasswordModalProps {
  userId: string
  userName: string
  userRole: 'admin' | 'client'
}

export function ResetPasswordModal({ userId, userName, userRole }: ResetPasswordModalProps) {
  const [open, setOpen] = useState(false)
  const [showPasswords, setShowPasswords] = useState({ new: false, confirm: false })
  const [isLoading, setIsLoading] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak')
  const [showStrength, setShowStrength] = useState(false)
  
  // Only SUPER_ADMIN can reset passwords
  // This button should only be shown to SUPER_ADMIN users
  if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'EMPLOYEE') {
    return (
      <Button variant="outline" size="sm" disabled>
        <KeyRound className="h-4 w-4 mr-2" />
        Reset Password
      </Button>
    )
  }
  
  const calculatePasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
    let strength = 0
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    
    if (strength <= 2) return 'weak'
    if (strength <= 4) return 'medium'
    return 'strong'
  }
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      const form = e.currentTarget
      const formData = new FormData(form)
      formData.append('targetUserId', userId)
      
      const result = await resetClientPassword(formData)
      
      setIsLoading(false)
      
      // Requirement 8.1, 8.3: Display appropriate feedback
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.message)
        // Reset form before closing modal
        form.reset()
        setPasswordStrength('weak')
        setShowStrength(false)
        setOpen(false)
      }
    } catch (error) {
      // Requirement 8.5: Network error handling with retry option
      setIsLoading(false)
      console.error('Network error during password reset:', error)
      
      toast.error('Network error. Please check your connection.', {
        action: {
          label: 'Retry',
          onClick: () => {
            // Retry by re-submitting the form
            handleSubmit(e)
          }
        }
      })
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound className="h-4 w-4 mr-2" />
          Reset Password
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password for {userName}</DialogTitle>
          <DialogDescription>
            Set a new password for this user. They will need to use this password to log in.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Requirement 3.3: New Password field */}
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                name="newPassword"
                type={showPasswords.new ? 'text' : 'password'}
                required
                onChange={(e) => {
                  setShowStrength(e.target.value.length > 0)
                  setPasswordStrength(calculatePasswordStrength(e.target.value))
                }}
                className="pr-10"
              />
              {/* Requirement 5.5: Password visibility toggle */}
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPasswords.new ? 'Hide new password' : 'Show new password'}
              >
                {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            
            {/* Requirement 5.4: Password Strength Indicator */}
            {showStrength && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  <div className={`h-1 flex-1 rounded ${passwordStrength === 'weak' ? 'bg-red-500' : passwordStrength === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                  <div className={`h-1 flex-1 rounded ${passwordStrength === 'medium' || passwordStrength === 'strong' ? 'bg-yellow-500' : 'bg-muted'}`} />
                  <div className={`h-1 flex-1 rounded ${passwordStrength === 'strong' ? 'bg-green-500' : 'bg-muted'}`} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Password strength: <span className="capitalize">{passwordStrength}</span>
                </p>
              </div>
            )}
          </div>
          
          {/* Requirement 3.3: Confirm Password field */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showPasswords.confirm ? 'text' : 'password'}
                required
                className="pr-10"
              />
              {/* Requirement 5.5: Password visibility toggle */}
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPasswords.confirm ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {/* Requirement 3.3: Submit button with loading state */}
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
