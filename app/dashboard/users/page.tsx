import { auth } from '@/auth'
import { SupabaseDB } from '@/lib/supabase-db'
import { redirect } from 'next/navigation'
import { FirmUserManagement } from '@/components/user-management/FirmUserManagement'

export default async function FirmUsersPage() {
  const session = await auth()
  
  if (!session) {
    redirect('/login')
  }

  // Only client users can access this page
  if (session.user.role !== 'client') {
    redirect('/dashboard')
  }

  // Get current user with organization
  const user = await SupabaseDB.getUserById(session.user.id)

  if (!user || !user.organization_id) {
    redirect('/dashboard')
  }

  // Get organization details
  const organization = await SupabaseDB.getOrganizationById(user.organization_id)

  if (!organization) {
    redirect('/dashboard')
  }

  // Get all users in the organization
  const organizationUsers = await SupabaseDB.getUsersByOrganizationId(user.organization_id)

  // Get pending invitations for this organization
  const pendingInvitations = await SupabaseDB.getPendingInvitationsByOrganizationId(user.organization_id)

  // Format data to match the component's expected structure
  const firmData = {
    id: organization.id,
    name: organization.name,
    users: organizationUsers.map((u: any) => ({
      id: u.id,
      name: `${u.first_name} ${u.last_name}`,
      email: u.email,
      role: u.role,
      created_at: u.created_at
    }))
  }

  const userData = {
    id: user.id,
    name: `${user.first_name} ${user.last_name}`,
    email: user.email,
    role: user.role,
    firm: firmData
  }

  const formattedInvitations = pendingInvitations.map((inv: any) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    created_at: inv.created_at,
    expires_at: inv.expires_at,
    inviter: inv.inviter ? {
      name: `${inv.inviter.first_name} ${inv.inviter.last_name}`,
      email: inv.inviter.email
    } : null
  }))

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Firm User Management
          </h1>
          <p className="text-muted-foreground">
            Manage users and invitations for {organization.name}
          </p>
        </div>

        <FirmUserManagement 
          firm={firmData}
          currentUser={userData}
          pendingInvitations={formattedInvitations}
        />
      </div>
    </div>
  )
}