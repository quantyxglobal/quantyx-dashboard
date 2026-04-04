'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Shield, Download, Copy, Check, AlertCircle, Lock } from 'lucide-react'
import { generateMFASetup, enableMFA } from '@/app/actions/mfa-setup'
import { completeMFASetup } from '@/app/actions/complete-mfa-setup'
import Image from 'next/image'

interface MandatoryMFASetupProps {
  userEmail: string
  userId: string
}

export function MandatoryMFASetup({ userEmail, userId }: MandatoryMFASetupProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'intro' | 'qr' | 'backup'>('intro')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verificationCode, setVerificationCode] = useState('')
  const [copiedCode, setCopiedCode] = useState<number | null>(null)

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
      setStep('qr')
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
        toast.error(result.error)
        setLoading(false)
        return
      }

      // Mark MFA setup as complete
      await completeMFASetup()

      toast.success('MFA enabled successfully!')
      setStep('backup')
    } catch (error) {
      toast.error('Failed to enable MFA')
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
    const content = `Quantix Global MFA Backup Codes\nGenerated: ${new Date().toLocaleString()}\n\n${backupCodes.join('\n')}\n\nKeep these codes in a safe place. Each code can only be used once.`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'quantix-mfa-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Backup codes downloaded')
  }

  const handleComplete = () => {
    router.push('/dashboard')
    router.refresh()
  }

  if (step === 'intro') {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Security Setup Required</CardTitle>
              <CardDescription>
                Two-factor authentication is mandatory for your account
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-amber-800 font-medium mb-2">
                  For your security, you must set up two-factor authentication before accessing the dashboard.
                </p>
                <p className="text-xs text-amber-700">
                  This adds an extra layer of protection to your account and helps keep your data secure.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">What you'll need:</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-full mt-0.5">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Authenticator App</p>
                  <p className="text-sm text-muted-foreground">
                    Google Authenticator, Microsoft Authenticator, Authy, or similar
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-full mt-0.5">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Your Smartphone</p>
                  <p className="text-sm text-muted-foreground">
                    To scan the QR code and generate verification codes
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-full mt-0.5">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">A Few Minutes</p>
                  <p className="text-sm text-muted-foreground">
                    The setup process is quick and easy
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <Button 
            onClick={handleStartSetup} 
            disabled={loading}
            size="lg"
            className="w-full"
          >
            {loading ? 'Setting up...' : 'Begin Setup'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (step === 'qr') {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Scan QR Code</CardTitle>
          <CardDescription>
            Use your authenticator app to scan this QR code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex justify-center p-6 bg-white rounded-lg border-2 border-dashed">
              {qrCode && (
                <Image 
                  src={qrCode} 
                  alt="MFA QR Code" 
                  width={250} 
                  height={250}
                  className="rounded-lg"
                />
              )}
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Can't scan the QR code?</p>
              <p className="text-xs text-muted-foreground mb-2">
                Enter this code manually in your authenticator app:
              </p>
              <code className="text-xs bg-background px-3 py-2 rounded break-all block">
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
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-center">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          <Button 
            onClick={handleVerifyAndEnable} 
            disabled={loading || verificationCode.length !== 6}
            size="lg"
            className="w-full"
          >
            {loading ? 'Verifying...' : 'Verify and Continue'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (step === 'backup') {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Save Your Backup Codes</CardTitle>
          <CardDescription>
            Store these codes in a safe place. You'll need them if you lose access to your authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-amber-800 font-medium mb-1">
                  Important: Save these codes now!
                </p>
                <p className="text-xs text-amber-700">
                  Each code can only be used once. You won't be able to see them again after leaving this page.
                </p>
              </div>
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
              onClick={handleComplete}
              className="flex-1"
            >
              Continue to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}
