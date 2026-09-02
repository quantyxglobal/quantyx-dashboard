import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AdminFirmManagement } from '@/components/admin/AdminFirmManagement'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export default async function AdminFirmsPage() {
  const session = await auth()
  
  if (!session) {
    redirect('/login')
  }

  // Only admin users can access this page
  // Note: Auth config converts roles to lowercase, so check for 'admin'
  if (session.user.role !== 'admin') {
    redirect('/dashboard')
  }

  // Get all organizations (firms) with their users and case counts
  // Exclude Quantyx Global (service provider organization)
  const { data: organizations, error: orgsError } = await supabase
    .from('organizations')
    .select(`
      id,
      name,
      display_name,
      firm_number,
      is_firm,
      created_at
    `)
    .eq('is_firm', true)
    .neq('name', 'Quantyx Global')  // Exclude service provider
    .order('created_at', { ascending: false })

  if (orgsError) {
    console.error('Error fetching organizations:', orgsError)
  }

  // Get users for each organization
  const firmsWithData = await Promise.all(
    (organizations || []).map(async (org) => {
      // Get users
      const { data: users } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role, created_at')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false })

      // Get cases
      const { data: cases } = await supabase
        .from('cases')
        .select('id, status')
        .eq('organization_id', org.id)

      return {
        id: org.id,
        name: org.display_name || org.name,
        firm_sequence: parseInt(org.firm_number || '0'),
        created_at: new Date(org.created_at),
        users: (users || []).map(u => ({
          id: u.id,
          name: `${u.first_name} ${u.last_name}`,
          email: u.email,
          role: u.role,
          created_at: new Date(u.created_at)
        })),
        cases: cases || [],
        _count: {
          users: users?.length || 0,
          cases: cases?.length || 0
        }
      }
    })
  )

  // Get orphaned users (users without organization)
  const { data: orphanedUsersData } = await supabase
    .from('users')
    .select('id, first_name, last_name, email, role, created_at')
    .is('organization_id', null)
    .eq('role', 'CLIENT')
    .order('created_at', { ascending: false })

  const orphanedUsers = (orphanedUsersData || []).map(u => ({
    id: u.id,
    name: `${u.first_name} ${u.last_name}`,
    email: u.email,
    role: u.role,
    created_at: new Date(u.created_at)
  }))

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent mb-2">
            Firm Management
          </h1>
          <p className="text-muted-foreground">
            Manage law firms and organizations
          </p>
        </div>

        <AdminFirmManagement 
          firms={firmsWithData}
          orphanedUsers={orphanedUsers}
        />
      </div>
    </div>
  )
}