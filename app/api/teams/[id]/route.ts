import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-db'
import { auth } from '@/auth'

/**
 * GET /api/teams/[id]
 * Get a specific team by ID
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

    // Fetch the team
    const { data: team, error } = await supabase
      .from('teams')
      .select(`
        *,
        manager:users!teams_manager_id_fkey(
          id,
          first_name,
          last_name,
          email,
          role,
          avatar_url
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
          role,
          avatar_url,
          created_at
        )
      `)
      .eq('id', teamId)
      .single()

    if (error || !team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (role === 'SUPER_ADMIN') {
      // Super admin can view any team
    } else if (role === 'ADMIN') {
      // Admin can only view teams in their organization
      if (team.organization_id !== organizationId) {
        return NextResponse.json(
          { error: 'Forbidden: Team not in your organization' },
          { status: 403 }
        )
      }
    } else if (role === 'MANAGER') {
      // Manager can only view their own team
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

    return NextResponse.json({ team })
  } catch (error) {
    console.error('[API] Unexpected error in GET /api/teams/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/teams/[id]
 * Update a team (name, manager)
 * Only accessible by SUPER_ADMIN and ADMIN
 */
export async function PATCH(
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

    // Only SUPER_ADMIN and ADMIN can update teams
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can update teams' },
        { status: 403 }
      )
    }

    const teamId = params.id
    const body = await request.json()
    const { name, managerId } = body

    const supabase = getSupabaseClient()

    // Fetch existing team
    const { data: existingTeam, error: fetchError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single()

    if (fetchError || !existingTeam) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (role === 'ADMIN' && existingTeam.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Forbidden: Team not in your organization' },
        { status: 403 }
      )
    }

    // Prepare update data
    const updateData: any = {}
    
    if (name !== undefined) {
      updateData.name = name
    }

    if (managerId && managerId !== existingTeam.manager_id) {
      // Verify new manager exists and has correct role
      const { data: newManager, error: managerError } = await supabase
        .from('users')
        .select('id, role, organization_id')
        .eq('id', managerId)
        .eq('is_active', true)
        .single()

      if (managerError || !newManager) {
        return NextResponse.json(
          { error: 'New manager not found' },
          { status: 404 }
        )
      }

      if (newManager.role !== 'MANAGER') {
        return NextResponse.json(
          { error: 'Selected user is not a manager' },
          { status: 400 }
        )
      }

      if (newManager.organization_id !== existingTeam.organization_id) {
        return NextResponse.json(
          { error: 'New manager must belong to the same organization' },
          { status: 400 }
        )
      }

      // Check if new manager already has a team
      const { data: managerTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('manager_id', managerId)
        .neq('id', teamId)
        .single()

      if (managerTeam) {
        return NextResponse.json(
          { error: 'New manager already has a team' },
          { status: 400 }
        )
      }

      updateData.manager_id = managerId
    }

    // Update the team
    const { data: updatedTeam, error: updateError } = await supabase
      .from('teams')
      .update(updateData)
      .eq('id', teamId)
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
      .single()

    if (updateError) {
      console.error('[API] Error updating team:', updateError)
      return NextResponse.json(
        { error: 'Failed to update team', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ team: updatedTeam })
  } catch (error) {
    console.error('[API] Unexpected error in PATCH /api/teams/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/teams/[id]
 * Delete a team
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

    // Only SUPER_ADMIN and ADMIN can delete teams
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can delete teams' },
        { status: 403 }
      )
    }

    const teamId = params.id
    const supabase = getSupabaseClient()

    // Fetch existing team
    const { data: existingTeam, error: fetchError } = await supabase
      .from('teams')
      .select('*, members:users!users_team_id_fkey(id)')
      .eq('id', teamId)
      .single()

    if (fetchError || !existingTeam) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (role === 'ADMIN' && existingTeam.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Forbidden: Team not in your organization' },
        { status: 403 }
      )
    }

    // Check if team has members
    if (existingTeam.members && existingTeam.members.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete team with members. Please remove all members first.' },
        { status: 400 }
      )
    }

    // Delete the team
    const { error: deleteError } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId)

    if (deleteError) {
      console.error('[API] Error deleting team:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete team', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'Team deleted successfully' })
  } catch (error) {
    console.error('[API] Unexpected error in DELETE /api/teams/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
