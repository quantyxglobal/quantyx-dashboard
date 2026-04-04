'use server'

import { auth, signOut } from '@/auth'
import { SupabaseDB, getSupabaseClient } from '@/lib/supabase-db'
import bcrypt from 'bcryptjs'
import { changePasswordSchema } from '@/types/password'

/**
 * Server action for users to change their own password
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8
 */
export async function changeOwnPassword(formData: FormData) {
  // Requirement 1.1: Verify user is authenticated
  const session = await auth()
  
  if (!session?.user?.id) {
    return { error: 'Unauthorized', status: 401 }
  }
  
  // Requirement 1.4: Validate input against complexity rules
  const validation = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword')
  })
  
  if (!validation.success) {
    return { 
      error: validation.error.issues?.[0]?.message || 'Invalid input', 
      status: 400 
    }
  }
  
  const { currentPassword, newPassword } = validation.data
  
  try {
    // Get user from database
    const user = await SupabaseDB.getUserById(session.user.id) as any
    
    if (!user) {
      return { error: 'User not found', status: 404 }
    }
    
    if (!user.password_hash) {
      return { error: 'No password set for this account', status: 400 }
    }
    
    // Requirement 1.2: Verify current password matches stored hash
    const isValid = await bcrypt.compare(currentPassword, user.password_hash)
    
    if (!isValid) {
      // Log failed password change attempt
      await SupabaseDB.createAuditLog({
        action: 'UPDATE',
        entity_type: 'user',
        entity_id: session.user.id,
        user_id: session.user.id,
        organization_id: user.organization_id || '',
        old_values: { password_change_attempt: 'failed', reason: 'Invalid current password' }
      })
      return { error: 'Current password is incorrect', status: 400 }
    }
    
    // Requirement 1.5: Hash new password using bcrypt with 10 rounds
    const newPasswordHash = await bcrypt.hash(newPassword, 10)
    
    // Requirement 1.6: Store new password hash in database
    await SupabaseDB.updateUserPassword(session.user.id, newPasswordHash)
    
    // Log successful password change
    await SupabaseDB.createAuditLog({
      action: 'UPDATE',
      entity_type: 'user',
      entity_id: session.user.id,
      user_id: session.user.id,
      organization_id: user.organization_id || '',
      new_values: { password_changed: true, changed_by: 'self' }
    })
    
    // Requirement 1.7: Invalidate user's session
    await signOut({ redirect: false })
    
    // Requirement 1.8: Return success message (redirect handled by client)
    return { success: true, message: 'Password changed successfully' }
  } catch (error) {
    // Requirement 8.2: Log technical details server-side
    console.error('Change password error:', error)
    
    // Requirement 8.4: Return generic error message without sensitive information
    // Handle specific database errors with generic user-facing messages
    if (error instanceof Error) {
      // Database connection errors
      if (error.message.includes('connect') || error.message.includes('ECONNREFUSED')) {
        return { error: 'Service temporarily unavailable. Please try again later.', status: 500 }
      }
      
      // Database timeout errors
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        return { error: 'Request timed out. Please try again.', status: 500 }
      }
      
      // Constraint violation errors (shouldn't happen in password change, but handle defensively)
      if (error.message.includes('constraint') || error.message.includes('unique')) {
        return { error: 'An error occurred. Please try again.', status: 500 }
      }
    }
    
    // Generic fallback for any other errors
    return { error: 'Failed to change password. Please try again.', status: 500 }
  }
}
