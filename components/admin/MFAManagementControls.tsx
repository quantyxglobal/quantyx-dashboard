'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Shield, Users, AlertTriangle } from 'lucide-react'
import { 
  enableMFAForAllUsers, 
  disableMFAForAllUsers 
} from '@/app/actions/manage-user-mfa'

export function MFAManagementControls() {
  const [loading, setLoading] = useState(false)
  const [showEnableDialog, setShowEnableDialog] = useState(false)
  const [showDisableDialog, setShowDisableDialog] = useState(false)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])

  const roles = [
    { value: 'CLIENT', label: 'Clients' },
    { value: 'EMPLOYEE', label: 'Employees' },
    { value: 'ADMIN', label: 'Admins' }
  ]

  const handleRoleToggle = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    )
  }

  const handleEnableMFA = async () => {
    if (selectedRoles.length === 0) {
      toast.error('Please select at least one role')
      return
    }

    setLoading(true)
    try {
      const result = await enableMFAForAllUsers(selectedRoles)
      
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setShowEnableDialog(false)
      setSelectedRoles([])
    } catch (error) {
      toast.error('Failed to enable MFA')
    } finally {
      setLoading(false)
    }
  }

  const handleDisableMFA = async () => {
    if (selectedRoles.length === 0) {
      toast.error('Please select at least one role')
      return
    }

    setLoading(true)
    try {
      const result = await disableMFAForAllUsers(selectedRoles)
      
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setShowDisableDialog(false)
      setSelectedRoles([])
    } catch (error) {
      toast.error('Failed to disable MFA')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>MFA Management</CardTitle>
              <CardDescription>
                Manage two-factor authentication for all users
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enable or disable MFA requirements for multiple users at once based on their role.
          </p>

          <div className="flex gap-3">
            <Button
              onClick={() => {
                setSelectedRoles([])
                setShowEnableDialog(true)
              }}
              variant="default"
              className="flex-1 gap-2"
            >
              <Shield className="h-4 w-4" />
              Enable MFA for Users
            </Button>

            <Button
              onClick={() => {
                setSelectedRoles([])
                setShowDisableDialog(true)
              }}
              variant="destructive"
              className="flex-1 gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              Disable MFA for Users
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Enable MFA Dialog */}
      <Dialog open={showEnableDialog} onOpenChange={setShowEnableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Enable MFA Requirement
            </DialogTitle>
            <DialogDescription>
              Select which user roles should be required to set up MFA on their next login.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                Users will be prompted to set up two-factor authentication the next time they log in.
              </p>
            </div>

            <div className="space-y-3">
              <Label>Select Roles:</Label>
              {roles.map((role) => (
                <div key={role.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`enable-${role.value}`}
                    checked={selectedRoles.includes(role.value)}
                    onCheckedChange={() => handleRoleToggle(role.value)}
                  />
                  <label
                    htmlFor={`enable-${role.value}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {role.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEnableDialog(false)
                setSelectedRoles([])
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEnableMFA}
              disabled={loading || selectedRoles.length === 0}
            >
              {loading ? 'Enabling...' : 'Enable MFA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable MFA Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Disable MFA
            </DialogTitle>
            <DialogDescription>
              Select which user roles should have MFA completely disabled.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
              <p className="text-sm text-amber-800 font-medium mb-1">
                ⚠️ Warning: This will reduce account security
              </p>
              <p className="text-xs text-amber-700">
                This will completely disable MFA for selected users, including removing their existing MFA setup and backup codes.
              </p>
            </div>

            <div className="space-y-3">
              <Label>Select Roles:</Label>
              {roles.map((role) => (
                <div key={role.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`disable-${role.value}`}
                    checked={selectedRoles.includes(role.value)}
                    onCheckedChange={() => handleRoleToggle(role.value)}
                  />
                  <label
                    htmlFor={`disable-${role.value}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {role.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDisableDialog(false)
                setSelectedRoles([])
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisableMFA}
              disabled={loading || selectedRoles.length === 0}
            >
              {loading ? 'Disabling...' : 'Disable MFA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
