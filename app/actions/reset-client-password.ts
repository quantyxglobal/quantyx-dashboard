'use server'

import { auth } from '@/auth'
import { SupabaseDB } from '@/lib/supabase-db'
import bcrypt from 'bcryptjs'
import { resetPasswordSchema } from '@/types/password'
import { logPasswordChange } from '@/lib/audit-log'
import { revalidatePath } from 'next/cache'

/**
 * Server action for SUPER_ADMIN to reset any user's password
 * Regular ADMINs cannot reset passwords
 * All users can change their own passwords through settings
 */
export async function resetClientPassword(formData: FormData) {
  // Only SUPER_ADMIN can reset passwords for other users
  const session = await auth()
  
  if (!session?.user?.id) {
    return { error: 'Access denied - Not authenticated', status: 403 }
  }

  // Only SUPER_ADMIN can use this function
  if (session.user.role !== 'SUPER_ADMIN') {
    return { error: 'Access denied - Only Super Admins can reset passwords for other users', status: 403 }
  }
  
  // Validate input against complexity rules
  const validation = resetPasswordSchema.safeParse({
    targetUserId: formData.get('targetUserId'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword')
  })
  
  if (!validation.success) {
    return { 
      error: validation.error.issues?.[0]?.message || 'Invalid input', 
      status: 400 
    }
  }
  
  const { targetUserId, newPassword } = validation.data
  
  try {
    // Get target user from database using Supabase
    const targetUser = await SupabaseDB.getUser(targetUserId)
    
    if (!targetUser) {
      return { error: 'User not found', status: 404 }
    }
    
    // Prevent resetting own password through this function
    if (targetUserId === session.user.id) {
      return { 
        error: 'Cannot reset your own password through this function. Use the settings page instead.', 
        status: 403 
      }
    }
    
    // Hash new password using bcrypt with 10 rounds
    const newPasswordHash = await bcrypt.hash(newPassword, 10)
    
    // Update password hash in database for target user using Supabase
    await SupabaseDB.updateUserPassword(targetUserId, newPasswordHash)
    
    // Log successful password reset with admin ID and target user ID
    await logPasswordChange(
      targetUserId, 
      'superadmin_reset_success',
      `Password reset by SUPER_ADMIN ${session.user.email}`,
      session.user.id
    )
    
    // Revalidate pages
    revalidatePath('/admin/users')
    revalidatePath('/superadmin/users')
    
    return { 
      success: true, 
      message: `Password reset successfully for ${targetUser.first_name} ${targetUser.last_name}` 
    }
  } catch (error) {
    // Log technical details server-side
    console.error('Reset password error:', error)
    
    // Return generic error message without sensitive information
    if (error instanceof Error) {
      // Database connection errors
      if (error.message.includes('connect') || error.message.includes('ECONNREFUSED')) {
        return { error: 'Service temporarily unavailable. Please try again later.', status: 500 }
      }
      
      // Database timeout errors
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        return { error: 'Request timed out. Please try again.', status: 500 }
      }
      
      // Constraint violation errors
      if (error.message.includes('constraint') || error.message.includes('unique')) {
        return { error: 'An error occurred. Please try again.', status: 500 }
      }
    }
    
    // Generic fallback for any other errors
    return { error: 'Failed to reset password. Please try again.', status: 500 }
  }
}
