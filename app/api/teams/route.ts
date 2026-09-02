import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-db'
import { auth } from '@/auth'

/**
 * GET /api/teams
 * Get all teams for the current user's organization
 * Only accessible by SUPER_ADMIN and ADMIN
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

    const { role, organizationId } = session.user as any

    // Only SUPER_ADMIN and ADMIN can view teams
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can view teams' },
        { status: 403 }
      )
    }

    const supabase = getSupabaseClient()

    // Build query based on role
    let query = supabase
      .from('teams')
      .select(`
        *,
        manager:users!teams_manager_id_fkey(
          id,
          first_name,
          last_name,
          email,
          role
        ),
        organization:organizations(
          id,
          name,
          display_name
        ),
        members:users!users_team_id_fkey(
          id,
          first_name,
          last_name,
          email,
          role
        )
      `)
      .order('created_at', { ascending: false })

    // ADMIN can only see teams in their organization
    if (role === 'ADMIN') {
      if (!organizationId) {
        return NextResponse.json(
          { error: 'Organization not found' },
          { status: 400 }
        )
      }
      query = query.eq('organization_id', organizationId)
    }

    const { data: teams, error } = await query

    if (error) {
      console.error('[API] Error fetching teams:', error)
      return NextResponse.json(
        { error: 'Failed to fetch teams', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ teams })
  } catch (error) {
    console.error('[API] Unexpected error in GET /api/teams:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/teams
 * Create a new team
 * Only accessible by SUPER_ADMIN and ADMIN
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { role, organizationId } = session.user as any

    // Only SUPER_ADMIN and ADMIN can create teams
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can create teams' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, managerId, organizationId: teamOrgId } = body

    if (!managerId) {
      return NextResponse.json(
        { error: 'Manager ID is required' },
        { status: 400 }
      )
    }

    // Determine organization ID
    let finalOrgId = teamOrgId
    if (role === 'ADMIN') {
      // ADMIN can only create teams in their own organization
      if (!organizationId) {
        return NextResponse.json(
          { error: 'Organization not found' },
          { status: 400 }
        )
      }
      finalOrgId = organizationId
    } else if (!finalOrgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Verify the manager exists and has the correct role
    const { data: manager, error: managerError } = await supabase
      .from('users')
      .select('id, role, organization_id, first_name, last_name')
      .eq('id', managerId)
      .eq('is_active', true)
      .single()

    if (managerError || !manager) {
      return NextResponse.json(
        { error: 'Manager not found' },
        { status: 404 }
      )
    }

    if (manager.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Selected user is not a manager' },
        { status: 400 }
      )
    }

    if (manager.organization_id !== finalOrgId) {
      return NextResponse.json(
        { error: 'Manager must belong to the same organization' },
        { status: 400 }
      )
    }

    // Check if manager already has a team
    const { data: existingTeam } = await supabase
      .from('teams')
      .select('id')
      .eq('manager_id', managerId)
      .single()

    if (existingTeam) {
      return NextResponse.json(
        { error: 'Manager already has a team' },
        { status: 400 }
      )
    }

    // Auto-generate team name if not provided
    const teamName = name || `${manager.first_name} ${manager.last_name}'s Team`

    // Create the team
    const { data: team, error: createError } = await supabase
      .from('teams')
      .insert({
        name: teamName,
        manager_id: managerId,
        organization_id: finalOrgId
      })
      .select(`
        *,
        manager:users!teams_manager_id_fkey(
          id,
          first_name,
          last_name,
          email,
          role
        ),
        organization:organizations(
          id,
          name,
          display_name
        )
      `)
      .single()

    if (createError) {
      console.error('[API] Error creating team:', createError)
      return NextResponse.json(
        { error: 'Failed to create team', details: createError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ team }, { status: 201 })
  } catch (error) {
    console.error('[API] Unexpected error in POST /api/teams:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
