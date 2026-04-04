'use server'

import { SupabaseDB } from '@/lib/supabase-db'
import bcrypt from 'bcryptjs'

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate password
    if (newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long' }
    }

    // Get and validate token
    const resetToken = await SupabaseDB.getPasswordResetToken(token)
    
    if (!resetToken) {
      return { success: false, error: 'Invalid or expired reset token' }
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Update user password
    await SupabaseDB.updateUserPassword(resetToken.user_id, hashedPassword)

    // Delete the used token
    await SupabaseDB.deletePasswordResetToken(token)

    // Log the password change
    await SupabaseDB.createAuditLog({
      action: 'UPDATE',
      entity_type: 'user',
      entity_id: resetToken.user_id,
      user_id: resetToken.user_id,
      organization_id: null,
      new_values: { password_reset: true }
    })

    console.log(`[PASSWORD_RESET] Password successfully reset for user: ${resetToken.user_id}`)
    return { success: true }

  } catch (error) {
    console.error('[PASSWORD_RESET] Error:', error)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}
