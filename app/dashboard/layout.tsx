import { redirect } from 'next/navigation'
import Link from 'next/link'
import { UserDropdown } from '@/components/user-dropdown'
import { RoutePreloader } from '@/components/route-preloader'
import { Suspense } from 'react'
import { getAuthContext } from '@/lib/auth-middleware'

async function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode
}) {
  const authContext = await getAuthContext()
  
  if (!authContext) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-subtle relative">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-accent/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      
      {/* Header with navigation and logout */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-card/90 border-b border-border/50 shadow-elegant">
        <div className="container mx-auto flex h-16 sm:h-18 items-center justify-between px-4 sm:px-6 md:px-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/dashboard" className="flex items-center hover:opacity-80 transition-all duration-300 min-h-[44px] group">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                  Quantyx Global
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Case Management</p>
              </div>
            </Link>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
            <UserDropdown 
              userName={`${authContext.user.firstName} ${authContext.user.lastName}`} 
              userRole="Client User"
              firmInfo={authContext.organization}
            />
          </div>
        </div>
      </header>
      
      {/* Main content with enhanced styling */}
      <main className="container mx-auto px-4 py-8 sm:py-12 sm:px-6 md:px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      
      {/* Route Preloader - prefetches likely navigation routes */}
      <RoutePreloader userRole="client" />
      
      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 bg-card/50 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-6 sm:px-6 md:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                © 2026 Quantyx Global Case Management. All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Secure • Professional • Reliable</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function DashboardLayoutSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-card/90 border-b border-border/50 shadow-elegant">
        <div className="container mx-auto flex h-16 sm:h-18 items-center justify-between px-4 sm:px-6 md:px-6">
          <div className="animate-pulse">
            <div className="h-8 w-32 bg-muted rounded"></div>
          </div>
          <div className="animate-pulse">
            <div className="h-8 w-24 bg-muted rounded"></div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8 sm:py-12 sm:px-6 md:px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<DashboardLayoutSkeleton>{children}</DashboardLayoutSkeleton>}>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  )
}
