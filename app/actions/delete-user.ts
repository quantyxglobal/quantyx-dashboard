'use server'

import { auth } from '@/auth'
import { SupabaseDB } from '@/lib/supabase-db'
import { logAuditAction } from '@/lib/audit-log'
import { revalidatePath } from 'next/navigation'

export async function deleteUser(userId: string) {
  try {
    const session = await auth()
    
    // Only SUPER_ADMIN can delete users
    if (!session || session.user.role !== 'SUPER_ADMIN') {
      return { 
        success: false, 
        error: 'Unauthorized: Only Super Admins can delete users' 
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
    const userToDelete = await SupabaseDB.getUser(userId)

    if (!userToDelete) {
      return { 
        success: false, 
        error: 'User not found' 
      }
    }

    // Get organization details if user has one
    let organizationName = 'Unknown'
    if (userToDelete.organization_id) {
      const org = await SupabaseDB.getOrganization(userToDelete.organization_id)
      if (org) {
        organizationName = org.name
      }
    }

    // Delete user using Supabase
    await SupabaseDB.deleteUser(userId)

    // Log the deletion action
    await logAuditAction({
      userId: session.user.id,
      action: 'user_deleted',
      details: `Super Admin deleted user: ${userToDelete.first_name} ${userToDelete.last_name} (${userToDelete.email}) from organization: ${organizationName}`,
      entityType: 'user'
    })

    // Revalidate pages
    revalidatePath('/superadmin/users')
    revalidatePath('/admin/users')

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
