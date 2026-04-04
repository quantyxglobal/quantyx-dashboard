'use server'

import { MFAService } from '@/lib/mfa-service'
import { SupabaseDB, getSupabaseClient } from '@/lib/supabase-db'

/**
 * Check if user needs MFA verification
 * Returns true if MFA is enabled and last verification was more than 7 days ago
 */
export async function checkMFARequired(userId: string): Promise<boolean> {
  try {
    const user = await SupabaseDB.getUserById(userId) as any
    
    if (!user || !user.mfa_enabled) {
      return false
    }

    // If never verified, require MFA
    if (!user.mfa_last_verified_at) {
      return true
    }

    // Check if last verification was more than 7 days ago
    const lastVerified = new Date(user.mfa_last_verified_at)
    const now = new Date()
    const daysSinceVerification = (now.getTime() - lastVerified.getTime()) / (1000 * 60 * 60 * 24)
    
    console.log('[MFA_CHECK] Days since last verification:', daysSinceVerification)
    
    return daysSinceVerification >= 7
  } catch (error) {
    console.error('[MFA_CHECK] Error:', error)
    // On error, require MFA for safety
    return true
  }
}

/**
 * Verify MFA token during login
 */
export async function verifyMFAToken(userId: string, token: string) {
  try {
    const user = await SupabaseDB.getUserById(userId) as any
    
    if (!user || !user.mfa_enabled || !user.mfa_secret) {
      return { error: 'MFA not enabled for this user' }
    }

    // Try verifying as TOTP token
    const isValidToken = MFAService.verifyToken(user.mfa_secret, token)
    
    if (isValidToken) {
      // Update last verified timestamp
      const supabase = getSupabaseClient()
      await supabase
        .from('users')
        // @ts-ignore - mfa_last_verified_at column exists but not in generated types yet
        .update({ mfa_last_verified_at: new Date().toISOString() })
        .eq('id', userId)

      // Log successful verification
      await SupabaseDB.createAuditLog({
        user_id: userId,
        action: 'LOGIN',
        entity_type: 'user',
        entity_id: userId,
        organization_id: null,
        new_values: { action: 'MFA token verified successfully' }
      })
      
      return { success: true }
    }

    // Try verifying as backup code
    if (user.mfa_backup_codes && user.mfa_backup_codes.length > 0) {
      const { valid, codeIndex } = await MFAService.verifyBackupCode(
        token,
        user.mfa_backup_codes
      )
      
      if (valid) {
        // Remove used backup code
        await MFAService.removeBackupCode(userId, codeIndex)
        
        // Update last verified timestamp
        const supabase = getSupabaseClient()
        await supabase
          .from('users')
          // @ts-ignore - mfa_last_verified_at column exists but not in generated types yet
          .update({ mfa_last_verified_at: new Date().toISOString() })
          .eq('id', userId)
        
        // Log backup code usage
        await SupabaseDB.createAuditLog({
          user_id: userId,
          action: 'LOGIN',
          entity_type: 'user',
          entity_id: userId,
          organization_id: null,
          new_values: { 
            action: 'MFA backup code used',
            remaining_codes: user.mfa_backup_codes.length - 1
          }
        })
        
        return { 
          success: true, 
          backupCodeUsed: true,
          remainingCodes: user.mfa_backup_codes.length - 1
        }
      }
    }

    // Log failed verification
    await SupabaseDB.createAuditLog({
      user_id: userId,
      action: 'LOGIN',
      entity_type: 'user',
      entity_id: userId,
      organization_id: null,
      new_values: { action: 'MFA verification failed' }
    })

    return { error: 'Invalid verification code' }
  } catch (error) {
    console.error('[MFA_VERIFY] Error:', error)
    return { error: 'Verification failed' }
  }
}
