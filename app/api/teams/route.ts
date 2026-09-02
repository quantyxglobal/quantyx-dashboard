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
    console.log('[API /api/teams POST] Request received')
    const session = await auth()
    
    if (!session?.user?.id) {
      console.error('[API /api/teams POST] No session or user ID')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { role, organizationId, organization_id } = session.user as any
    const sessionOrgId = organizationId || organization_id
    
    console.log('[API /api/teams POST] Session user:', {
      id: session.user.id,
      email: session.user.email,
      role,
      organizationId,
      organization_id,
      sessionOrgId
    })

    // Only SUPER_ADMIN and ADMIN can create teams
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      console.error('[API /api/teams POST] Forbidden - role:', role)
      return NextResponse.json(
        { error: 'Forbidden: Only admins can create teams' },
        { status: 403 }
      )
    }

    const body = await request.json()
    console.log('[API /api/teams POST] Request body:', body)
    const { name, managerId, organizationId: teamOrgId } = body

    if (!managerId) {
      console.error('[API /api/teams POST] Missing managerId')
      return NextResponse.json(
        { error: 'Manager ID is required' },
        { status: 400 }
      )
    }

    // Determine organization ID
    let finalOrgId = teamOrgId
    if (role === 'ADMIN') {
      // ADMIN can only create teams in their own organization
      if (!sessionOrgId) {
        console.error('[API /api/teams POST] Admin has no organization')
        return NextResponse.json(
          { error: 'Organization not found' },
          { status: 400 }
        )
      }
      finalOrgId = sessionOrgId
    } else if (!finalOrgId) {
      console.error('[API /api/teams POST] Super admin missing organizationId in body')
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }
    
    console.log('[API /api/teams POST] Final org ID:', finalOrgId)

    const supabase = getSupabaseClient()

    // Verify the manager exists and has the correct role
    console.log('[API /api/teams POST] Verifying manager:', managerId)
    const { data: manager, error: managerError } = await supabase
      .from('users')
      .select('id, role, organization_id, first_name, last_name')
      .eq('id', managerId)
      .eq('is_active', true)
      .single()

    if (managerError) {
      console.error('[API /api/teams POST] Manager query error:', managerError)
      return NextResponse.json(
        { error: 'Manager not found', details: managerError.message },
        { status: 404 }
      )
    }
    
    if (!manager) {
      console.error('[API /api/teams POST] Manager not found in DB')
      return NextResponse.json(
        { error: 'Manager not found' },
        { status: 404 }
      )
    }
    
    console.log('[API /api/teams POST] Manager found:', manager)

    if (manager.role !== 'MANAGER') {
      console.error('[API /api/teams POST] User is not a manager, role:', manager.role)
      return NextResponse.json(
        { error: 'Selected user is not a manager' },
        { status: 400 }
      )
    }

    if (manager.organization_id !== finalOrgId) {
      console.error('[API /api/teams POST] Organization mismatch:', {
        managerOrg: manager.organization_id,
        requiredOrg: finalOrgId
      })
      return NextResponse.json(
        { error: 'Manager must belong to the same organization' },
        { status: 400 }
      )
    }

    // Check if manager already has a team
    console.log('[API /api/teams POST] Checking if manager has existing team')
    const { data: existingTeam, error: existingTeamError } = await supabase
      .from('teams')
      .select('id')
      .eq('manager_id', managerId)
      .single()
      
    if (existingTeamError && existingTeamError.code !== 'PGRST116') {
      console.error('[API /api/teams POST] Error checking existing team:', existingTeamError)
    }

    if (existingTeam) {
      console.error('[API /api/teams POST] Manager already has a team:', existingTeam.id)
      return NextResponse.json(
        { error: 'Manager already has a team' },
        { status: 400 }
      )
    }

    // Auto-generate team name if not provided
    const teamName = name || `${manager.first_name} ${manager.last_name}'s Team`
    console.log('[API /api/teams POST] Creating team with name:', teamName)

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
      console.error('[API /api/teams POST] Error creating team:', createError)
      console.error('[API /api/teams POST] Error details:', JSON.stringify(createError, null, 2))
      return NextResponse.json(
        { error: 'Failed to create team', details: createError.message },
        { status: 500 }
      )
    }
    
    console.log('[API /api/teams POST] Team created successfully:', team)

    return NextResponse.json({ team }, { status: 201 })
  } catch (error) {
    console.error('[API /api/teams POST] Unexpected error:', error)
    console.error('[API /api/teams POST] Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
