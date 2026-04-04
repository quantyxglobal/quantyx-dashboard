'use client'

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle, Clock } from "lucide-react"
import { loginAction } from "@/app/actions/login"

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required")
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginForm() {
  const searchParams = useSearchParams()
  const [sessionTimeout, setSessionTimeout] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Check for session timeout and error parameters
  useEffect(() => {
    const timeoutParam = searchParams.get('timeout')
    const errorParam = searchParams.get('error')
    
    // Use setTimeout to avoid synchronous setState in effect
    if (timeoutParam === 'true') {
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

  const {
    register,
    formState: { errors, touchedFields }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    
    const formData = new FormData(event.currentTarget)
    
    try {
      console.log('[LOGIN FORM] Submitting form...')
      
      // Call the login action which will handle authentication and redirect
      await loginAction(formData)
      
    } catch (error: any) {
      console.error('[LOGIN FORM] Login error:', error)
      
      // Check if this is a Next.js redirect (successful login)
      if (error?.message?.includes('NEXT_REDIRECT') || error?.digest?.startsWith('NEXT_REDIRECT')) {
        // This is a successful login redirect - let it happen
        console.log('[LOGIN FORM] Successful redirect detected')
        return
      }
      
      // This is an actual error
      setError('Login failed. Please try again.')
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
                type="email"
                placeholder="name@example.com"
                {...register("email")}
                className={errors.email ? 'border-destructive focus-visible:ring-destructive' : touchedFields?.email && !errors.email ? 'border-green-500' : 'bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:border-primary/50 transition-colors'}
                disabled={isSubmitting}
              />
              {touchedFields?.email && !errors.email && (
                <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-600" data-testid="check-circle" />
              )}
              {errors.email && (
                <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
              )}
            </div>
            {errors.email && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>{errors.email.message}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                {...register("password")}
                className={errors.password ? 'border-destructive focus-visible:ring-destructive' : touchedFields?.password && !errors.password ? 'border-green-500' : 'bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:border-primary/50 transition-colors'}
                disabled={isSubmitting}
              />
              {touchedFields?.password && !errors.password && (
                <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-600" />
              )}
              {errors.password && (
                <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
              )}
            </div>
            {errors.password && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>{errors.password.message}</span>
              </div>
            )}
          </div>

          <Button
            type="submit"
            variant="professional"
            size="lg"
            className="w-full shadow-elegant hover:shadow-glow transition-all duration-300"
            disabled={isSubmitting}
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
      </CardContent>
    </Card>
  )
}