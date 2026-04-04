import { redirect } from 'next/navigation'
import { SuperAdminClientList } from '@/components/admin/superadmin-client-list'
import { SuperAdminCaseList } from '@/components/admin/superadmin-case-list'
import { Suspense } from 'react'
import { getAuthContext } from '@/lib/auth-middleware'
import { DatabaseService } from '@/lib/database-service'
import { Shield } from 'lucide-react'

async function SuperAdminDashboardContent() {
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
  
  // Fetch all organizations with case counts and all cases
  const [organizations, cases] = await Promise.all([
    DatabaseService.getOrganizationsWithCaseCounts(),
    DatabaseService.getAllCasesWithOrganization()
  ])
  
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, hsl(240 20% 98%), hsl(250 25% 96%))' }}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/10">
              <Shield className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-3xl font-bold text-foreground bg-gradient-to-r from-destructive via-destructive/80 to-primary bg-clip-text text-transparent leading-tight">
              Super Admin Dashboard
            </h1>
          </div>
          <p className="mt-2 text-base text-muted-foreground leading-relaxed">
            Full system control and management across all organizations. You have complete access to all data and administrative functions.
          </p>
          <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive font-medium">
              ⚠️ Superadmin Access: You can view, edit, and delete any data in the system. Use these powers responsibly.
            </p>
          </div>
        </div>
        
        <div className="space-y-8">
          <SuperAdminClientList firms={organizations} />
          <SuperAdminCaseList cases={cases} />
        </div>
      </div>
    </div>
  )
}

function SuperAdminDashboardSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, hsl(240 20% 98%), hsl(250 25% 96%))' }}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-muted rounded"></div>
            <div className="h-4 w-96 bg-muted rounded"></div>
          </div>
        </div>
        
        <div className="space-y-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-32 bg-muted rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SuperAdminDashboard() {
  return (
    <Suspense fallback={<SuperAdminDashboardSkeleton />}>
      <SuperAdminDashboardContent />
    </Suspense>
  )
}
