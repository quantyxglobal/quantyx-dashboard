import { redirect } from 'next/navigation'
import { ClientList } from '@/components/admin/client-list'
import { AdminCaseList } from '@/components/admin/admin-case-list'
import { Suspense } from 'react'
import { getAuthContext } from '@/lib/auth-middleware'
import { DatabaseService } from '@/lib/database-service'

async function AdminDashboardContent() {
  const authContext = await getAuthContext()
  
  if (!authContext) {
    redirect('/login')
  }
  
  // Redirect super admins to their own dashboard
  if (authContext.user.role === 'SUPER_ADMIN') {
    redirect('/superadmin')
  }
  
  // Verify admin or employee role
  if (authContext.user.role !== 'ADMIN' && authContext.user.role !== 'EMPLOYEE') {
    redirect('/dashboard')
  }
  
  const isEmployee = authContext.user.role === 'EMPLOYEE'
  
  // Fetch all organizations with case counts and all cases using centralized service
  // Admins can see all data regardless of organization
  // Employees can only see cases assigned to them
  const [organizations, cases] = await Promise.all([
    isEmployee ? Promise.resolve([]) : DatabaseService.getOrganizationsWithCaseCounts(),
    DatabaseService.getAllCasesWithOrganization(authContext.user.id, authContext.user.role)
  ])
  
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, hsl(240 20% 98%), hsl(250 25% 96%))' }}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent leading-tight">
            {isEmployee ? 'Employee Dashboard' : 'Admin Dashboard'}
          </h1>
          <p className="mt-2 text-base text-muted-foreground leading-relaxed">
            {isEmployee 
              ? 'View and track all cases across the system' 
              : 'Manage all organizations and cases across the system'}
          </p>
        </div>
        
        <div className="space-y-8">
          {!isEmployee && <ClientList firms={organizations} />}
          <AdminCaseList cases={cases} isEmployee={isEmployee} />
        </div>
      </div>
    </div>
  )
}

function AdminDashboardSkeleton() {
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

export default function AdminDashboard() {
  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <AdminDashboardContent />
    </Suspense>
  )
}
