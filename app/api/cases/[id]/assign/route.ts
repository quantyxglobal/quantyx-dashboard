import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-db'
import { auth } from '@/auth'

/**
 * POST /api/cases/[id]/assign
 * Assign a case to multiple managers and/or employees
 * Tracks assignment history
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

    const { role, organizationId, id: adminId } = session.user as any

    // Only SUPER_ADMIN and ADMIN can assign cases
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can assign cases' },
        { status: 403 }
      )
    }

    const caseId = params.id
    const body = await request.json()
    const { managerIds = [], employeeIds = [] } = body

    // Validate input
    if (!Array.isArray(managerIds) || !Array.isArray(employeeIds)) {
      return NextResponse.json(
        { error: 'managerIds and employeeIds must be arrays' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Fetch the case
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, case_number, organization_id, status')
      .eq('id', caseId)
      .single()

    if (caseError || !caseData) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (role === 'ADMIN' && caseData.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Forbidden: Case not in your organization' },
        { status: 403 }
      )
    }

    // Get current assignments
    const { data: currentAssignments } = await supabase
      .from('case_assignments')
      .select('user_id, users(role)')
      .eq('case_id', caseId)

    const currentManagerIds = currentAssignments
      ?.filter((a: any) => a.users?.role === 'MANAGER')
      .map((a: any) => a.user_id) || []
    
    const currentEmployeeIds = currentAssignments
      ?.filter((a: any) => a.users?.role === 'EMPLOYEE')
      .map((a: any) => a.user_id) || []

    // Validate and fetch all users to assign
    const allUserIds = [...managerIds, ...employeeIds]
    
    if (allUserIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role, organization_id')
        .in('id', allUserIds)
        .eq('is_active', true)

      if (usersError) {
        console.error('[API] Error fetching users:', usersError)
        return NextResponse.json(
          { error: 'Failed to fetch users', details: usersError.message },
          { status: 500 }
        )
      }

      if (!users || users.length !== allUserIds.length) {
        return NextResponse.json(
          { error: 'One or more users not found or inactive' },
          { status: 404 }
        )
      }

      // Validate managers
      const invalidManagers = users
        .filter(u => managerIds.includes(u.id))
        .filter(u => u.role !== 'MANAGER')

      if (invalidManagers.length > 0) {
        return NextResponse.json(
          { 
            error: 'Some users are not managers',
            users: invalidManagers.map(u => ({ id: u.id, name: `${u.first_name} ${u.last_name}`, role: u.role }))
          },
          { status: 400 }
        )
      }

      // Validate employees
      const invalidEmployees = users
        .filter(u => employeeIds.includes(u.id))
        .filter(u => u.role !== 'EMPLOYEE')

      if (invalidEmployees.length > 0) {
        return NextResponse.json(
          { 
            error: 'Some users are not employees',
            users: invalidEmployees.map(u => ({ id: u.id, name: `${u.first_name} ${u.last_name}`, role: u.role }))
          },
          { status: 400 }
        )
      }

      // For ADMIN, verify all users are in the same organization
      if (role === 'ADMIN') {
        const wrongOrgUsers = users.filter(u => u.organization_id !== organizationId)
        if (wrongOrgUsers.length > 0) {
          return NextResponse.json(
            { 
              error: 'Cannot assign users from different organizations',
              users: wrongOrgUsers.map(u => ({ id: u.id, name: `${u.first_name} ${u.last_name}` }))
            },
            { status: 400 }
          )
        }
      }
    }

    // Calculate changes
    const managersToAdd = managerIds.filter((id: string) => !currentManagerIds.includes(id))
    const managersToRemove = currentManagerIds.filter((id: string) => !managerIds.includes(id))
    const employeesToAdd = employeeIds.filter((id: string) => !currentEmployeeIds.includes(id))
    const employeesToRemove = currentEmployeeIds.filter((id: string) => !employeeIds.includes(id))

    // Remove old assignments
    const toRemove = [...managersToRemove, ...employeesToRemove]
    if (toRemove.length > 0) {
      const { error: removeError } = await supabase
        .from('case_assignments')
        .delete()
        .eq('case_id', caseId)
        .in('user_id', toRemove)

      if (removeError) {
        console.error('[API] Error removing assignments:', removeError)
        return NextResponse.json(
          { error: 'Failed to remove assignments', details: removeError.message },
          { status: 500 }
        )
      }

      // Log unassignments in history
      const unassignHistoryRecords = toRemove.map(userId => ({
        case_id: caseId,
        assigned_by_id: adminId,
        assigned_to_id: userId,
        action: 'unassigned',
        metadata: { case_number: caseData.case_number }
      }))

      await supabase
        .from('case_assignment_history')
        .insert(unassignHistoryRecords)
    }

    // Add new assignments
    const toAdd = [...managersToAdd, ...employeesToAdd]
    if (toAdd.length > 0) {
      const assignmentRecords = toAdd.map(userId => ({
        case_id: caseId,
        user_id: userId,
        assigned_by_id: adminId
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
      const assignHistoryRecords = toAdd.map(userId => ({
        case_id: caseId,
        assigned_by_id: adminId,
        assigned_to_id: userId,
        action: 'assigned',
        metadata: { case_number: caseData.case_number }
      }))

      await supabase
        .from('case_assignment_history')
        .insert(assignHistoryRecords)
    }

    // Create audit log
    await supabase
      .from('audit_logs')
      .insert({
        action: 'ASSIGNMENT',
        entity_type: 'case',
        entity_id: caseId,
        user_id: adminId,
        organization_id: caseData.organization_id,
        old_values: {
          manager_ids: currentManagerIds,
          employee_ids: currentEmployeeIds
        },
        new_values: {
          manager_ids: managerIds,
          employee_ids: employeeIds
        },
        description: `Assigned case ${caseData.case_number} to ${managerIds.length} manager(s) and ${employeeIds.length} employee(s)`
      })

    // Fetch updated assignments
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
          avatar_url
        )
      `)
      .eq('case_id', caseId)

    return NextResponse.json({ 
      success: true,
      message: 'Case assignments updated successfully',
      assignments: updatedAssignments || [],
      changes: {
        managersAdded: managersToAdd.length,
        managersRemoved: managersToRemove.length,
        employeesAdded: employeesToAdd.length,
        employeesRemoved: employeesToRemove.length
      }
    })
  } catch (error) {
    console.error('[API] Unexpected error in POST /api/cases/[id]/assign:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cases/[id]/assign
 * Get current case assignments
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
    const caseId = params.id

    const supabase = getSupabaseClient()

    // Fetch the case
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, case_number, organization_id')
      .eq('id', caseId)
      .single()

    if (caseError || !caseData) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (role === 'ADMIN' && caseData.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Forbidden: Case not in your organization' },
        { status: 403 }
      )
    } else if (role === 'MANAGER') {
      // Manager can only view assignments for cases they're assigned to
      const { data: managerAssignment } = await supabase
        .from('case_assignments')
        .select('id')
        .eq('case_id', caseId)
        .eq('user_id', userId)
        .single()

      if (!managerAssignment) {
        return NextResponse.json(
          { error: 'Forbidden: Case not assigned to you' },
          { status: 403 }
        )
      }
    }

    // Fetch assignments
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
          team:teams(
            id,
            name
          )
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

    // Separate managers and employees
    const managers = assignments?.filter((a: any) => a.user?.role === 'MANAGER') || []
    const employees = assignments?.filter((a: any) => a.user?.role === 'EMPLOYEE') || []

    return NextResponse.json({ 
      assignments: assignments || [],
      managers,
      employees,
      summary: {
        totalAssignments: assignments?.length || 0,
        managersCount: managers.length,
        employeesCount: employees.length
      }
    })
  } catch (error) {
    console.error('[API] Unexpected error in GET /api/cases/[id]/assign:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
