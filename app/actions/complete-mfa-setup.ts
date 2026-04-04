'use server'

import { auth } from '@/auth'
import { SupabaseDB } from '@/lib/supabase-db'

/**
 * Mark MFA setup as complete for the current user
 */
export async function completeMFASetup() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Unauthorized' }
  }

  try {
    // Clear the mfa_setup_required flag using SupabaseDB
    const user = await SupabaseDB.getUserById(session.user.id)
    if (!user) {
      return { error: 'User not found' }
    }

    // Update using raw query to avoid type issues
    await SupabaseDB.client
      .from('users')
      .update({ mfa_setup_required: false } as any)
      .eq('id', session.user.id)

    return { success: true }
  } catch (error) {
    console.error('[COMPLETE_MFA_SETUP] Error:', error)
    return { error: 'Failed to complete MFA setup' }
  }
}
