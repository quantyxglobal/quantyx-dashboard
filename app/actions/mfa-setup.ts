'use server'

import { auth } from '@/auth'
import { MFAService } from '@/lib/mfa-service'
import { SupabaseDB } from '@/lib/supabase-db'

/**
 * Generate MFA secret and QR code for user
 */
export async function generateMFASetup() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Unauthorized' }
  }

  try {
    const user = await SupabaseDB.getUserById(session.user.id)
    if (!user) {
      return { error: 'User not found' }
    }

    // Generate secret and QR code
    const { secret, qrCode, otpauthUrl } = await MFAService.generateMFASecret(
      user.id,
      user.email
    )

    // Generate backup codes
    const backupCodes = MFAService.generateBackupCodes()

    return {
      success: true,
      secret,
      qrCode,
      otpauthUrl,
      backupCodes
    }
  } catch (error) {
    console.error('[MFA_SETUP] Error:', error)
    return { error: 'Failed to generate MFA setup' }
  }
}

/**
 * Verify MFA token and enable MFA
 */
export async function enableMFA(secret: string, token: string, backupCodes: string[]) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Unauthorized' }
  }

  try {
    console.log('[MFA_ENABLE] Verifying token for user:', session.user.id)
    console.log('[MFA_ENABLE] Token length:', token.length)
    console.log('[MFA_ENABLE] Secret length:', secret.length)
    
    // Verify the token
    const isValid = MFAService.verifyToken(secret, token)
    
    console.log('[MFA_ENABLE] Token verification result:', isValid)
    
    if (!isValid) {
      return { 
        error: 'Invalid verification code. Please make sure you:\n1. Scanned the NEW QR code shown above (not an old one)\n2. Added it as a NEW account in your authenticator app\n3. Are entering the current 6-digit code from that NEW account' 
      }
    }

    // Enable MFA
    await MFAService.enableMFA(session.user.id, secret, backupCodes)

    return { success: true, message: 'MFA enabled successfully' }
  } catch (error) {
    console.error('[MFA_ENABLE] Error:', error)
    return { error: 'Failed to enable MFA' }
  }
}

/**
 * Disable MFA for user
 */
export async function disableMFA(password: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Unauthorized' }
  }

  try {
    const user = await SupabaseDB.getUserById(session.user.id)
    if (!user) {
      return { error: 'User not found' }
    }

    // Verify password before disabling MFA
    const bcrypt = await import('bcryptjs')
    const isValid = await bcrypt.compare(password, user.password_hash)
    
    if (!isValid) {
      return { error: 'Invalid password' }
    }

    // Disable MFA
    await MFAService.disableMFA(session.user.id)

    return { success: true, message: 'MFA disabled successfully' }
  } catch (error) {
    console.error('[MFA_DISABLE] Error:', error)
    return { error: 'Failed to disable MFA' }
  }
}
