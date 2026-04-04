import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/auth-middleware'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User, Building2, Mail, Shield } from 'lucide-react'
import { ChangePasswordForm } from '@/components/change-password-form'
import Link from 'next/link'

/**
 * Admin/Employee Profile Page
 * 
 * Displays profile information for admin and employee users.
 * Password change is only available for admin users, not employees.
 */
export default async function AdminSettingsPage() {
  const authContext = await getAuthContext()
  
  if (!authContext) {
    redirect('/login')
  }
  
  // Verify admin or employee role
  if (authContext.user.role !== 'ADMIN' && authContext.user.role !== 'EMPLOYEE' && authContext.user.role !== 'SUPER_ADMIN') {
    redirect('/dashboard')
  }
  
  const isEmployee = authContext.user.role === 'EMPLOYEE'
  const isSuperAdmin = authContext.user.role === 'SUPER_ADMIN'
  
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
          {isEmployee ? 'Employee Profile' : isSuperAdmin ? 'Super Admin Profile' : 'Admin Profile'}
        </h1>
        <p className="text-muted-foreground">
          Manage your account preferences and security
        </p>
      </div>
      
      {/* Profile Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Full Name
              </p>
              <p className="font-medium text-lg">
                {authContext.user.firstName} {authContext.user.lastName}
              </p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address
              </p>
              <p className="font-medium text-lg">{authContext.user.email}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Role
              </p>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  isSuperAdmin 
                    ? 'bg-accent/20 text-accent-foreground border border-accent/30'
                    : isEmployee
                      ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30'
                      : 'bg-primary/20 text-primary border border-primary/30'
                }`}>
                  {isSuperAdmin ? 'Super Administrator' : isEmployee ? 'Employee' : 'Administrator'}
                </span>
              </div>
            </div>
            
            {authContext.organization && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Organization
                </p>
                <p className="font-medium text-lg">{authContext.organization.name}</p>
                {authContext.organization.firmNumber && (
                  <p className="text-sm text-muted-foreground">
                    Firm #{authContext.organization.firmNumber}
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Password Change Section - Available for all roles */}
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
