import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { SuperAdminFirmManagement } from '@/components/admin/SuperAdminFirmManagement'
import { createClient } from '@supabase/supabase-js'
import { Shield } from 'lucide-react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export default async function SuperAdminFirmsPage() {
  const session = await auth()
  
  if (!session) {
    redirect('/login')
  }

  // Only super admin users can access this page
  if (session.user.role !== 'SUPER_ADMIN') {
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
      address_line1,
      address_line2,
      city,
      state,
      country,
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

      // Get cases with more details
      const { data: cases } = await supabase
        .from('cases')
        .select('id, title, status, created_at, updated_at')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false })

      return {
        id: org.id,
        name: org.display_name || org.name,
        firm_sequence: parseInt(org.firm_number || '0'),
        address_line1: org.address_line1,
        address_line2: org.address_line2,
        city: org.city,
        state: org.state,
        country: org.country,
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
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/10">
              <Shield className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-destructive via-destructive/80 to-primary bg-clip-text text-transparent leading-tight">
              Firm Management
            </h1>
          </div>
          <p className="text-base text-muted-foreground leading-relaxed">
            Manage all law firms and organizations across the system. You have full control over all firms and their data.
          </p>
        </div>

        <SuperAdminFirmManagement 
          firms={firmsWithData}
          orphanedUsers={orphanedUsers}
        />
      </div>
    </div>
  )
}
