import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { SupabaseDB, getSupabaseClient } from '@/lib/supabase-db'

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      console.log('[EMPLOYEES_API] No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[EMPLOYEES_API] Fetching employees for user:', session.user.id, 'role:', session.user.role)

    // Get current user to verify role
    const currentUser = await SupabaseDB.getUserById(session.user.id)
    
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
      console.log('[EMPLOYEES_API] Access denied - user role:', currentUser?.role)
      return NextResponse.json({ error: 'Only admins can view employees' }, { status: 403 })
    }

    console.log('[EMPLOYEES_API] User verified - role:', currentUser.role, 'org_id:', currentUser.organization_id)

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
      console.log('[EMPLOYEES_API] Filtering by organization:', currentUser.organization_id)
      query = query.eq('organization_id', currentUser.organization_id)
    } else {
      console.log('[EMPLOYEES_API] Fetching all employees (SUPER_ADMIN)')
    }

    const { data: employees, error } = await query

    if (error) {
      console.error('[EMPLOYEES_API] Error fetching employees:', error)
      return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
    }

    console.log('[EMPLOYEES_API] Found', employees?.length || 0, 'employees')

    return NextResponse.json({ employees: employees || [] })
  } catch (error) {
    console.error('[EMPLOYEES_API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
