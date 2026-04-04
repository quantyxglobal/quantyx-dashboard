'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { resetPasswordSchema } from '@/types/password'
import { logPasswordChange } from '@/lib/audit-log'
import { revalidatePath } from 'next/cache'

/**
 * Server action for admin users to reset client passwords
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3
 */
export async function resetClientPassword(formData: FormData) {
  // Requirement 3.2: Verify user is authenticated and has admin role
  const session = await auth()
  
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { error: 'Access denied', status: 403 }
  }
  
  // Requirement 3.4: Validate input against complexity rules
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
    // Requirement 3.3: Get target user from database
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    })
    
    if (!targetUser) {
      return { error: 'User not found', status: 404 }
    }
    
    // Requirement 4.1, 4.2: Prevent admin-to-admin password resets
    if (targetUser.role === 'ADMIN') {
      await logPasswordChange(
        targetUserId, 
        'admin_reset_failed', 
        'Cannot reset admin password',
        session.user.id
      )
      return { 
        error: 'Admin passwords cannot be reset by other admins', 
        status: 403 
      }
    }
    
    // Requirement 3.5: Hash new password using bcrypt with 10 rounds
    const newPasswordHash = await bcrypt.hash(newPassword, 10)
    
    // Requirement 3.6: Update password hash in database for target user
    await prisma.user.update({
      where: { id: targetUserId },
      data: { password_hash: newPasswordHash }
    })
    
    // Requirement 3.8, 7.2: Log successful password reset with admin ID and target user ID
    await logPasswordChange(
      targetUserId, 
      'admin_reset_success',
      undefined,
      session.user.id
    )
    
    // Requirement 3.7: Note - NextAuth v5 with JWT doesn't have built-in session invalidation
    // Sessions will expire naturally or on next auth check
    
    // Requirement 4.3: Revalidate admin users page
    revalidatePath('/admin/users')
    
    return { 
      success: true, 
      message: `Password reset successfully for ${targetUser.first_name} ${targetUser.last_name}` 
    }
  } catch (error) {
    // Requirement 8.2: Log technical details server-side
    console.error('Reset password error:', error)
    
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
      
      // Constraint violation errors
      if (error.message.includes('constraint') || error.message.includes('unique')) {
        return { error: 'An error occurred. Please try again.', status: 500 }
      }
    }
    
    // Generic fallback for any other errors
    return { error: 'Failed to reset password. Please try again.', status: 500 }
  }
}
