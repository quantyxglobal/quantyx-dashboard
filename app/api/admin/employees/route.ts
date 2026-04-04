import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { SupabaseDB, getSupabaseClient } from '@/lib/supabase-db'

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user to verify role
    const currentUser = await SupabaseDB.getUserById(session.user.id)
    
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Only admins can view employees' }, { status: 403 })
    }

    const supabase = getSupabaseClient()

    // For SUPER_ADMIN, get all employees
    // For ADMIN, get only employees from their organization
    let query = supabase
      .from('users')
      .select('id, first_name, last_name, email, organization_id')
      .eq('role', 'EMPLOYEE')
      .eq('is_active', true)
      .order('first_name')

    if (currentUser.role === 'ADMIN' && currentUser.organization_id) {
      query = query.eq('organization_id', currentUser.organization_id)
    }

    const { data: employees, error } = await query

    if (error) {
      console.error('[EMPLOYEES_API] Error fetching employees:', error)
      return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
    }

    return NextResponse.json({ employees: employees || [] })
  } catch (error) {
    console.error('[EMPLOYEES_API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
