'use server'

import { auth } from '@/auth'
import { SupabaseDB, getSupabaseClient } from '@/lib/supabase-db'

/**
 * Enable MFA requirement for a specific user (superadmin only)
 */
export async function enableMFAForUser(userId: string) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return { error: 'Unauthorized' }
  }

  const currentUser = await SupabaseDB.getUserById(session.user.id)
  
  if ((currentUser as any)?.role !== 'SUPER_ADMIN') {
    return { error: 'Unauthorized: Super Admin access required' }
  }

  try {
    const supabase = getSupabaseClient()
    
    // Set MFA setup required flag
    await supabase
      .from('users')
      .update({
        mfa_setup_required: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    // Log audit action
    await SupabaseDB.createAuditLog({
      action: 'UPDATE',
      entity_type: 'user',
      entity_id: userId,
      user_id: session.user.id,
      organization_id: null,
      new_values: { mfa_setup_required: true, action: 'MFA requirement enabled by superadmin' }
    })

    return { success: true, message: 'MFA requirement enabled for user' }
  } catch (error) {
    console.error('[ENABLE_MFA_FOR_USER] Error:', error)
    return { error: 'Failed to enable MFA requirement' }
  }
}

/**
 * Disable MFA for a specific user (superadmin only)
 */
export async function disableMFAForUser(userId: string) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return { error: 'Unauthorized' }
  }

  const currentUser = await SupabaseDB.getUserById(session.user.id)
  
  if ((currentUser as any)?.role !== 'SUPER_ADMIN') {
    return { error: 'Unauthorized: Super Admin access required' }
  }

  try {
    const supabase = getSupabaseClient()
    
    // Disable MFA completely
    await supabase
      .from('users')
      .update({
        mfa_enabled: false,
        mfa_setup_required: false,
        mfa_secret: null,
        mfa_backup_codes: null,
        mfa_enrolled_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    // Log audit action
    await SupabaseDB.createAuditLog({
      action: 'UPDATE',
      entity_type: 'user',
      entity_id: userId,
      user_id: session.user.id,
      organization_id: null,
      new_values: { mfa_enabled: false, action: 'MFA disabled by superadmin' }
    })

    return { success: true, message: 'MFA disabled for user' }
  } catch (error) {
    console.error('[DISABLE_MFA_FOR_USER] Error:', error)
    return { error: 'Failed to disable MFA' }
  }
}

/**
 * Enable MFA requirement for all users of specific roles (superadmin only)
 */
export async function enableMFAForAllUsers(roles: string[]) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return { error: 'Unauthorized' }
  }

  const currentUser = await SupabaseDB.getUserById(session.user.id)
  
  if ((currentUser as any)?.role !== 'SUPER_ADMIN') {
    return { error: 'Unauthorized: Super Admin access required' }
  }

  try {
    const supabase = getSupabaseClient()
    
    // Enable MFA requirement for all users with specified roles
    const { data, error } = await supabase
      .from('users')
      .update({
        mfa_setup_required: true,
        updated_at: new Date().toISOString()
      })
      .in('role', roles)
      .select('id')

    if (error) throw error

    const affectedCount = data?.length || 0

    // Log audit action
    await SupabaseDB.createAuditLog({
      action: 'UPDATE',
      entity_type: 'user',
      entity_id: 'bulk',
      user_id: session.user.id,
      organization_id: null,
      new_values: { 
        affected_count: affectedCount,
        roles: roles,
        action: `MFA requirement enabled for ${affectedCount} users with roles: ${roles.join(', ')}`
      }
    })

    return { 
      success: true, 
      message: `MFA requirement enabled for ${affectedCount} user(s)`,
      affectedCount 
    }
  } catch (error) {
    console.error('[ENABLE_MFA_FOR_ALL] Error:', error)
    return { error: 'Failed to enable MFA requirement for users' }
  }
}

/**
 * Disable MFA for all users of specific roles (superadmin only)
 */
export async function disableMFAForAllUsers(roles: string[]) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return { error: 'Unauthorized' }
  }

  const currentUser = await SupabaseDB.getUserById(session.user.id)
  
  if ((currentUser as any)?.role !== 'SUPER_ADMIN') {
    return { error: 'Unauthorized: Super Admin access required' }
  }

  try {
    const supabase = getSupabaseClient()
    
    // Disable MFA for all users with specified roles
    const { data, error } = await supabase
      .from('users')
      .update({
        mfa_enabled: false,
        mfa_setup_required: false,
        mfa_secret: null,
        mfa_backup_codes: null,
        mfa_enrolled_at: null,
        updated_at: new Date().toISOString()
      })
      .in('role', roles)
      .select('id')

    if (error) throw error

    const affectedCount = data?.length || 0

    // Log audit action
    await SupabaseDB.createAuditLog({
      action: 'UPDATE',
      entity_type: 'user',
      entity_id: 'bulk',
      user_id: session.user.id,
      organization_id: null,
      new_values: {
        affected_count: affectedCount,
        roles: roles,
        action: `MFA disabled for ${affectedCount} users with roles: ${roles.join(', ')}`
      }
    })

    return { 
      success: true, 
      message: `MFA disabled for ${affectedCount} user(s)`,
      affectedCount 
    }
  } catch (error) {
    console.error('[DISABLE_MFA_FOR_ALL] Error:', error)
    return { error: 'Failed to disable MFA for users' }
  }
}

/**
 * Get MFA status for a user
 */
export async function getUserMFAStatus(userId: string) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return { error: 'Unauthorized' }
  }

  const currentUser = await SupabaseDB.getUserById(session.user.id)
  
  if ((currentUser as any)?.role !== 'SUPER_ADMIN') {
    return { error: 'Unauthorized: Super Admin access required' }
  }

  try {
    const user = await SupabaseDB.getUserById(userId)
    
    if (!user) {
      return { error: 'User not found' }
    }

    return {
      success: true,
      mfaEnabled: (user as any).mfa_enabled || false,
      mfaSetupRequired: (user as any).mfa_setup_required || false,
      mfaEnrolledAt: (user as any).mfa_enrolled_at || null
    }
  } catch (error) {
    console.error('[GET_USER_MFA_STATUS] Error:', error)
    return { error: 'Failed to get MFA status' }
  }
}
