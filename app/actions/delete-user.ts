'use server'

 '@/auth'
import { prisma } from '@/lib/prisma'
import { logAuditAction } from '@/lib/audit-log'
 'next/navigation'

export async function deleteUser(_userId: string) {
  try {
    const session = await auth()
    
    // Verify admin authorization
    if (!session || session.user.role !== 'admin') {
      return { 
        _success: false, 
        _error: '_Unauthorized: Admin access required' 
      }
    }

    // Prevent admin from deleting themselves
    if (session.user.id === userId) {
      return { 
        success: false, 
        error: 'Cannot delete your own account' 
      }
    }

    // Get user details before deletion for audit log
    const userToDelete = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true }
    })

    if (!userToDelete) {
      return { 
        success: false, 
        error: 'User not found' 
      }
    }

    // Prevent deletion of other admin accounts
    if (userToDelete.role === 'ADMIN') {
      return { 
        success: false, 
        error: 'Cannot delete admin accounts' 
      }
    }

    // Delete user in a transaction to handle related data
    await prisma.$transaction(async (tx) => {
      // Delete related audit logs
      await tx.auditLog.deleteMany({
        where: { user_id: userId }
      })

      // Finally delete the user
      await tx.user.delete({
        where: { id: userId }
      })
    })

    // Log the deletion action
    await logAuditAction({
      userId: session.user.id,
      action: 'user_deleted',
      details: `Admin deleted user: ${userToDelete.first_name} ${userToDelete.last_name} (${userToDelete.email}) from organization: ${userToDelete.organization?.name || 'Unknown'}`,
      entityType: 'user'
    })

    return { 
      success: true, 
      message: `User ${userToDelete.first_name} ${userToDelete.last_name} has been successfully deleted` 
    }

  } catch (error) {
    console.error('Error deleting user:', error)
    return { 
      success: false, 
      error: 'Failed to delete user. Please try again.' 
    }
  }
}