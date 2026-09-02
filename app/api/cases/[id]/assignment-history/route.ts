import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-db'
import { auth } from '@/auth'

/**
 * GET /api/cases/[id]/assignment-history
 * Get assignment history for a specific case
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
    if (role === 'SUPER_ADMIN') {
      // Super admin can view any case's history
    } else if (role === 'ADMIN') {
      // Admin can only view history for cases in their organization
      if (caseData.organization_id !== organizationId) {
        return NextResponse.json(
          { error: 'Forbidden: Case not in your organization' },
          { status: 403 }
        )
      }
    } else if (role === 'MANAGER') {
      // Manager can only view history for cases they're assigned to
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
    } else {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const action = searchParams.get('action') // Filter by action type

    // Build query
    let query = supabase
      .from('case_assignment_history')
      .select(`
        id,
        action,
        assigned_at,
        metadata,
        assigned_by:users!case_assignment_history_assigned_by_id_fkey(
          id,
          first_name,
          last_name,
          email,
          role
        ),
        assigned_to:users!case_assignment_history_assigned_to_id_fkey(
          id,
          first_name,
          last_name,
          email,
          role,
          avatar_url
        )
      `)
      .eq('case_id', caseId)
      .order('assigned_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (action && ['assigned', 'unassigned', 'reassigned'].includes(action)) {
      query = query.eq('action', action)
    }

    const { data: history, error: historyError } = await query

    if (historyError) {
      console.error('[API] Error fetching assignment history:', historyError)
      return NextResponse.json(
        { error: 'Failed to fetch assignment history', details: historyError.message },
        { status: 500 }
      )
    }

    // Get total count
    const { count, error: countError } = await supabase
      .from('case_assignment_history')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', caseId)

    if (countError) {
      console.error('[API] Error counting assignment history:', countError)
    }

    return NextResponse.json({ 
      history: history || [],
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: count ? (offset + limit) < count : false
      }
    })
  } catch (error) {
    console.error('[API] Unexpected error in GET /api/cases/[id]/assignment-history:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
