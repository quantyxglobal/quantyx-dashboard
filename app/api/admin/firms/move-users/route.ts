import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { SupabaseDB } from '@/lib/supabase-db'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { userIds, targetFirmId } = await request.json()

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'User IDs are required' },
        { status: 400 }
      )
    }

    if (!targetFirmId) {
      return NextResponse.json(
        { error: 'Target firm ID is required' },
        { status: 400 }
      )
    }

    const supabase = SupabaseDB.getSupabaseClient()

    // Move users to target firm
    const { error } = await supabase
      .from('users')
      .update({ organization_id: targetFirmId })
      .in('id', userIds)

    if (error) {
      console.error('[MOVE_USERS] Error:', error)
      return NextResponse.json(
        { error: 'Failed to move users' },
        { status: 500 }
      )
    }

    // Log audit action for each user
    for (const userId of userIds) {
      await SupabaseDB.createAuditLog({
        action: 'UPDATE',
        entity_type: 'user',
        entity_id: userId,
        user_id: session.user.id,
        organization_id: null,
        old_values: null,
        new_values: { moved_to_organization: targetFirmId }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[MOVE_USERS] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
