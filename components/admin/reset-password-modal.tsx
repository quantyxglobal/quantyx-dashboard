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
import { Eye, EyeOff, KeyRound, Mail, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { resetClientPassword } from '@/app/actions/reset-client-password'

interface ResetPasswordModalProps {
  userId: string
  userName: string
  userEmail?: string
  userRole: string
  isSuperAdmin?: boolean
}

export function ResetPasswordModal({ userId, userName, userEmail, userRole, isSuperAdmin = false }: ResetPasswordModalProps) {
  const [open, setOpen] = useState(false)
  const [showPasswords, setShowPasswords] = useState({ new: false, confirm: false })
  const [isLoading, setIsLoading] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak')
  const [showStrength, setShowStrength] = useState(false)
  const [resetMethod, setResetMethod] = useState<'manual' | 'email'>('manual')
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  
  // Super admins can reset passwords for all roles except other super admins
  if (!isSuperAdmin) {
    return null
  }

  if (userRole === 'SUPER_ADMIN') {
    return (
      <Button variant="outline" size="sm" disabled title="Cannot reset password for super administrators">
        <KeyRound className="h-4 w-4 mr-2" />
        Reset Password
      </Button>
    )
  }
  
  const generateRandomPassword = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    // Ensure it has at least one uppercase, lowercase, number, and special char
    return password + 'A1!'
  }

  const handleGeneratePassword = () => {
    const newPassword = generateRandomPassword()
    setGeneratedPassword(newPassword)
    
    // Auto-fill the password fields
    const newPasswordInput = document.getElementById('newPassword') as HTMLInputElement
    const confirmPasswordInput = document.getElementById('confirmPassword') as HTMLInputElement
    
    if (newPasswordInput && confirmPasswordInput) {
      newPasswordInput.value = newPassword
      confirmPasswordInput.value = newPassword
      setShowStrength(true)
      setPasswordStrength(calculatePasswordStrength(newPassword))
    }
  }

  const handleCopyPassword = async () => {
    if (generatedPassword) {
      await navigator.clipboard.writeText(generatedPassword)
      setCopied(true)
      toast.success('Password copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSendEmail = async () => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/admin/reset-user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userEmail })
      })

      const result = await response.json()
      setIsLoading(false)

      if (!response.ok) {
        toast.error(result.error || 'Failed to send reset email')
        return
      }

      toast.success(result.message || 'Password reset email sent successfully')
      
      // If temporary password is returned (fallback), show it
      if (result.temporaryPassword) {
        setGeneratedPassword(result.temporaryPassword)
        toast.info('Please share the temporary password with the user', {
          duration: 10000
        })
      }
      
      if (result.resetLink && process.env.NODE_ENV === 'development') {
        console.log('Reset link (dev only):', result.resetLink)
      }
      
      setOpen(false)
    } catch (error) {
      setIsLoading(false)
      console.error('Error sending reset email:', error)
      toast.error('Network error. Please try again.')
    }
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
      
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.message || 'Password reset successfully')
        form.reset()
        setPasswordStrength('weak')
        setShowStrength(false)
        setGeneratedPassword(null)
        setOpen(false)
      }
    } catch (error) {
      setIsLoading(false)
      console.error('Network error during password reset:', error)
      
      toast.error('Network error. Please check your connection.', {
        action: {
          label: 'Retry',
          onClick: () => {
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
            Choose how to reset the password for this user.
          </DialogDescription>
        </DialogHeader>
        
        {/* Method Selection */}
        <div className="space-y-3">
          <Label>Reset Method</Label>
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant={resetMethod === 'manual' ? 'default' : 'outline'}
              onClick={() => setResetMethod('manual')}
              className="w-full"
            >
              <KeyRound className="h-4 w-4 mr-2" />
              Manual
            </Button>
            <Button
              type="button"
              variant={resetMethod === 'email' ? 'default' : 'outline'}
              onClick={() => setResetMethod('email')}
              className="w-full"
            >
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
          </div>
        </div>

        {resetMethod === 'email' ? (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm text-muted-foreground">
                A password reset link will be sent to:
              </p>
              <p className="text-sm font-medium">{userEmail || 'User email'}</p>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendEmail} disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send Reset Email'}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Generate Password Button */}
            <Button
              type="button"
              variant="secondary"
              onClick={handleGeneratePassword}
              className="w-full"
            >
              Generate Secure Password
            </Button>

            {generatedPassword && (
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Generated Password</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyPassword}
                    className="h-8"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <code className="text-sm font-mono block bg-background p-2 rounded">
                  {generatedPassword}
                </code>
                <p className="text-xs text-muted-foreground">
                  Copy this password and share it securely with the user
                </p>
              </div>
            )}
            
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
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPasswords.new ? 'Hide new password' : 'Show new password'}
                >
                  {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
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
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
