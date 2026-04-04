'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Shield, ShieldOff, ShieldCheck, MoreVertical } from 'lucide-react'
import { 
  enableMFAForUser, 
  disableMFAForUser,
  getUserMFAStatus 
} from '@/app/actions/manage-user-mfa'

interface UserMFAActionsProps {
  userId: string
  userName: string
  onUpdate?: () => void
}

export function UserMFAActions({ userId, userName, onUpdate }: UserMFAActionsProps) {
  const [loading, setLoading] = useState(false)
  const [showEnableDialog, setShowEnableDialog] = useState(false)
  const [showDisableDialog, setShowDisableDialog] = useState(false)
  const [mfaStatus, setMfaStatus] = useState<{
    mfaEnabled: boolean
    mfaSetupRequired: boolean
    mfaEnrolledAt: string | null
  } | null>(null)

  useEffect(() => {
    loadMFAStatus()
  }, [userId])

  const loadMFAStatus = async () => {
    const result = await getUserMFAStatus(userId)
    if (result.success) {
      setMfaStatus({
        mfaEnabled: result.mfaEnabled || false,
        mfaSetupRequired: result.mfaSetupRequired || false,
        mfaEnrolledAt: result.mfaEnrolledAt || null
      })
    }
  }

  const handleEnableMFA = async () => {
    setLoading(true)
    try {
      const result = await enableMFAForUser(userId)
      
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setShowEnableDialog(false)
      await loadMFAStatus()
      onUpdate?.()
    } catch (error) {
      toast.error('Failed to enable MFA requirement')
    } finally {
      setLoading(false)
    }
  }

  const handleDisableMFA = async () => {
    setLoading(true)
    try {
      const result = await disableMFAForUser(userId)
      
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setShowDisableDialog(false)
      await loadMFAStatus()
      onUpdate?.()
    } catch (error) {
      toast.error('Failed to disable MFA')
    } finally {
      setLoading(false)
    }
  }

  const getMFAStatusIcon = () => {
    if (mfaStatus?.mfaEnabled) {
      return <ShieldCheck className="h-4 w-4 text-green-600" />
    } else if (mfaStatus?.mfaSetupRequired) {
      return <Shield className="h-4 w-4 text-amber-600" />
    } else {
      return <ShieldOff className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getMFAStatusText = () => {
    if (mfaStatus?.mfaEnabled) {
      return 'MFA Active'
    } else if (mfaStatus?.mfaSetupRequired) {
      return 'MFA Required'
    } else {
      return 'MFA Disabled'
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          {getMFAStatusIcon()}
          <span className="text-muted-foreground">{getMFAStatusText()}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!mfaStatus?.mfaSetupRequired && !mfaStatus?.mfaEnabled && (
              <DropdownMenuItem onClick={() => setShowEnableDialog(true)}>
                <Shield className="h-4 w-4 mr-2" />
                Require MFA Setup
              </DropdownMenuItem>
            )}
            {(mfaStatus?.mfaEnabled || mfaStatus?.mfaSetupRequired) && (
              <DropdownMenuItem 
                onClick={() => setShowDisableDialog(true)}
                className="text-destructive"
              >
                <ShieldOff className="h-4 w-4 mr-2" />
                Disable MFA
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Enable MFA Dialog */}
      <AlertDialog open={showEnableDialog} onOpenChange={setShowEnableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Require MFA Setup</AlertDialogTitle>
            <AlertDialogDescription>
              This will require {userName} to set up two-factor authentication on their next login.
              They will not be able to access the dashboard until MFA is configured.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEnableMFA} disabled={loading}>
              {loading ? 'Enabling...' : 'Require MFA'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disable MFA Dialog */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable MFA</AlertDialogTitle>
            <AlertDialogDescription>
              This will completely disable two-factor authentication for {userName}, including removing their existing MFA setup and backup codes.
              This will reduce the security of their account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDisableMFA} 
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? 'Disabling...' : 'Disable MFA'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
