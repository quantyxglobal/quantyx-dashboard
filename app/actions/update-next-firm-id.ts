'use server'

import { auth } from '@/auth'
import { SupabaseDB } from '@/lib/supabase-db'
import { revalidatePath } from 'next/cache'

export async function updateNextFirmId(nextFirmId: number) {
  const session = await auth()

  // Only superadmins can update system settings
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return {
      success: false,
      error: 'Unauthorized: Super Admin access required'
    }
  }

  try {
    // Validate input
    if (!Number.isInteger(nextFirmId) || nextFirmId < 1) {
      return {
        success: false,
        error: 'Firm ID must be a positive integer'
      }
    }

    // Update the setting
    await SupabaseDB.updateSystemSetting(
      'next_firm_id',
      nextFirmId.toString(),
      'The next firm ID to be assigned when a new organization is created'
    )

    // Log audit action (superadmin doesn't have organization_id, so use null)
    await SupabaseDB.createAuditLog({
      action: 'UPDATE',
      entity_type: 'system_settings',
      entity_id: 'next_firm_id',
      user_id: session.user.id,
      organization_id: session.user.organizationId || null,
      old_values: null,
      new_values: { next_firm_id: nextFirmId }
    })

    // Revalidate the settings page
    revalidatePath('/superadmin/settings')

    return {
      success: true,
      message: `Next firm ID updated to ${nextFirmId}`
    }
  } catch (error) {
    console.error('[UPDATE_NEXT_FIRM_ID] Error:', error)
    return {
      success: false,
      error: 'Failed to update next firm ID'
    }
  }
}
