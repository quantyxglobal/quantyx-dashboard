import { redirect } from 'next/navigation'
import { CaseFilters } from '@/components/case-filters'
import { CreateCaseModal } from '@/components/create-case-modal'
import { ErrorBoundary } from '@/components/error-boundary'
import { AlertCircle, Building2, FileText, TrendingUp } from 'lucide-react'
import { Suspense } from 'react'
import { getAuthContext } from '@/lib/auth-middleware'
import { SupabaseDB } from '@/lib/supabase-db'

async function ClientDashboardContent() {
  const authContext = await getAuthContext()
  
  if (!authContext) {
    redirect('/login')
  }
  
  // Get user's organization information and cases using Supabase
  const user = await SupabaseDB.getUserWithCases(authContext.user.id)
  
  if (!user?.organization_id) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-destructive/20 bg-card/80 backdrop-blur-sm p-8 shadow-elegant text-center max-w-md">
          <div className="rounded-full bg-gradient-to-br from-destructive/10 to-destructive/5 p-6 mb-6 inline-flex">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-destructive leading-tight mb-3">No Organization</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Your account is not associated with an organization. Please contact your administrator.
          </p>
        </div>
      </div>
    )
  }
  
  // Handle both Prisma and Supabase data structures
  const organization = (user as any).organization || (user as any).organizations
  const cases = organization?.cases || []
  
  // Add debugging and safety checks
  console.log('[DASHBOARD] User data:', { user, organization, cases })
  
  // Ensure cases is always an array and has valid structure
  const safeCases = Array.isArray(cases) ? cases.filter(c => c && c.id && c.status) : []
  
  console.log('[DASHBOARD] Safe cases:', safeCases)
  
  return (
    <div className="space-y-8">
      {/* Hero Section with Firm Info */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 rounded-3xl blur-xl" />
        <div className="relative bg-card/60 backdrop-blur-sm rounded-2xl border border-border/50 p-8 shadow-card">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent leading-tight">
                    {organization.display_name || organization.name}
                  </h1>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {organization.firm_number && (
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded-md font-medium">
                        Firm #{organization.firm_number}
                      </span>
                    )}
                    <span>
                      Client since {new Date(organization.created_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long'
                      })}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
                Welcome back, {user.first_name} {user.last_name}. Manage your medilegal cases with comprehensive tracking and document management.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl px-4 py-3 border border-primary/20 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">Total Cases</span>
                  </div>
                  <span className="text-2xl font-bold text-primary">{safeCases.length}</span>
                </div>
                <div className="bg-gradient-to-r from-accent/10 to-accent/5 rounded-xl px-4 py-3 border border-accent/20 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium text-accent">Active</span>
                  </div>
                  <span className="text-2xl font-bold text-accent">
                    {safeCases.filter((c: any) => c.status === 'PENDING' || c.status === 'IN_PROGRESS').length}
                  </span>
                </div>
              </div>
              <CreateCaseModal />
            </div>
          </div>
        </div>
      </div>
      
      {/* Cases Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Your Cases</h2>
            <p className="text-muted-foreground">Track and manage all your medilegal cases</p>
          </div>
        </div>
        <ErrorBoundary>
          <CaseFilters cases={safeCases} />
        </ErrorBoundary>
      </div>
    </div>
  )
}

function ClientDashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="relative">
        <div className="relative bg-card/60 backdrop-blur-sm rounded-2xl border border-border/50 p-8 shadow-card">
          <div className="animate-pulse space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-muted rounded-xl"></div>
              <div className="space-y-2">
                <div className="h-8 w-64 bg-muted rounded"></div>
                <div className="h-4 w-32 bg-muted rounded"></div>
              </div>
            </div>
            <div className="h-4 w-96 bg-muted rounded"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-20 bg-muted rounded-xl"></div>
              <div className="h-20 bg-muted rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="space-y-6">
        <div className="animate-pulse space-y-2">
          <div className="h-6 w-32 bg-muted rounded"></div>
          <div className="h-4 w-64 bg-muted rounded"></div>
        </div>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg"></div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ClientDashboard() {
  return (
    <Suspense fallback={<ClientDashboardSkeleton />}>
      <ClientDashboardContent />
    </Suspense>
  )
}
