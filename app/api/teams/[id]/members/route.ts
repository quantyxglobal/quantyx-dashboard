import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-db'
import { auth } from '@/auth'

/**
 * GET /api/teams/[id]/members
 * Get all members of a specific team
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { role, organizationId, id: userId } = session.user as any
    const teamId = params.id

    const supabase = getSupabaseClient()

    // Fetch the team first to check permissions
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, organization_id, manager_id')
      .eq('id', teamId)
      .single()

    if (teamError || !team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (role === 'SUPER_ADMIN') {
      // Super admin can view any team's members
    } else if (role === 'ADMIN') {
      // Admin can only view teams in their organization
      if (team.organization_id !== organizationId) {
        return NextResponse.json(
          { error: 'Forbidden: Team not in your organization' },
          { status: 403 }
        )
      }
    } else if (role === 'MANAGER') {
      // Manager can only view their own team's members
      if (team.manager_id !== userId) {
        return NextResponse.json(
          { error: 'Forbidden: Not your team' },
          { status: 403 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      )
    }

    // Fetch team members
    const { data: members, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, role, avatar_url, created_at')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[API] Error fetching team members:', error)
      return NextResponse.json(
        { error: 'Failed to fetch team members', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ members: members || [] })
  } catch (error) {
    console.error('[API] Unexpected error in GET /api/teams/[id]/members:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/teams/[id]/members
 * Add members to a team
 * Only accessible by SUPER_ADMIN and ADMIN
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { role, organizationId } = session.user as any

    // Only SUPER_ADMIN and ADMIN can add members
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can add team members' },
        { status: 403 }
      )
    }

    const teamId = params.id
    const body = await request.json()
    const { userIds } = body // Array of user IDs to add

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'User IDs array is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Fetch the team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, organization_id')
      .eq('id', teamId)
      .single()

    if (teamError || !team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (role === 'ADMIN' && team.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Forbidden: Team not in your organization' },
        { status: 403 }
      )
    }

    // Verify all users exist and belong to the same organization
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, role, organization_id, team_id')
      .in('id', userIds)
      .eq('is_active', true)

    if (usersError) {
      console.error('[API] Error fetching users:', usersError)
      return NextResponse.json(
        { error: 'Failed to fetch users', details: usersError.message },
        { status: 500 }
      )
    }

    if (!users || users.length !== userIds.length) {
      return NextResponse.json(
        { error: 'One or more users not found' },
        { status: 404 }
      )
    }

    // Validate users
    const invalidUsers = users.filter(u => 
      u.organization_id !== team.organization_id ||
      u.role === 'ADMIN' || 
      u.role === 'SUPER_ADMIN' || 
      u.role === 'MANAGER' ||
      u.role === 'CLIENT'
    )

    if (invalidUsers.length > 0) {
      return NextResponse.json(
        { error: 'Only EMPLOYEE users from the same organization can be added to teams' },
        { status: 400 }
      )
    }

    // Check for users already in other teams
    const usersInOtherTeams = users.filter(u => u.team_id && u.team_id !== teamId)
    if (usersInOtherTeams.length > 0) {
      return NextResponse.json(
        { 
          error: 'Some users are already in other teams',
          users: usersInOtherTeams.map(u => ({ id: u.id, name: `${u.first_name} ${u.last_name}` }))
        },
        { status: 400 }
      )
    }

    // Add users to team
    const { error: updateError } = await supabase
      .from('users')
      .update({ team_id: teamId })
      .in('id', userIds)

    if (updateError) {
      console.error('[API] Error adding users to team:', updateError)
      return NextResponse.json(
        { error: 'Failed to add users to team', details: updateError.message },
        { status: 500 }
      )
    }

    // Fetch updated members list
    const { data: updatedMembers } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, role, avatar_url, created_at')
      .eq('team_id', teamId)
      .eq('is_active', true)

    return NextResponse.json({ 
      success: true,
      message: `${userIds.length} member(s) added to team`,
      members: updatedMembers || []
    })
  } catch (error) {
    console.error('[API] Unexpected error in POST /api/teams/[id]/members:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/teams/[id]/members
 * Remove members from a team
 * Only accessible by SUPER_ADMIN and ADMIN
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { role, organizationId } = session.user as any

    // Only SUPER_ADMIN and ADMIN can remove members
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can remove team members' },
        { status: 403 }
      )
    }

    const teamId = params.id
    const body = await request.json()
    const { userIds } = body // Array of user IDs to remove

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'User IDs array is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Fetch the team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, organization_id')
      .eq('id', teamId)
      .single()

    if (teamError || !team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (role === 'ADMIN' && team.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Forbidden: Team not in your organization' },
        { status: 403 }
      )
    }

    // Remove users from team (set team_id to null)
    const { error: updateError } = await supabase
      .from('users')
      .update({ team_id: null })
      .in('id', userIds)
      .eq('team_id', teamId)

    if (updateError) {
      console.error('[API] Error removing users from team:', updateError)
      return NextResponse.json(
        { error: 'Failed to remove users from team', details: updateError.message },
        { status: 500 }
      )
    }

    // Fetch updated members list
    const { data: updatedMembers } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, role, avatar_url, created_at')
      .eq('team_id', teamId)
      .eq('is_active', true)

    return NextResponse.json({ 
      success: true,
      message: `${userIds.length} member(s) removed from team`,
      members: updatedMembers || []
    })
  } catch (error) {
    console.error('[API] Unexpected error in DELETE /api/teams/[id]/members:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
