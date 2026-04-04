import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { SupabaseDB } from '@/lib/supabase-db'
import { SuperAdminUserManagement } from '@/components/admin/superadmin-user-management'

export default async function SuperAdminUsersPage() {
  const session = await auth()
  
  if (!session) {
    redirect('/login')
  }
  
  // Verify super admin role from database
  const currentUser = await SupabaseDB.getUserById(session.user.id)
  
  if (currentUser?.role !== 'SUPER_ADMIN') {
    if (currentUser?.role === 'ADMIN') {
      redirect('/admin/users')
    } else {
      redirect('/dashboard')
    }
  }
  
  // Fetch all users
  const users = await SupabaseDB.getAllUsers()
  
  // Fetch all organizations for the create account modal and filters
  const organizations = await SupabaseDB.getAllOrganizations()
  const firms = organizations.map(org => ({
    id: org.id,
    name: org.display_name || org.name
  }))
  
  return <SuperAdminUserManagement users={users} firms={firms} />
}
