'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { changeOwnPassword } from '@/app/actions/change-password'

/**
 * Change Password Form Component
 * Requirements: 5.1, 5.3, 5.4, 5.5, 8.1, 8.3
 */
export function ChangePasswordForm() {
  const router = useRouter()
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  const [isLoading, setIsLoading] = useState(false)
  const [newPasswordValue, setNewPasswordValue] = useState('')
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak')
  
  /**
   * Calculate password strength based on complexity
   * Requirement 5.4: Real-time password strength indicator
   */
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
  
  /**
   * Handle form submission
   * Requirements: 8.1, 8.3, 8.5 - Toast notifications for success and error feedback, network error handling with retry
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      const formData = new FormData(e.currentTarget)
      const result = await changeOwnPassword(formData)
      
      setIsLoading(false)
      
      if (result.error) {
        // Requirement 8.1: Display specific error messages
        toast.error(result.error)
      } else {
        // Requirement 8.3: Display success message before redirect
        toast.success('Password changed successfully. Please log in again.')
        // Redirect to login after short delay
        setTimeout(() => {
          router.push('/login')
        }, 1500)
      }
    } catch (error) {
      // Requirement 8.5: Network error handling with retry option
      setIsLoading(false)
      console.error('Network error during password change:', error)
      
      toast.error('Network error. Please check your connection.', {
        action: {
          label: 'Retry',
          onClick: () => {
            // Retry by re-submitting the form
            const form = e.currentTarget
            if (form) {
              handleSubmit(e)
            }
          }
        }
      })
    }
  }
  
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Change Password
        </CardTitle>
        <CardDescription>
          Update your password to keep your account secure. You will be logged out after changing your password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password - Requirement 5.1 */}
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                name="currentPassword"
                type={showPasswords.current ? 'text' : 'password'}
                required
                className="pr-10"
              />
              {/* Requirement 5.5: Password visibility toggle */}
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPasswords.current ? 'Hide current password' : 'Show current password'}
              >
                {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          
          {/* New Password - Requirement 5.1 */}
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                name="newPassword"
                type={showPasswords.new ? 'text' : 'password'}
                required
                onChange={(e) => {
                  setNewPasswordValue(e.target.value)
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
            {newPasswordValue && (
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
            
            {/* Requirement 5.3: Display password requirements list */}
            <div className="text-xs text-muted-foreground space-y-1 mt-2">
              <p className="font-medium">Password must contain:</p>
              <ul className="space-y-1 ml-4">
                <li>• At least 8 characters</li>
                <li>• One uppercase letter</li>
                <li>• One lowercase letter</li>
                <li>• One number</li>
              </ul>
            </div>
          </div>
          
          {/* Confirm Password - Requirement 5.1 */}
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
          
          {/* Submit Button - Requirement 5.1: Form submission with loading state */}
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Changing Password...' : 'Change Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
