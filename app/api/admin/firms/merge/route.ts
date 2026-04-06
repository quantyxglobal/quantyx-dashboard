import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { SupabaseDB } from '@/lib/supabase-db'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { sourceFirmId, targetFirmId } = await request.json()

    if (!sourceFirmId || !targetFirmId) {
      return NextResponse.json(
        { error: 'Source and target firm IDs are required' },
        { status: 400 }
      )
    }

    if (sourceFirmId === targetFirmId) {
      return NextResponse.json(
        { error: 'Cannot merge a firm into itself' },
        { status: 400 }
      )
    }

    const supabase = SupabaseDB.getSupabaseClient()

    // Move all users from source to target
    const { error: usersError } = await supabase
      .from('users')
      .update({ organization_id: targetFirmId })
      .eq('organization_id', sourceFirmId)

    if (usersError) {
      console.error('[MERGE_FIRMS] Error moving users:', usersError)
      return NextResponse.json(
        { error: 'Failed to move users' },
        { status: 500 }
      )
    }

    // Move all cases from source to target
    const { error: casesError } = await supabase
      .from('cases')
      .update({ organization_id: targetFirmId })
      .eq('organization_id', sourceFirmId)

    if (casesError) {
      console.error('[MERGE_FIRMS] Error moving cases:', casesError)
      return NextResponse.json(
        { error: 'Failed to move cases' },
        { status: 500 }
      )
    }

    // Delete the source firm
    const { error: deleteError } = await supabase
      .from('organizations')
      .delete()
      .eq('id', sourceFirmId)

    if (deleteError) {
      console.error('[MERGE_FIRMS] Error deleting source firm:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete source firm' },
        { status: 500 }
      )
    }

    // Log audit action
    await SupabaseDB.createAuditLog({
      action: 'UPDATE',
      entity_type: 'organization',
      entity_id: targetFirmId,
      user_id: session.user.id,
      organization_id: null,
      old_values: null,
      new_values: { merged_from: sourceFirmId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[MERGE_FIRMS] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
