import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-db'
import { auth } from '@/auth'

/**
 * PATCH /api/cases/[id]/status
 * Update case status with role-based restrictions
 * - DELIVERED status can only be set by ADMIN and SUPER_ADMIN
 * - MANAGER and EMPLOYEE can update other statuses for assigned cases
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

    const { role, organizationId, id: userId } = session.user as any
    const caseId = params.id

    // Allowed roles to update status
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE']
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions to update case status' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { status, reason } = body

    // Validate status
    const validStatuses = ['PENDING', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'DELIVERED', 'ON_HOLD']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') },
        { status: 400 }
      )
    }

    // DELIVERED status restriction: Only ADMIN and SUPER_ADMIN
    if (status === 'DELIVERED' && role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      return NextResponse.json(
        { 
          error: 'Forbidden: Only administrators can mark cases as delivered',
          restriction: 'DELIVERED status is restricted to ADMIN and SUPER_ADMIN roles'
        },
        { status: 403 }
      )
    }

    const supabase = getSupabaseClient()

    // Fetch the case
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, case_number, status as current_status, organization_id')
      .eq('id', caseId)
      .single()

    if (caseError || !caseData) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      )
    }

    // Check permissions based on role
    if (role === 'ADMIN') {
      // Admin can only update cases in their organization
      if (caseData.organization_id !== organizationId) {
        return NextResponse.json(
          { error: 'Forbidden: Case not in your organization' },
          { status: 403 }
        )
      }
    } else if (role === 'MANAGER' || role === 'EMPLOYEE') {
      // Manager and Employee must be assigned to the case
      const { data: assignment } = await supabase
        .from('case_assignments')
        .select('id')
        .eq('case_id', caseId)
        .eq('user_id', userId)
        .single()

      if (!assignment) {
        return NextResponse.json(
          { error: 'Forbidden: Case not assigned to you' },
          { status: 403 }
        )
      }
    }

    // Check if status is actually changing
    if (caseData.current_status === status) {
      return NextResponse.json(
        { 
          message: 'Status unchanged',
          case: caseData 
        }
      )
    }

    // Update the case status
    const { data: updatedCase, error: updateError } = await supabase
      .from('cases')
      .update({ 
        status,
        updated_at: new Date().toISOString(),
        ...(status === 'COMPLETED' && { completed_at: new Date().toISOString() }),
        ...(status === 'DELIVERED' && { delivered_at: new Date().toISOString() }),
        ...(status === 'IN_PROGRESS' && !caseData.started_at && { started_at: new Date().toISOString() })
      })
      .eq('id', caseId)
      .select()
      .single()

    if (updateError) {
      console.error('[API] Error updating case status:', updateError)
      return NextResponse.json(
        { error: 'Failed to update case status', details: updateError.message },
        { status: 500 }
      )
    }

    // Log status change in history
    const { error: historyError } = await supabase
      .from('case_status_history')
      .insert({
        case_id: caseId,
        from_status: caseData.current_status,
        to_status: status,
        reason: reason || null,
        changed_by_id: userId
      })

    if (historyError) {
      console.error('[API] Error logging status history:', historyError)
      // Don't fail the request if history logging fails
    }

    // Create audit log
    await supabase
      .from('audit_logs')
      .insert({
        action: 'STATUS_CHANGE',
        entity_type: 'case',
        entity_id: caseId,
        user_id: userId,
        organization_id: caseData.organization_id,
        old_values: { status: caseData.current_status },
        new_values: { status },
        description: `Changed case ${caseData.case_number} status from ${caseData.current_status} to ${status}${reason ? `: ${reason}` : ''}`
      })

    return NextResponse.json({ 
      success: true,
      message: 'Case status updated successfully',
      case: updatedCase,
      change: {
        from: caseData.current_status,
        to: status,
        changedBy: {
          id: userId,
          role
        }
      }
    })
  } catch (error) {
    console.error('[API] Unexpected error in PATCH /api/cases/[id]/status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cases/[id]/status
 * Get case status history
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
      .select('id, case_number, status, organization_id')
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
    } else if (role === 'MANAGER' || role === 'EMPLOYEE') {
      const { data: assignment } = await supabase
        .from('case_assignments')
        .select('id')
        .eq('case_id', caseId)
        .eq('user_id', userId)
        .single()

      if (!assignment) {
        return NextResponse.json(
          { error: 'Forbidden: Case not assigned to you' },
          { status: 403 }
        )
      }
    }

    // Fetch status history
    const { data: history, error: historyError } = await supabase
      .from('case_status_history')
      .select(`
        id,
        from_status,
        to_status,
        reason,
        changed_at,
        changed_by:users(
          id,
          first_name,
          last_name,
          email,
          role
        )
      `)
      .eq('case_id', caseId)
      .order('changed_at', { ascending: false })

    if (historyError) {
      console.error('[API] Error fetching status history:', historyError)
      return NextResponse.json(
        { error: 'Failed to fetch status history', details: historyError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      currentStatus: caseData.status,
      history: history || [],
      caseNumber: caseData.case_number
    })
  } catch (error) {
    console.error('[API] Unexpected error in GET /api/cases/[id]/status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
