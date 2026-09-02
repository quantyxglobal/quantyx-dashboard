import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-db'
import { auth } from '@/auth'

/**
 * GET /api/manager/cases
 * Get all cases assigned to the manager's team
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

    // Get manager's team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, organization_id')
      .eq('manager_id', managerId)
      .single()

    if (teamError || !team) {
      return NextResponse.json(
        { error: 'Team not found. You must be assigned to a team.' },
        { status: 404 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const includeTeamMembers = searchParams.get('includeTeamMembers') === 'true'

    // Get cases assigned to the manager
    let query = supabase
      .from('case_assignments')
      .select(`
        case_id,
        assigned_at,
        case:cases(
          id,
          case_number,
          title,
          description,
          status,
          priority,
          due_date,
          client_name,
          client_email,
          created_at,
          updated_at,
          organization:organizations(
            id,
            name,
            display_name
          )
        )
      `)
      .eq('user_id', managerId)

    const { data: managerCases, error: casesError } = await query

    if (casesError) {
      console.error('[API] Error fetching manager cases:', casesError)
      return NextResponse.json(
        { error: 'Failed to fetch cases', details: casesError.message },
        { status: 500 }
      )
    }

    // Extract unique case IDs
    const caseIds = managerCases?.map((mc: any) => mc.case_id).filter(Boolean) || []

    if (caseIds.length === 0) {
      return NextResponse.json({ 
        cases: [],
        team,
        summary: {
          totalCases: 0,
          assignedToManager: 0,
          assignedToTeam: 0,
          unassignedInTeam: 0
        }
      })
    }

    // Get all assignments for these cases to see team involvement
    const { data: allAssignments } = await supabase
      .from('case_assignments')
      .select(`
        case_id,
        user_id,
        assigned_at,
        user:users(
          id,
          first_name,
          last_name,
          email,
          role,
          avatar_url,
          team_id
        )
      `)
      .in('case_id', caseIds)

    // Organize data
    const casesWithAssignments = managerCases?.map((mc: any) => {
      const caseData = mc.case
      if (!caseData) return null

      const caseAssignments = allAssignments?.filter((a: any) => a.case_id === caseData.id) || []
      
      // Separate team members and others
      const teamAssignments = caseAssignments.filter((a: any) => 
        a.user?.team_id === team.id || a.user_id === managerId
      )
      
      const employeeAssignments = teamAssignments.filter((a: any) => 
        a.user?.role === 'EMPLOYEE'
      )

      return {
        ...caseData,
        assignments: teamAssignments,
        employeeAssignments,
        isAssignedToManager: caseAssignments.some((a: any) => a.user_id === managerId),
        assignedToTeamCount: teamAssignments.length,
        assignedEmployeesCount: employeeAssignments.length
      }
    }).filter(Boolean)

    // Apply filters
    let filteredCases = casesWithAssignments || []
    
    if (status) {
      filteredCases = filteredCases.filter((c: any) => c.status === status)
    }
    
    if (priority) {
      filteredCases = filteredCases.filter((c: any) => c.priority === priority)
    }

    // Calculate summary
    const summary = {
      totalCases: filteredCases.length,
      assignedToManager: filteredCases.filter((c: any) => c.isAssignedToManager).length,
      assignedToTeam: filteredCases.filter((c: any) => c.assignedToTeamCount > 0).length,
      unassignedInTeam: filteredCases.filter((c: any) => c.assignedEmployeesCount === 0).length
    }

    // Optionally include team members list
    let teamMembers = []
    if (includeTeamMembers) {
      const { data: members } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role, avatar_url')
        .eq('team_id', team.id)
        .eq('is_active', true)
        .order('first_name')

      teamMembers = members || []
    }

    return NextResponse.json({ 
      cases: filteredCases,
      team: {
        ...team,
        members: teamMembers
      },
      summary
    })
  } catch (error) {
    console.error('[API] Unexpected error in GET /api/manager/cases:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
