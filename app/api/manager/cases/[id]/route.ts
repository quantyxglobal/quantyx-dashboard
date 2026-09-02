import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { SupabaseDB } from '@/lib/supabase-db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify manager role
    const user = await SupabaseDB.getUserById(session.user.id)
    if (user.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Forbidden - Manager access required' },
        { status: 403 }
      )
    }

    const { id: caseId } = await params

    // Get case details
    const caseData = await SupabaseDB.getCaseById(caseId)
    if (!caseData) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      )
    }

    // Verify manager has access to this case (must be assigned to the case)
    const assignments = await SupabaseDB.getCaseAssignments(caseId)
    const isAssigned = assignments.some((a: any) => a.user_id === session.user.id)

    if (!isAssigned) {
      return NextResponse.json(
        { error: 'Forbidden - You do not have access to this case' },
        { status: 403 }
      )
    }

    // Return case details
    return NextResponse.json({
      id: caseData.id,
      case_number: caseData.case_number,
      title: caseData.title,
      status: caseData.status,
      priority: caseData.priority,
      client_name: caseData.client_name,
      client_email: caseData.client_email,
      created_at: caseData.created_at,
      description: caseData.description,
      special_instructions: caseData.special_instructions,
      organization: caseData.organization
    })
  } catch (error) {
    console.error('[MANAGER_CASE_DETAIL] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
