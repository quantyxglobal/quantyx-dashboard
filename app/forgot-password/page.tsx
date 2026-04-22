"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle, ArrowLeft, Mail } from "lucide-react"
import { requestPasswordReset } from "@/app/actions/request-password-reset"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(true)

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const isEmailValid = validateEmail(email)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isEmailValid) {
      setError('Please enter a valid email address')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await requestPasswordReset(email)
      
      if (result.success) {
        setSuccess(true)
        setIsSuperAdmin(result.isSuperAdmin === true) // Only true if explicitly true
      } else {
        setError(result.error || 'Failed to send reset email')
      }
    } catch (error) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    // Different success messages for superadmin vs non-superadmin
    if (isSuperAdmin) {
      // Super Admin - Check email for reset link
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-hero relative">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-accent/10 to-transparent rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 w-full max-w-md">
            <Card className="shadow-elegant bg-white/80 backdrop-blur-sm border-[hsl(240_15%_88%)]">
              <CardHeader className="space-y-1">
                <div className="flex justify-center mb-4">
                  <div className="p-4 rounded-full bg-green-100">
                    <CheckCircle className="h-12 w-12 text-green-600" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold text-center">
                  Check Your Email
                </CardTitle>
                <CardDescription className="text-center">
                  We've sent password reset instructions to <strong>{email}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <Mail className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <p className="font-medium mb-1">Next Steps:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Check your email inbox</li>
                        <li>Click the reset link in the email</li>
                        <li>Set your new password</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  <p>Didn't receive the email? Check your spam folder or</p>
                  <Button
                    variant="link"
                    className="text-primary hover:text-primary-glow p-0 h-auto"
                    onClick={() => setSuccess(false)}
                  >
                    try again
                  </Button>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/login')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Login
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    } else {
      // Non-Super Admin - Support has been notified
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-hero relative">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-accent/10 to-transparent rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 w-full max-w-md">
            <Card className="shadow-elegant bg-white/80 backdrop-blur-sm border-[hsl(240_15%_88%)]">
              <CardHeader className="space-y-1">
                <div className="flex justify-center mb-4">
                  <div className="p-4 rounded-full bg-green-100">
                    <CheckCircle className="h-12 w-12 text-green-600" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold text-center">
                  Request Received
                </CardTitle>
                <CardDescription className="text-center">
                  Our support team will assist you with your password reset
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <Mail className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <p className="font-medium mb-2">What happens next:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Our support team has received your request</li>
                        <li>An administrator will reset your password</li>
                        <li>You'll be contacted with your new credentials</li>
                      </ol>
                      <p className="mt-3 text-xs text-blue-700">
                        Password resets are typically processed within a few hours during business hours.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-900">
                    <strong>Need urgent help?</strong> Contact us directly at{' '}
                    <a 
                      href="mailto:support@quantyxg.com" 
                      className="text-primary hover:text-primary-glow font-medium"
                    >
                      support@quantyxg.com
                    </a>
                  </p>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/login')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Login
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-hero relative">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-accent/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
            quantyx Global
          </h1>
          <p className="text-muted-foreground mt-2">
            Password Recovery
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
              Forgot Password?
            </CardTitle>
            <CardDescription className="text-center">
              Enter your email address to request a password reset
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-blue-900">
                  <strong>Super Admins:</strong> You'll receive a reset link via email.<br/>
                  <strong>Other Users:</strong> Our support team will be notified and will reset your password.
                </p>
              </div>
              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:border-primary/50 transition-colors"
                  disabled={isSubmitting}
                  required
                />
              </div>

              <Button
                type="submit"
                variant="professional"
                size="lg"
                className="w-full shadow-elegant hover:shadow-glow transition-all duration-300"
                disabled={isSubmitting || !isEmailValid}
              >
                {isSubmitting ? 'Sending...' : 'Send Reset Instructions'}
              </Button>

              <div className="text-center pt-4 border-t border-border">
                <Link 
                  href="/login" 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
