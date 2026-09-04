import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AdminUserDropdown } from '@/components/admin-user-dropdown'
import { RoutePreloader } from '@/components/route-preloader'
import { Users, Briefcase, FileSpreadsheet } from 'lucide-react'
import { Suspense } from 'react'
import { getAuthContext } from '@/lib/auth-middleware'

async function ManagerLayoutContent({
  children,
}: {
  children: React.ReactNode
}) {
  const authContext = await getAuthContext()
  
  if (!authContext) {
    redirect('/login')
  }
  
  // Verify manager role
  if (authContext.user.role !== 'MANAGER') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-muted/50 relative">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-accent/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      
      {/* Header with navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-card/90 border-b border-border/50 shadow-elegant">
        <div className="container mx-auto flex h-16 sm:h-18 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/manager" className="flex items-center hover:opacity-80 transition-all duration-300 group">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                  Quantyx Global
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Manager Dashboard</p>
              </div>
            </Link>
            
            <nav className="hidden md:flex items-center gap-6">
              <Link 
                href="/manager/cases" 
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-all duration-300 px-3 py-2 rounded-lg hover:bg-primary/5"
              >
                <Briefcase className="h-4 w-4" />
                My Cases
              </Link>
              <Link 
                href="/manager/team" 
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-all duration-300 px-3 py-2 rounded-lg hover:bg-primary/5"
              >
                <Users className="h-4 w-4" />
                My Team
              </Link>
              <Link 
                href="/admin/tools" 
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-all duration-300 px-3 py-2 rounded-lg hover:bg-primary/5"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Tools
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
            <AdminUserDropdown 
              userName={`${authContext.user.firstName} ${authContext.user.lastName}`} 
              userRole="Manager"
              firmInfo={authContext.organization}
              isEmployee={false}
              isSuperAdmin={false}
            />
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="relative z-10">
        <div className="container mx-auto px-4 py-8 sm:py-12 sm:px-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
      
      {/* Route Preloader */}
      <RoutePreloader userRole="manager" />
      
      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 bg-card/50 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-6 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                © 2026 Quantyx Global Case Management. All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Manager Portal</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function ManagerLayoutSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-muted/50">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-card/90 border-b border-border/50 shadow-elegant">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-32 bg-muted rounded-lg"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<ManagerLayoutSkeleton />}>
      <ManagerLayoutContent>{children}</ManagerLayoutContent>
    </Suspense>
  )
}
