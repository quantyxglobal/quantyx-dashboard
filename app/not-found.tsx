'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileQuestion, Home, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

export default function NotFound() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [dashboardUrl, setDashboardUrl] = useState('/')
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      setIsAuthenticated(true)
      
      // Determine dashboard URL based on role
      const role = session.user.role
      if (role === 'admin') {
        // Could be SUPER_ADMIN or ADMIN, default to admin
        setDashboardUrl('/admin')
      } else if (role === 'employee') {
        setDashboardUrl('/admin')
      } else {
        setDashboardUrl('/dashboard')
      }
    }
  }, [session, status])

  const handleGoBack = () => {
    router.back()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-hero relative">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-accent/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      
      <Card className="relative z-10 w-full max-w-md shadow-elegant bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-muted/50">
              <FileQuestion className="h-12 w-12 text-muted-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            Page Not Found
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Button asChild variant="professional" className="w-full">
              <Link href={dashboardUrl}>
                <Home className="h-4 w-4 mr-2" />
                {isAuthenticated ? 'Go to Dashboard' : 'Go Home'}
              </Link>
            </Button>
            <Button variant="outline" className="w-full" onClick={handleGoBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
          {isAuthenticated && (
            <p className="text-xs text-center text-muted-foreground mt-4">
              You&apos;ll be redirected to your dashboard
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}