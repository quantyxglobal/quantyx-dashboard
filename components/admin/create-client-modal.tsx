'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientAccount } from '@/app/actions/create-client-account'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { UserPlus, Loader2, Key, Mail } from 'lucide-react'
import { toast } from 'sonner'

export function CreateClientModal() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [useAutoPassword, setUseAutoPassword] = useState(true)
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    
    const formData = new FormData(e.currentTarget)
    
    // Validate required fields
    const organizationName = formData.get('organizationName') as string
    const firstName = formData.get('firstName') as string
    const lastName = formData.get('lastName') as string
    const clientEmail = formData.get('clientEmail') as string
    
    if (!organizationName || !organizationName.trim()) {
      toast.error('Organization name is required')
      return
    }
    
    if (!firstName || !firstName.trim()) {
      toast.error('First name is required')
      return
    }
    
    if (!lastName || !lastName.trim()) {
      toast.error('Last name is required')
      return
    }
    
    if (!clientEmail || !clientEmail.trim()) {
      toast.error('Email address is required')
      return
    }
    
    // Validate password if not auto-generating
    if (!useAutoPassword) {
      const password = formData.get('password') as string
      if (!password || password.length < 8) {
        toast.error('Password must be at least 8 characters')
        return
      }
    }
    
    setLoading(true)
    
    // Add auto-password and email preferences
    if (useAutoPassword) {
      formData.delete('password') // Remove manual password if auto-generating
    }
    formData.append('sendWelcomeEmail', sendWelcomeEmail.toString())
    
    const result = await createClientAccount(formData)

    if (result.success) {
      toast.success(result.message)
      setOpen(false)
      router.refresh()
      // Reset form
      e.currentTarget.reset()
      setUseAutoPassword(true)
      setSendWelcomeEmail(true)
    } else {
      toast.error(result.error)
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 text-primary-foreground shadow-elegant transition-all duration-300">
          <UserPlus className="h-4 w-4 mr-2" />
          Create Client Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Client Account</DialogTitle>
          <DialogDescription>
            Create a new client user account with organization details. The client will receive login credentials and be able to access their cases.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="organizationName" className="text-sm font-medium">
              Organization Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="organizationName"
              name="organizationName"
              placeholder="e.g., Smith & Associates Law Firm"
              required
              disabled={loading}
              className="transition-all focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">
              If organization exists, user will be added to it
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-sm font-medium">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                name="firstName"
                placeholder="e.g., John"
                required
                disabled={loading}
                className="transition-all focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-sm font-medium">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                name="lastName"
                placeholder="e.g., Smith"
                required
                disabled={loading}
                className="transition-all focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientEmail" className="text-sm font-medium">
              Email Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="clientEmail"
              name="clientEmail"
              type="email"
              placeholder="e.g., john@smithlaw.com"
              required
              disabled={loading}
              className="transition-all focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine1" className="text-sm font-medium">
              Address Line 1
            </Label>
            <Input
              id="addressLine1"
              name="addressLine1"
              placeholder="e.g., 123 Main Street"
              disabled={loading}
              className="transition-all focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine2" className="text-sm font-medium">
              Address Line 2
            </Label>
            <Input
              id="addressLine2"
              name="addressLine2"
              placeholder="e.g., Suite 100"
              disabled={loading}
              className="transition-all focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city" className="text-sm font-medium">
                City
              </Label>
              <Input
                id="city"
                name="city"
                placeholder="e.g., New York"
                disabled={loading}
                className="transition-all focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state" className="text-sm font-medium">
                State
              </Label>
              <Input
                id="state"
                name="state"
                placeholder="e.g., NY"
                disabled={loading}
                className="transition-all focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country" className="text-sm font-medium">
                Country
              </Label>
              <Input
                id="country"
                name="country"
                placeholder="e.g., USA"
                disabled={loading}
                className="transition-all focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="useAutoPassword"
                checked={useAutoPassword}
                onCheckedChange={setUseAutoPassword}
                disabled={loading}
              />
              <Label htmlFor="useAutoPassword" className="text-sm font-medium flex items-center gap-2">
                <Key className="h-4 w-4" />
                Auto-generate secure password
              </Label>
            </div>
            
            {!useAutoPassword && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Initial Password <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  required={!useAutoPassword}
                  disabled={loading}
                  className="transition-all focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground">
                  Client can change this password after first login
                </p>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendWelcomeEmail"
                checked={sendWelcomeEmail}
                onCheckedChange={setSendWelcomeEmail}
                disabled={loading}
              />
              <Label htmlFor="sendWelcomeEmail" className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Send welcome email with login credentials
              </Label>
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-foreground mb-2">Account Setup</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {useAutoPassword ? (
                <>
                  <li>• A secure password will be auto-generated</li>
                  <li>• Login credentials will be sent via email</li>
                </>
              ) : (
                <>
                  <li>• The provided password will be used</li>
                  {sendWelcomeEmail && <li>• Welcome email will include login instructions</li>}
                </>
              )}
              <li>• Client can change their password after first login</li>
              <li>• Account will be created immediately</li>
            </ul>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="transition-all hover:bg-muted"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 text-primary-foreground shadow-elegant transition-all duration-300"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Account
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
