'use server'

import { auth } from '@/auth'
import { SupabaseDB } from '@/lib/supabase-db'
import { revalidatePath } from 'next/cache'
import { S3Service } from '@/lib/s3-service'

/**
 * Delete a user (SUPERADMIN only)
 */
export async function deleteUser(userId: string) {
  const session = await auth()
  
  // Check if user is superadmin
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return { success: false, error: 'Unauthorized: Only superadmins can delete users' }
  }
  
  // Verify actual role from database to ensure it's SUPER_ADMIN not just ADMIN
  const user = await SupabaseDB.getUserById(session.user.id)
  if (!user || user.role !== 'SUPER_ADMIN') {
    return { success: false, error: 'Unauthorized: Only superadmins can delete users' }
  }

  try {
    await SupabaseDB.deleteUser(userId)
    
    // Log the action
    await SupabaseDB.createAuditLog({
      action: 'DELETE',
      entity_type: 'User',
      entity_id: userId,
      user_id: session.user.id,
      organization_id: session.user.organization_id || '',
      old_values: { userId }
    })

    revalidatePath('/admin/users')
    revalidatePath('/superadmin/users')
    return { success: true }
  } catch (error) {
    console.error('Error deleting user:', error)
    return { success: false, error: 'Failed to delete user' }
  }
}

/**
 * Delete a case and all related data (SUPERADMIN only)
 */
export async function deleteCase(caseId: string) {
  const session = await auth()
  
  // Check if user is superadmin
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return { success: false, error: 'Unauthorized: Only superadmins can delete cases' }
  }
  
  // Verify actual role from database to ensure it's SUPER_ADMIN not just ADMIN
  const user = await SupabaseDB.getUserById(session.user.id)
  if (!user || user.role !== 'SUPER_ADMIN') {
    return { success: false, error: 'Unauthorized: Only superadmins can delete cases' }
  }

  try {
    // Get case files before deletion to clean up S3
    const files = await SupabaseDB.getFilesByCase(caseId)
    
    // Delete from database
    await SupabaseDB.deleteCase(caseId)
    
    // Delete files from S3
    for (const file of files) {
      try {
        await S3Service.deleteFile(file.s3_key)
      } catch (s3Error) {
        console.error(`Failed to delete S3 file ${file.s3_key}:`, s3Error)
        // Continue with other files even if one fails
      }
    }
    
    // Log the action
    await SupabaseDB.createAuditLog({
      action: 'DELETE',
      entity_type: 'Case',
      entity_id: caseId,
      user_id: session.user.id,
      organization_id: session.user.organization_id || '',
      old_values: { caseId, filesDeleted: files.length }
    })

    revalidatePath('/admin')
    revalidatePath('/superadmin')
    return { success: true }
  } catch (error) {
    console.error('Error deleting case:', error)
    return { success: false, error: 'Failed to delete case' }
  }
}

/**
 * Delete an organization/firm and all related data (SUPERADMIN only)
 */
export async function deleteOrganization(organizationId: string) {
  const session = await auth()
  
  // Check if user is superadmin
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return { success: false, error: 'Unauthorized: Only superadmins can delete organizations' }
  }
  
  // Verify actual role from database to ensure it's SUPER_ADMIN not just ADMIN
  const user = await SupabaseDB.getUserById(session.user.id)
  if (!user || user.role !== 'SUPER_ADMIN') {
    return { success: false, error: 'Unauthorized: Only superadmins can delete organizations' }
  }

  try {
    // Get all cases for this organization to clean up S3 files
    const cases = await SupabaseDB.getCasesByOrganization(organizationId, 10000)
    
    // Delete all files from S3
    for (const caseItem of cases) {
      const files = await SupabaseDB.getFilesByCase(caseItem.id)
      for (const file of files) {
        try {
          await S3Service.deleteFile(file.s3_key)
        } catch (s3Error) {
          console.error(`Failed to delete S3 file ${file.s3_key}:`, s3Error)
          // Continue with other files even if one fails
        }
      }
    }
    
    // Delete from database (cascades to users, cases, files, etc.)
    await SupabaseDB.deleteOrganization(organizationId)
    
    // Log the action
    await SupabaseDB.createAuditLog({
      action: 'DELETE',
      entity_type: 'Organization',
      entity_id: organizationId,
      user_id: session.user.id,
      organization_id: session.user.organization_id || '',
      old_values: { organizationId, casesDeleted: cases.length }
    })

    revalidatePath('/admin/firms')
    revalidatePath('/superadmin/firms')
    return { success: true }
  } catch (error) {
    console.error('Error deleting organization:', error)
    return { success: false, error: 'Failed to delete organization' }
  }
}
