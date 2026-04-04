import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AdminUserDropdown } from '@/components/admin-user-dropdown'
import { RoutePreloader } from '@/components/route-preloader'
import { Users, Building2, Shield, Settings } from 'lucide-react'
import { Suspense } from 'react'
import { getAuthContext } from '@/lib/auth-middleware'

async function SuperAdminLayoutContent({
  children,
}: {
  children: React.ReactNode
}) {
  const authContext = await getAuthContext()
  
  if (!authContext) {
    redirect('/login')
  }
  
  // Verify super admin role
  if (authContext.user.role !== 'SUPER_ADMIN') {
    // Redirect based on actual role
    if (authContext.user.role === 'ADMIN') {
      redirect('/admin')
    } else {
      redirect('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-destructive/5 to-muted/50 relative">
      {/* Background decoration with red theme */}
      <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 via-transparent to-primary/5 pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-destructive/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-primary/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      
      {/* Header with navigation and logout */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-card/90 border-b border-destructive/20 shadow-elegant">
        <div className="container mx-auto flex h-16 sm:h-18 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/superadmin" className="flex items-center hover:opacity-80 transition-all duration-300 group">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-destructive/20 to-destructive/10">
                  <Shield className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-destructive via-destructive/80 to-primary bg-clip-text text-transparent">
                    Quantyx Global
                  </h1>
                  <p className="text-xs text-destructive/70 hidden sm:block">Super Admin Control</p>
                </div>
              </div>
            </Link>
            
            <nav className="hidden md:flex items-center gap-6">
              <Link 
                href="/superadmin/users" 
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-all duration-300 px-3 py-2 rounded-lg hover:bg-destructive/5"
              >
                <Users className="h-4 w-4" />
                User Management
              </Link>
              <Link 
                href="/superadmin/firms" 
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-all duration-300 px-3 py-2 rounded-lg hover:bg-destructive/5"
              >
                <Building2 className="h-4 w-4" />
                Firm Management
              </Link>
              <Link 
                href="/superadmin/settings" 
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-all duration-300 px-3 py-2 rounded-lg hover:bg-destructive/5"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
            <AdminUserDropdown 
              userName={`${authContext.user.firstName} ${authContext.user.lastName}`} 
              userRole="Super Administrator"
              firmInfo={authContext.organization}
            />
          </div>
        </div>
      </header>
      
      {/* Main content with enhanced styling */}
      <main className="relative z-10">
        <div className="container mx-auto px-4 py-8 sm:py-12 sm:px-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
      
      {/* Route Preloader */}
      <RoutePreloader userRole="admin" />
      
      {/* Footer */}
      <footer className="relative z-10 border-t border-destructive/20 bg-card/50 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-6 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                © 2026 Quantyx Global Case Management. All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-destructive/70">
              <Shield className="h-3 w-3" />
              <span>Superadmin Access • Full Control • Maximum Security</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function SuperAdminLayoutSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-destructive/5 to-muted/50">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-card/90 border-b border-destructive/20 shadow-elegant">
        <div className="container mx-auto flex h-16 sm:h-18 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="animate-pulse">
              <div className="h-8 w-32 bg-muted rounded"></div>
            </div>
          </div>
          <div className="animate-pulse">
            <div className="h-8 w-24 bg-muted rounded"></div>
          </div>
        </div>
      </header>
      <main className="relative z-10">
        <div className="container mx-auto px-4 py-8 sm:py-12 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="animate-pulse space-y-6">
              <div className="h-8 w-64 bg-muted rounded"></div>
              <div className="h-4 w-96 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<SuperAdminLayoutSkeleton />}>
      <SuperAdminLayoutContent>{children}</SuperAdminLayoutContent>
    </Suspense>
  )
}
