import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-db'
import { auth } from '@/auth'

/**
 * GET /api/manager/team
 * Get manager's team information and members
 * Only accessible by MANAGER role
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

    const { role, id: managerId } = session.user as any

    // Only MANAGER can access this endpoint
    if (role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Forbidden: Only managers can access this endpoint' },
        { status: 403 }
      )
    }

    const supabase = getSupabaseClient()

    // Get manager's team with details
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select(`
        id,
        name,
        created_at,
        updated_at,
        organization:organizations(
          id,
          name,
          display_name
        ),
        manager:users!teams_manager_id_fkey(
          id,
          first_name,
          last_name,
          email,
          avatar_url
        )
      `)
      .eq('manager_id', managerId)
      .single()

    if (teamError || !team) {
      return NextResponse.json(
        { error: 'Team not found. You must be assigned to a team.' },
        { status: 404 }
      )
    }

    // Get team members (employees)
    const { data: members, error: membersError } = await supabase
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        email,
        role,
        avatar_url,
        title,
        department,
        created_at,
        last_login_at
      `)
      .eq('team_id', team.id)
      .eq('is_active', true)
      .order('first_name')

    if (membersError) {
      console.error('[API] Error fetching team members:', membersError)
      return NextResponse.json(
        { error: 'Failed to fetch team members', details: membersError.message },
        { status: 500 }
      )
    }

    // Get case statistics for each member
    const memberIds = members?.map(m => m.id) || []
    
    let memberStats = []
    if (memberIds.length > 0) {
      const { data: assignments } = await supabase
        .from('case_assignments')
        .select(`
          user_id,
          case:cases(
            id,
            status
          )
        `)
        .in('user_id', memberIds)

      // Calculate stats per member
      memberStats = members?.map(member => {
        const memberAssignments = assignments?.filter((a: any) => a.user_id === member.id) || []
        const activeCases = memberAssignments.filter((a: any) => 
          a.case?.status && !['COMPLETED', 'DELIVERED', 'CANCELLED', 'ARCHIVED'].includes(a.case.status)
        )

        return {
          ...member,
          stats: {
            totalCases: memberAssignments.length,
            activeCases: activeCases.length,
            completedCases: memberAssignments.filter((a: any) => 
              a.case?.status === 'COMPLETED' || a.case?.status === 'DELIVERED'
            ).length
          }
        }
      }) || []
    }

    // Get team-wide case statistics
    const { data: teamCases } = await supabase
      .from('case_assignments')
      .select(`
        case_id,
        case:cases(
          id,
          status,
          priority
        )
      `)
      .eq('user_id', managerId)

    const uniqueCaseIds = [...new Set(teamCases?.map((tc: any) => tc.case_id))]
    
    const teamStats = {
      totalMembers: members?.length || 0,
      totalCases: uniqueCaseIds.length,
      activeCases: teamCases?.filter((tc: any) => 
        tc.case?.status && !['COMPLETED', 'DELIVERED', 'CANCELLED', 'ARCHIVED'].includes(tc.case.status)
      ).length || 0,
      highPriorityCases: teamCases?.filter((tc: any) => 
        tc.case?.priority === 'SUPER_RUSH' || tc.case?.priority === 'EXPEDITE'
      ).length || 0
    }

    return NextResponse.json({ 
      team,
      members: memberStats,
      stats: teamStats
    })
  } catch (error) {
    console.error('[API] Unexpected error in GET /api/manager/team:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
