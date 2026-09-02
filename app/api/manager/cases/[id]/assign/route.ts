import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-db'
import { auth } from '@/auth'

/**
 * POST /api/manager/cases/[id]/assign
 * Manager assigns a case to team members (employees)
 * Only accessible by MANAGER role
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

    const { role, id: managerId } = session.user as any

    // Only MANAGER can access this endpoint
    if (role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Forbidden: Only managers can assign cases' },
        { status: 403 }
      )
    }

    const caseId = params.id
    const body = await request.json()
    const { employeeIds = [] } = body

    // Validate input
    if (!Array.isArray(employeeIds)) {
      return NextResponse.json(
        { error: 'employeeIds must be an array' },
        { status: 400 }
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

    // Verify the case exists and is assigned to the manager
    const { data: managerAssignment, error: assignmentError } = await supabase
      .from('case_assignments')
      .select(`
        id,
        case:cases(
          id,
          case_number,
          organization_id,
          status
        )
      `)
      .eq('case_id', caseId)
      .eq('user_id', managerId)
      .single()

    if (assignmentError || !managerAssignment || !managerAssignment.case) {
      return NextResponse.json(
        { error: 'Case not found or not assigned to you' },
        { status: 404 }
      )
    }

    const caseData = managerAssignment.case as any

    // Verify case is in the same organization
    if (caseData.organization_id !== team.organization_id) {
      return NextResponse.json(
        { error: 'Case not in your organization' },
        { status: 403 }
      )
    }

    // Get current employee assignments for this case (from the manager's team)
    const { data: currentAssignments } = await supabase
      .from('case_assignments')
      .select(`
        user_id,
        users(role, team_id)
      `)
      .eq('case_id', caseId)

    const currentEmployeeIds = currentAssignments
      ?.filter((a: any) => a.users?.role === 'EMPLOYEE' && a.users?.team_id === team.id)
      .map((a: any) => a.user_id) || []

    // Validate employees
    if (employeeIds.length > 0) {
      const { data: employees, error: employeesError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role, team_id, is_active')
        .in('id', employeeIds)

      if (employeesError) {
        console.error('[API] Error fetching employees:', employeesError)
        return NextResponse.json(
          { error: 'Failed to fetch employees', details: employeesError.message },
          { status: 500 }
        )
      }

      if (!employees || employees.length !== employeeIds.length) {
        return NextResponse.json(
          { error: 'One or more employees not found' },
          { status: 404 }
        )
      }

      // Validate all employees belong to manager's team
      const invalidEmployees = employees.filter(e => 
        e.role !== 'EMPLOYEE' || 
        e.team_id !== team.id || 
        !e.is_active
      )

      if (invalidEmployees.length > 0) {
        return NextResponse.json(
          { 
            error: 'Can only assign to active employees in your team',
            invalidUsers: invalidEmployees.map(e => ({ 
              id: e.id, 
              name: `${e.first_name} ${e.last_name}`,
              reason: e.role !== 'EMPLOYEE' ? 'Not an employee' : 
                      e.team_id !== team.id ? 'Not in your team' : 'Inactive'
            }))
          },
          { status: 400 }
        )
      }
    }

    // Calculate changes
    const employeesToAdd = employeeIds.filter((id: string) => !currentEmployeeIds.includes(id))
    const employeesToRemove = currentEmployeeIds.filter((id: string) => !employeeIds.includes(id))

    // Remove old employee assignments
    if (employeesToRemove.length > 0) {
      const { error: removeError } = await supabase
        .from('case_assignments')
        .delete()
        .eq('case_id', caseId)
        .in('user_id', employeesToRemove)

      if (removeError) {
        console.error('[API] Error removing assignments:', removeError)
        return NextResponse.json(
          { error: 'Failed to remove assignments', details: removeError.message },
          { status: 500 }
        )
      }

      // Log unassignments in history
      const unassignHistoryRecords = employeesToRemove.map(userId => ({
        case_id: caseId,
        assigned_by_id: managerId,
        assigned_to_id: userId,
        action: 'unassigned',
        metadata: { 
          case_number: caseData.case_number,
          assigned_by_role: 'MANAGER',
          team_id: team.id
        }
      }))

      await supabase
        .from('case_assignment_history')
        .insert(unassignHistoryRecords)
    }

    // Add new employee assignments
    if (employeesToAdd.length > 0) {
      const assignmentRecords = employeesToAdd.map(userId => ({
        case_id: caseId,
        user_id: userId,
        assigned_by_id: managerId
      }))

      const { error: addError } = await supabase
        .from('case_assignments')
        .insert(assignmentRecords)

      if (addError) {
        console.error('[API] Error adding assignments:', addError)
        return NextResponse.json(
          { error: 'Failed to add assignments', details: addError.message },
          { status: 500 }
        )
      }

      // Log assignments in history
      const assignHistoryRecords = employeesToAdd.map(userId => ({
        case_id: caseId,
        assigned_by_id: managerId,
        assigned_to_id: userId,
        action: 'assigned',
        metadata: { 
          case_number: caseData.case_number,
          assigned_by_role: 'MANAGER',
          team_id: team.id
        }
      }))

      await supabase
        .from('case_assignment_history')
        .insert(assignHistoryRecords)
    }

    // Fetch updated assignments for this case (team members only)
    const { data: updatedAssignments } = await supabase
      .from('case_assignments')
      .select(`
        id,
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
      .eq('case_id', caseId)

    const teamAssignments = updatedAssignments?.filter((a: any) => 
      a.user?.team_id === team.id || a.user_id === managerId
    ) || []

    return NextResponse.json({ 
      success: true,
      message: 'Case assignments updated successfully',
      assignments: teamAssignments,
      changes: {
        employeesAdded: employeesToAdd.length,
        employeesRemoved: employeesToRemove.length
      }
    })
  } catch (error) {
    console.error('[API] Unexpected error in POST /api/manager/cases/[id]/assign:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/manager/cases/[id]/assign
 * Get current case assignments for a case in manager's team
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

    const { role, id: managerId } = session.user as any

    // Only MANAGER can access this endpoint
    if (role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Forbidden: Only managers can access this endpoint' },
        { status: 403 }
      )
    }

    const caseId = params.id
    const supabase = getSupabaseClient()

    // Get manager's team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('manager_id', managerId)
      .single()

    if (teamError || !team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      )
    }

    // Verify the case is assigned to the manager
    const { data: managerAssignment } = await supabase
      .from('case_assignments')
      .select('id')
      .eq('case_id', caseId)
      .eq('user_id', managerId)
      .single()

    if (!managerAssignment) {
      return NextResponse.json(
        { error: 'Case not assigned to you' },
        { status: 404 }
      )
    }

    // Fetch all assignments for this case
    const { data: assignments, error: assignError } = await supabase
      .from('case_assignments')
      .select(`
        id,
        user_id,
        assigned_at,
        assigned_by:users!case_assignments_assigned_by_id_fkey(
          id,
          first_name,
          last_name,
          email
        ),
        user:users!case_assignments_user_id_fkey(
          id,
          first_name,
          last_name,
          email,
          role,
          avatar_url,
          team_id
        )
      `)
      .eq('case_id', caseId)
      .order('assigned_at', { ascending: false })

    if (assignError) {
      console.error('[API] Error fetching assignments:', assignError)
      return NextResponse.json(
        { error: 'Failed to fetch assignments', details: assignError.message },
        { status: 500 }
      )
    }

    // Filter to show only team members
    const teamAssignments = assignments?.filter((a: any) => 
      a.user?.team_id === team.id || a.user_id === managerId
    ) || []

    const employees = teamAssignments.filter((a: any) => a.user?.role === 'EMPLOYEE')

    return NextResponse.json({ 
      assignments: teamAssignments,
      employees,
      summary: {
        totalTeamAssignments: teamAssignments.length,
        employeesAssigned: employees.length
      }
    })
  } catch (error) {
    console.error('[API] Unexpected error in GET /api/manager/cases/[id]/assign:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
