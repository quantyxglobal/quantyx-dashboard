import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ChangePasswordForm } from '@/components/change-password-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User, Shield } from 'lucide-react'
import Link from 'next/link'

/**
 * User Settings Page
 * Requirements: 5.1, 5.2
 * 
 * Displays user profile information and password change form.
 * Requires authentication - redirects to login if not authenticated.
 */
export default async function SettingsPage() {
  const session = await auth()
  
  // Requirement 5.1: Authentication check with redirect
  if (!session || !session.user?.id) {
    redirect('/login')
  }
  
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences and security</p>
      </div>
      
      {/* Requirement 5.2: Display user profile information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="font-medium">{session.user.name}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{session.user.email}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Role</p>
            <p className="font-medium capitalize">{session.user.role}</p>
          </div>
        </CardContent>
      </Card>
      
      {/* Requirement 5.1: Integrate ChangePasswordForm component */}
      <ChangePasswordForm />
      
      {/* MFA Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add an extra layer of security to your account with two-factor authentication.
          </p>
          <Link href="/dashboard/settings/mfa">
            <Button variant="outline">
              Manage Two-Factor Authentication
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
