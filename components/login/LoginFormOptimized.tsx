'use client'

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle, Clock, Shield } from "lucide-react"
import { loginAction, checkUserMFAStatus, loginWithMFA } from "@/app/actions/login"
import { toast } from "sonner"

export function LoginForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [sessionTimeout, setSessionTimeout] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [touched, setTouched] = useState({ email: false, password: false })
  
  // MFA state
  const [showMFAInput, setShowMFAInput] = useState(false)
  const [mfaToken, setMfaToken] = useState('')
  const [showBackupCodeInput, setShowBackupCodeInput] = useState(false)

  // Check for session timeout and error parameters
  useEffect(() => {
    const timeoutParam = searchParams.get('timeout')
    const sessionParam = searchParams.get('session')
    const errorParam = searchParams.get('error')
    
    // Use setTimeout to avoid synchronous setState in effect
    if (timeoutParam === 'true' || sessionParam === 'expired') {
      setTimeout(() => setSessionTimeout(true), 0)
    }
    if (errorParam === 'credentials' || errorParam === 'CredentialsSignin') {
      setTimeout(() => setError('Invalid email or password'), 0)
    } else if (errorParam === 'validation') {
      setTimeout(() => setError('Please enter valid credentials'), 0)
    } else if (errorParam === 'unknown' || errorParam === 'undefined' || errorParam) {
      setTimeout(() => setError('An error occurred during login. Please try again.'), 0)
    }
  }, [searchParams])

  // Simple validation without heavy libraries
  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const isEmailValid = validateEmail(formData.email)
  const isPasswordValid = formData.password.length > 0
  const isFormValid = isEmailValid && isPasswordValid

  const handleInputChange = (field: 'email' | 'password') => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
  }

  const handleBlur = (field: 'email' | 'password') => () => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    console.log('[LOGIN_FORM] Form submitted - starting login process')
    setIsSubmitting(true)
    setError(null)
    
    try {
      console.log('[LOGIN_FORM] Checking MFA status for:', formData.email)
      // Check if user has MFA enabled and needs verification
      const mfaStatus = await checkUserMFAStatus(formData.email)
      console.log('[LOGIN_FORM] MFA status result:', mfaStatus)
      
      // Handle undefined or null response
      if (!mfaStatus) {
        console.error('[LOGIN_FORM] MFA status check returned undefined/null')
        setError('Unable to verify account status. Please try again.')
        setIsSubmitting(false)
        return
      }
      
      if (mfaStatus.error) {
        console.log('[LOGIN_FORM] MFA status check error:', mfaStatus.error)
        setError(mfaStatus.error)
        setIsSubmitting(false)
        return
      }
      
      // If MFA is required, show MFA input
      if (mfaStatus.mfaRequired) {
        console.log('[LOGIN_FORM] MFA verification required')
        setShowMFAInput(true)
        setIsSubmitting(false)
        return
      }
      
      // Normal login without MFA
      console.log('[LOGIN_FORM] Proceeding with normal login (no MFA required)')
      
      // Create FormData from the form element
      const form = event.currentTarget
      const formDataObj = new FormData()
      formDataObj.append('email', formData.email)
      formDataObj.append('password', formData.password)
      
      const callbackUrl = searchParams.get('callbackUrl')
      if (callbackUrl) {
        formDataObj.append('callbackUrl', callbackUrl)
      }
      
      console.log('[LOGIN_FORM] Calling loginAction...')
      await loginAction(formDataObj)
      console.log('[LOGIN_FORM] loginAction completed successfully')
      // If we reach here, login succeeded and redirect will happen
    } catch (error: any) {
      console.log('[LOGIN_FORM] Caught error:', error)
      
      // Check if this is a Next.js redirect (successful login)
      if (error?.message?.includes('NEXT_REDIRECT') || error?.digest?.startsWith('NEXT_REDIRECT')) {
        console.log('[LOGIN_FORM] Redirect detected - login successful')
        return
      }
      
      console.error('[LOGIN_FORM] Login failed:', error)
      setError('Login failed. Please try again.')
      setIsSubmitting(false)
    }
  }
  
  const handleMFAVerification = async () => {
    if (!mfaToken || mfaToken.length !== 6) {
      setError('Please enter a 6-digit code')
      return
    }
    
    setIsSubmitting(true)
    setError(null)
    
    try {
      const callbackUrl = searchParams.get('callbackUrl')
      const result = await loginWithMFA(formData.email, formData.password, mfaToken, callbackUrl || undefined)
      
      if (result.error) {
        setError(result.error)
        setIsSubmitting(false)
        return
      }
      
      // Success - redirect will happen automatically
    } catch (error: any) {
      console.log('[MFA_VERIFY] Error:', error)
      
      // Check if this is a Next.js redirect (successful login)
      if (error?.message?.includes('NEXT_REDIRECT') || error?.digest?.startsWith('NEXT_REDIRECT')) {
        console.log('[MFA_VERIFY] Redirect detected - login successful')
        return
      }
      
      console.error('[MFA_VERIFY] Verification failed:', error)
      setError('MFA verification failed. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-md shadow-elegant bg-white/80 backdrop-blur-sm border-[hsl(240_15%_88%)]">
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <Image
              src="/quantyx-logo.png"
              alt="Quantyx Global"
              width={64}
              height={64}
              className="h-16 w-auto object-contain"
              priority
            />
          </div>
        </div>
        <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
          Welcome Back
        </CardTitle>
        <CardDescription className="text-center text-[hsl(240_8%_46%)]">
          Sign in to access your secure dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        {showMFAInput ? (
          // MFA Verification Screen
          <div className="space-y-6">
            <div className="text-center">
              <Shield className="h-12 w-12 mx-auto text-primary mb-4" />
              <h3 className="text-lg font-semibold">Two-Factor Authentication</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span>{error}</span>
              </div>
            )}

            {showBackupCodeInput ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="backupCode">Backup Code</Label>
                  <Input
                    id="backupCode"
                    type="text"
                    value={mfaToken}
                    onChange={(e) => setMfaToken(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                    placeholder="Enter backup code"
                    maxLength={8}
                    className="text-center text-xl tracking-wider font-mono uppercase"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Enter one of your 8-character backup codes
                  </p>
                </div>

                <Button 
                  onClick={handleMFAVerification}
                  disabled={isSubmitting || mfaToken.length !== 8}
                  className="w-full"
                >
                  {isSubmitting ? 'Verifying...' : 'Verify Backup Code'}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBackupCodeInput(false)
                      setMfaToken('')
                      setError(null)
                    }}
                    className="text-sm text-muted-foreground hover:text-primary"
                  >
                    Use authenticator code instead
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mfaToken">Verification Code</Label>
                  <Input
                    id="mfaToken"
                    type="text"
                    value={mfaToken}
                    onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="text-center text-2xl tracking-widest font-mono"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>

                <Button 
                  onClick={handleMFAVerification}
                  disabled={isSubmitting || mfaToken.length !== 6}
                  className="w-full"
                  variant="professional"
                  size="lg"
                >
                  {isSubmitting ? 'Verifying...' : 'Verify and Sign In'}
                </Button>

                <div className="text-center pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">
                    Lost access to your authenticator?
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBackupCodeInput(true)
                      setMfaToken('')
                      setError(null)
                    }}
                    className="text-sm text-primary hover:underline"
                  >
                    Use backup code instead
                  </button>
                </div>
              </div>
            )}

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setShowMFAInput(false)
                  setShowBackupCodeInput(false)
                  setMfaToken('')
                  setError(null)
                }}
                className="text-sm text-muted-foreground hover:text-primary"
              >
                ← Back to login
              </button>
            </div>
          </div>
        ) : (
          // Normal Login Form
        <form onSubmit={handleSubmit} className="space-y-4">
          {sessionTimeout && (
            <div className="flex items-center gap-2 p-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md">
              <Clock className="h-4 w-4" />
              <span>Your session has expired. Please sign in again.</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleInputChange('email')}
                onBlur={handleBlur('email')}
                className={
                  touched.email && !isEmailValid 
                    ? 'border-destructive focus-visible:ring-destructive' 
                    : touched.email && isEmailValid 
                    ? 'border-green-500' 
                    : 'bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:border-primary/50 transition-colors'
                }
                disabled={isSubmitting}
                required
              />
              {touched.email && isEmailValid && (
                <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-600" />
              )}
              {touched.email && !isEmailValid && (
                <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
              )}
            </div>
            {touched.email && !isEmailValid && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>Please enter a valid email address</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="password">Password</Label>
              <Link 
                href="/forgot-password" 
                className="text-xs text-primary hover:text-primary-glow transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleInputChange('password')}
                onBlur={handleBlur('password')}
                className={
                  touched.password && !isPasswordValid 
                    ? 'border-destructive focus-visible:ring-destructive' 
                    : touched.password && isPasswordValid 
                    ? 'border-green-500' 
                    : 'bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:border-primary/50 transition-colors'
                }
                disabled={isSubmitting}
                required
              />
              {touched.password && isPasswordValid && (
                <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-600" />
              )}
              {touched.password && !isPasswordValid && (
                <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
              )}
            </div>
            {touched.password && !isPasswordValid && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>Password is required</span>
              </div>
            )}
          </div>

          <Button
            type="submit"
            variant="professional"
            size="lg"
            className="w-full shadow-elegant hover:shadow-glow transition-all duration-300"
            disabled={isSubmitting || !isFormValid}
          >
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </Button>

          <div className="text-center pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link 
                href="/register" 
                className="text-primary hover:text-primary-glow font-medium transition-colors"
              >
                Sign up here
              </Link>
            </p>
          </div>
        </form>
        )}
      </CardContent>
    </Card>
  )
}
