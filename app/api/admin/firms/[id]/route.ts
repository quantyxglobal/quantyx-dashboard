import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { SupabaseDB } from '@/lib/supabase-db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { name, address_line1, address_line2, city, state, country } = body

    // Update organization
    const { data, error } = await SupabaseDB.getSupabaseClient()
      .from('organizations')
      .update({
        display_name: name,
        name: name,
        address_line1,
        address_line2,
        city,
        state,
        country,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[UPDATE_FIRM] Error:', error)
      return NextResponse.json(
        { error: 'Failed to update firm' },
        { status: 500 }
      )
    }

    // Log audit action
    await SupabaseDB.createAuditLog({
      action: 'UPDATE',
      entity_type: 'organization',
      entity_id: id,
      user_id: session.user.id,
      organization_id: null,
      old_values: null,
      new_values: { name, address_line1, address_line2, city, state, country }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[UPDATE_FIRM] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
