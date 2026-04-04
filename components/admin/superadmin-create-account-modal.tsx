'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAccountBySuperAdmin } from '@/app/actions/create-account-superadmin'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserPlus, Loader2, Key, Mail, Shield } from 'lucide-react'
import { toast } from 'sonner'

interface Firm {
  id: string
  name: string
}

interface SuperAdminCreateAccountModalProps {
  firms: Firm[]
}

export function SuperAdminCreateAccountModal({ firms }: SuperAdminCreateAccountModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [useAutoPassword, setUseAutoPassword] = useState(true)
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true)
  const [accountType, setAccountType] = useState<'ADMIN' | 'CLIENT' | 'EMPLOYEE'>('CLIENT')
  const [selectedOrg, setSelectedOrg] = useState<string>('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    
    // Validate organization selection for CLIENT and EMPLOYEE
    if ((accountType === 'CLIENT' || accountType === 'EMPLOYEE') && !selectedOrg) {
      toast.error('Please select an organization')
      return
    }
    
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    
    // Validate required fields
    const firstName = formData.get('firstName') as string
    const lastName = formData.get('lastName') as string
    const email = formData.get('email') as string
    
    if (!firstName || !firstName.trim()) {
      toast.error('First name is required')
      setLoading(false)
      return
    }
    
    if (!lastName || !lastName.trim()) {
      toast.error('Last name is required')
      setLoading(false)
      return
    }
    
    if (!email || !email.trim()) {
      toast.error('Email address is required')
      setLoading(false)
      return
    }
    
    // Validate password if not auto-generating
    if (!useAutoPassword) {
      const password = formData.get('password') as string
      if (!password || password.length < 8) {
        toast.error('Password must be at least 8 characters')
        setLoading(false)
        return
      }
    }
    
    // Add preferences
    if (useAutoPassword) {
      formData.delete('password')
    }
    formData.append('sendWelcomeEmail', sendWelcomeEmail.toString())
    formData.append('accountType', accountType)
    
    const result = await createAccountBySuperAdmin(formData)

    if (result.success) {
      toast.success(result.message)
      setOpen(false)
      router.refresh()
      e.currentTarget.reset()
      setUseAutoPassword(true)
      setSendWelcomeEmail(true)
      setAccountType('CLIENT')
      setSelectedOrg('')
    } else {
      toast.error(result.error)
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-destructive to-destructive/80 hover:opacity-90 text-destructive-foreground shadow-elegant transition-all duration-300">
          <UserPlus className="h-4 w-4 mr-2" />
          Create Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-destructive/20 to-destructive/10">
              <Shield className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Create New Account</DialogTitle>
              <DialogDescription>
                Create a new admin, employee, or client account with full control
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <form onSubmit={handleSubmit} className="space-y-4" id="create-account-form">
          <div className="space-y-2">
            <Label htmlFor="accountType" className="text-sm font-medium">Account Type</Label>
            <Select value={accountType} onValueChange={(value: 'ADMIN' | 'CLIENT' | 'EMPLOYEE') => setAccountType(value)}>
              <SelectTrigger className="transition-all focus:ring-2 focus:ring-destructive">
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CLIENT">Client Account</SelectItem>
                <SelectItem value="ADMIN">Admin Account</SelectItem>
                <SelectItem value="EMPLOYEE">Employee Account</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {accountType === 'ADMIN' 
                ? 'Admin accounts can manage cases and users within their organization' 
                : accountType === 'EMPLOYEE'
                ? 'Employee accounts can view cases and download files (no password/status changes)'
                : 'Client accounts can view and create cases'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="organizationId" className="text-sm font-medium">
              Organization {(accountType === 'CLIENT' || accountType === 'EMPLOYEE') && <span className="text-destructive">*</span>}
            </Label>
            <Select 
              name="organizationId" 
              value={selectedOrg}
              onValueChange={setSelectedOrg}
              required={accountType === 'CLIENT' || accountType === 'EMPLOYEE'}
            >
              <SelectTrigger className="transition-all focus:ring-2 focus:ring-destructive">
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {accountType === 'ADMIN' && (
                  <SelectItem value="none">No Organization (System Admin)</SelectItem>
                )}
                {firms.map((firm) => (
                  <SelectItem key={firm.id} value={firm.id}>
                    {firm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {accountType === 'ADMIN' 
                ? 'Optional: Assign to an organization or leave as system admin' 
                : accountType === 'EMPLOYEE'
                ? 'Required: Employee must belong to Quantyx Global organization'
                : 'Required: Client must belong to an organization'}
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
                className="transition-all focus:ring-2 focus:ring-destructive"
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
                className="transition-all focus:ring-2 focus:ring-destructive"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="e.g., john@example.com"
              required
              disabled={loading}
              className="transition-all focus:ring-2 focus:ring-destructive"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="useAutoPassword"
                checked={useAutoPassword}
                onCheckedChange={(checked) => setUseAutoPassword(checked === true)}
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
                  className="transition-all focus:ring-2 focus:ring-destructive"
                />
                <p className="text-xs text-muted-foreground">
                  User can change this password after first login
                </p>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendWelcomeEmail"
                checked={sendWelcomeEmail}
                onCheckedChange={(checked) => setSendWelcomeEmail(checked === true)}
                disabled={loading}
              />
              <Label htmlFor="sendWelcomeEmail" className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Send welcome email with login credentials
              </Label>
            </div>
          </div>

          <div className="bg-destructive/5 p-4 rounded-lg border border-destructive/20">
            <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-destructive" />
              Account Setup
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Account type: {accountType === 'ADMIN' ? 'Administrator' : accountType === 'EMPLOYEE' ? 'Employee' : 'Client'}</li>
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
              <li>• User can change their password after first login</li>
              <li>• Account will be created immediately</li>
            </ul>
          </div>

          </form>
        </div>
        <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-border bg-background">
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
            form="create-account-form"
            disabled={loading}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg transition-all duration-300"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Account...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Create {accountType === 'ADMIN' ? 'Admin' : accountType === 'EMPLOYEE' ? 'Employee' : 'Client'} Account
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
