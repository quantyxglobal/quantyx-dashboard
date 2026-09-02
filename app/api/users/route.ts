import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-db'
import { auth } from '@/auth'

/**
 * GET /api/users
 * Get users with optional filtering
 * Query params:
 * - role: Filter by role (e.g., MANAGER, EMPLOYEE, CLIENT)
 * - withoutTeam: true to get only users without a team
 * - organizationId: Filter by organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { role: userRole, organizationId: userOrgId, organization_id } = session.user as any
    
    // Handle both organizationId and organization_id from session
    const sessionOrgId = userOrgId || organization_id

    // Only SUPER_ADMIN and ADMIN can list users
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const roleFilter = searchParams.get('role')
    const withoutTeam = searchParams.get('withoutTeam') === 'true'
    const organizationIdFilter = searchParams.get('organizationId')

    const supabase = getSupabaseClient()

    // Build query
    let query = supabase
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        email,
        role,
        is_active,
        team_id,
        organization_id,
        created_at
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    // Apply role filter
    if (roleFilter) {
      query = query.eq('role', roleFilter)
    }

    // Apply withoutTeam filter
    if (withoutTeam) {
      query = query.is('team_id', null)
    }

    // Apply organization filter based on user role
    if (userRole === 'ADMIN') {
      // ADMIN: If they have an org, filter by it; if not, get Quantyx Global users
      if (sessionOrgId) {
        query = query.eq('organization_id', sessionOrgId)
      } else {
        // Admin without organization - get users from Quantyx Global (is_firm = false)
        const { data: quantyxOrg } = await supabase
          .from('organizations')
          .select('id')
          .eq('is_firm', false)
          .limit(1)
          .single()
        
        if (quantyxOrg) {
          query = query.eq('organization_id', quantyxOrg.id)
        }
      }
    } else if (userRole === 'MANAGER') {
      // MANAGER can only see users in their organization
      if (!sessionOrgId) {
        return NextResponse.json(
          { error: 'Organization not found' },
          { status: 400 }
        )
      }
      query = query.eq('organization_id', sessionOrgId)
    } else if (organizationIdFilter) {
      // SUPER_ADMIN can filter by organization
      query = query.eq('organization_id', organizationIdFilter)
    }

    const { data: users, error } = await query

    if (error) {
      console.error('[API] Error fetching users:', error)
      return NextResponse.json(
        { error: 'Failed to fetch users', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ users })
  } catch (error) {
    console.error('[API] Unexpected error in GET /api/users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
