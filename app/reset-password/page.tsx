"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react"
import { resetPassword } from "@/app/actions/reset-password"

// Separate component for reading search params (must be wrapped in Suspense)
function TokenReader({ onToken }: { onToken: (token: string | null) => void }) {
  const searchParams = useSearchParams()
  
  useEffect(() => {
    const tokenParam = searchParams.get('token')
    onToken(tokenParam)
  }, [searchParams, onToken])
  
  return null
}

// Loading fallback for Suspense boundary
function TokenLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-hero">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [tokenChecked, setTokenChecked] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [tokenError, setTokenError] = useState(false)

  const handleTokenChange = (tokenParam: string | null) => {
    if (!tokenParam) {
      setTokenError(true)
    } else {
      setToken(tokenParam)
    }
    setTokenChecked(true)
  }

  const validatePassword = (pwd: string) => {
    return pwd.length >= 8
  }

  const passwordsMatch = password === confirmPassword && password.length > 0
  const isPasswordValid = validatePassword(password)
  const isFormValid = isPasswordValid && passwordsMatch

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!token) {
      setError('Invalid reset token')
      return
    }

    if (!isFormValid) {
      setError('Please ensure passwords match and meet requirements')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await resetPassword(token, password)
      
      if (result.success) {
        setSuccess(true)
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login')
        }, 3000)
      } else {
        setError(result.error || 'Failed to reset password')
      }
    } catch (error) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show loading while token is being checked
  if (!tokenChecked) {
    return <TokenLoading />
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-hero relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
        
        <div className="relative z-10 w-full max-w-md">
          <Card className="shadow-elegant bg-white/80 backdrop-blur-sm border-destructive/50">
            <CardHeader className="space-y-1">
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-full bg-destructive/10">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-center text-destructive">
                Invalid Reset Link
              </CardTitle>
              <CardDescription className="text-center">
                This password reset link is invalid or has expired
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive">
                  Password reset links expire after 1 hour for security reasons.
                </p>
              </div>

              <Button
                variant="professional"
                className="w-full"
                onClick={() => router.push('/forgot-password')}
              >
                Request New Reset Link
              </Button>

              <div className="text-center">
                <Link 
                  href="/login" 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Back to Login
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-hero relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
        
        <div className="relative z-10 w-full max-w-md">
          <Card className="shadow-elegant bg-white/80 backdrop-blur-sm border-[hsl(240_15%_88%)]">
            <CardHeader className="space-y-1">
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-full bg-green-100">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-center">
                Password Reset Successful!
              </CardTitle>
              <CardDescription className="text-center">
                Your password has been updated successfully
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-900 text-center">
                  Redirecting you to the login page...
                </p>
              </div>

              <Button
                variant="professional"
                className="w-full"
                onClick={() => router.push('/login')}
              >
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <>
      <Suspense fallback={<TokenLoading />}>
        <TokenReader onToken={handleTokenChange} />
      </Suspense>
      
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-hero relative">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-accent/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
            Quantix Global
          </h1>
          <p className="text-muted-foreground mt-2">
            Reset Your Password
          </p>
        </div>

        <Card className="shadow-elegant bg-white/80 backdrop-blur-sm border-[hsl(240_15%_88%)]">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <Image
                src="/quantyx-logo.png"
                alt="Quantyx Global"
                width={64}
                height={64}
                className="h-16 w-auto object-contain"
                priority
              />
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              Set New Password
            </CardTitle>
            <CardDescription className="text-center">
              Choose a strong password for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:border-primary/50 transition-colors pr-10"
                    disabled={isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Password must be at least 8 characters long
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:border-primary/50 transition-colors pr-10"
                    disabled={isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && !passwordsMatch && (
                  <div className="flex items-center gap-1 text-sm text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    <span>Passwords do not match</span>
                  </div>
                )}
                {confirmPassword && passwordsMatch && (
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    <span>Passwords match</span>
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
                {isSubmitting ? 'Resetting Password...' : 'Reset Password'}
              </Button>

              <div className="text-center pt-4 border-t border-border">
                <Link 
                  href="/login" 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Back to Login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  )
}
