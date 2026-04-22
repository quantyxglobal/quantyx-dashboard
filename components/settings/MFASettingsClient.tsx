'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Shield, Download, Copy, Check, AlertCircle } from 'lucide-react'
import { generateMFASetup, enableMFA, disableMFA } from '@/app/actions/mfa-setup'
import Image from 'next/image'

interface MFASettingsClientProps {
  mfaEnabled: boolean
  userEmail: string
}

export function MFASettingsClient({ mfaEnabled: initialMfaEnabled, userEmail }: MFASettingsClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [setupMode, setSetupMode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verificationCode, setVerificationCode] = useState('')
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [copiedCode, setCopiedCode] = useState<number | null>(null)
  const [disablePassword, setDisablePassword] = useState('')
  const [mfaEnabled, setMfaEnabled] = useState(initialMfaEnabled)

  const handleStartSetup = async () => {
    setLoading(true)
    try {
      const result = await generateMFASetup()
      
      if (result.error) {
        toast.error(result.error)
        return
      }

      setQrCode(result.qrCode!)
      setSecret(result.secret!)
      setBackupCodes(result.backupCodes!)
      setSetupMode(true)
    } catch (error) {
      toast.error('Failed to start MFA setup')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyAndEnable = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code')
      return
    }

    setLoading(true)
    try {
      const result = await enableMFA(secret, verificationCode, backupCodes)
      
      if (result.error) {
        toast.error(result.error, { duration: 5000 })
        return
      }

      toast.success('MFA enabled successfully!')
      setShowBackupCodes(true)
      setMfaEnabled(true)
      router.refresh()
    } catch (error) {
      toast.error('Failed to enable MFA')
    } finally {
      setLoading(false)
    }
  }

  const handleDisableMFA = async () => {
    if (!disablePassword) {
      toast.error('Please enter your password')
      return
    }

    setLoading(true)
    try {
      const result = await disableMFA(disablePassword)
      
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('MFA disabled successfully')
      setDisablePassword('')
      setMfaEnabled(false)
      router.refresh()
    } catch (error) {
      toast.error('Failed to disable MFA')
    } finally {
      setLoading(false)
    }
  }

  const copyBackupCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(index)
    setTimeout(() => setCopiedCode(null), 2000)
    toast.success('Code copied to clipboard')
  }

  const downloadBackupCodes = () => {
    const content = `quantyx Global MFA Backup Codes\nGenerated: ${new Date().toLocaleString()}\n\n${backupCodes.join('\n')}\n\nKeep these codes in a safe place. Each code can only be used once.`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'quantyx-mfa-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Backup codes downloaded')
  }

  const handleDone = () => {
    setSetupMode(false)
    setShowBackupCodes(false)
    setQrCode('')
    setSecret('')
    setBackupCodes([])
    setVerificationCode('')
    router.refresh()
  }

  if (!setupMode && !mfaEnabled) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>
                Add an extra layer of security to your account
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Two-factor authentication (2FA) adds an additional layer of security to your account by requiring a verification code from your phone in addition to your password.
          </p>
          
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h4 className="font-semibold">What you'll need:</h4>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>An authenticator app (Google Authenticator, Microsoft Authenticator, Authy, etc.)</li>
              <li>Your smartphone or tablet</li>
              <li>A few minutes to complete setup</li>
            </ul>
          </div>

          <Button onClick={handleStartSetup} disabled={loading} className="w-full">
            {loading ? 'Setting up...' : 'Enable Two-Factor Authentication'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (setupMode && !showBackupCodes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set Up Two-Factor Authentication</CardTitle>
          <CardDescription>
            Scan the QR code with your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Important: This is a NEW QR code</p>
                <p>If you previously had MFA enabled, you must scan this NEW QR code. Your old QR code will not work. Add this as a new account in your authenticator app.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-center">
              {qrCode && (
                <Image 
                  src={qrCode} 
                  alt="MFA QR Code" 
                  width={200} 
                  height={200}
                  className="border rounded-lg p-4"
                />
              )}
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Can't scan the QR code?</p>
              <p className="text-xs text-muted-foreground mb-2">
                Enter this code manually in your authenticator app:
              </p>
              <code className="text-xs bg-background px-2 py-1 rounded break-all">
                {secret}
              </code>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="verificationCode">Verification Code</Label>
            <Input
              id="verificationCode"
              type="text"
              placeholder="Enter 6-digit code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className="text-center text-2xl tracking-widest font-mono"
            />
            <p className="text-xs text-muted-foreground text-center">
              Enter the 6-digit code from the NEW account you just added to your authenticator app
            </p>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => setSetupMode(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleVerifyAndEnable} 
              disabled={loading || verificationCode.length !== 6}
              className="flex-1"
            >
              {loading ? 'Verifying...' : 'Verify and Enable'}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (showBackupCodes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Save Your Backup Codes</CardTitle>
          <CardDescription>
            Store these codes in a safe place. Each code can only be used once.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <p className="text-sm text-amber-800 font-medium">
                Important: Save these backup codes now. You won't be able to see them again.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((code, index) => (
              <div 
                key={index}
                className="flex items-center justify-between bg-muted p-3 rounded-lg"
              >
                <code className="text-sm font-mono">{code}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyBackupCode(code, index)}
                >
                  {copiedCode === index ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={downloadBackupCodes}
              className="flex-1 gap-2"
            >
              <Download className="h-4 w-4" />
              Download Codes
            </Button>
            <Button 
              onClick={handleDone}
              className="flex-1"
            >
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // MFA is enabled - show disable option
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-green-600" />
          <div>
            <CardTitle>Two-Factor Authentication Enabled</CardTitle>
            <CardDescription>
              Your account is protected with 2FA
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
          <p className="text-sm text-green-800">
            ✓ Two-factor authentication is active on your account
          </p>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold">Disable Two-Factor Authentication</h4>
          
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">Warning</p>
                <p>Disabling MFA will make your account less secure. If you re-enable MFA later, you will need to scan a NEW QR code and set up MFA again from scratch.</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>

          <Button 
            variant="destructive" 
            onClick={handleDisableMFA}
            disabled={loading || !disablePassword}
          >
            {loading ? 'Disabling...' : 'Disable Two-Factor Authentication'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
