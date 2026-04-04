import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import crypto from 'crypto'
import { SupabaseDB, getSupabaseClient } from './supabase-db'

export class MFAService {
  /**
   * Generate a new MFA secret for a user
   * Returns secret and QR code data URL
   */
  static async generateMFASecret(userId: string, userEmail: string) {
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Quantix Global (${userEmail})`,
      issuer: 'Quantix Global Med-Legal',
      length: 32 // 160 bits of entropy
    })

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!)

    return {
      secret: secret.base32, // Store this in database
      qrCode: qrCodeDataUrl,  // Display this to user
      otpauthUrl: secret.otpauth_url // For manual entry
    }
  }

  /**
   * Verify a TOTP token
   */
  static verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 1 // Allow 1 time step before/after (30 seconds)
    })
  }

  /**
   * Generate backup codes for account recovery
   * Returns array of 10 backup codes
   */
  static generateBackupCodes(): string[] {
    const codes: string[] = []
    for (let i = 0; i < 10; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase()
      codes.push(code)
    }
    return codes
  }

  /**
   * Hash backup codes before storing
   */
  static async hashBackupCodes(codes: string[]): Promise<string[]> {
    const bcrypt = await import('bcryptjs')
    const hashedCodes = await Promise.all(
      codes.map(code => bcrypt.hash(code, 10))
    )
    return hashedCodes
  }

  /**
   * Verify a backup code
   */
  static async verifyBackupCode(
    code: string,
    hashedCodes: string[]
  ): Promise<{ valid: boolean; codeIndex: number }> {
    const bcrypt = await import('bcryptjs')
    
    for (let i = 0; i < hashedCodes.length; i++) {
      const isValid = await bcrypt.compare(code, hashedCodes[i])
      if (isValid) {
        return { valid: true, codeIndex: i }
      }
    }
    
    return { valid: false, codeIndex: -1 }
  }

  /**
   * Enable MFA for a user
   */
  static async enableMFA(
    userId: string,
    secret: string,
    backupCodes: string[]
  ): Promise<void> {
    const supabase = getSupabaseClient()
    
    // Hash backup codes
    const hashedCodes = await this.hashBackupCodes(backupCodes)
    
    // Update user record
    await supabase
      .from('users')
      .update({
        mfa_enabled: true,
        mfa_secret: secret,
        mfa_backup_codes: hashedCodes,
        mfa_enrolled_at: new Date().toISOString()
      })
      .eq('id', userId)

    // Log MFA enablement
    await SupabaseDB.createAuditLog({
      user_id: userId,
      action: 'CREATE',
      entity_type: 'user',
      entity_id: userId,
      organization_id: null,
      new_values: { mfa_enabled: true, action: 'MFA enabled successfully' }
    })
  }

  /**
   * Disable MFA for a user
   */
  static async disableMFA(userId: string): Promise<void> {
    const supabase = getSupabaseClient()
    
    await supabase
      .from('users')
      .update({
        mfa_enabled: false,
        mfa_secret: null,
        mfa_backup_codes: null,
        mfa_enrolled_at: null
      })
      .eq('id', userId)

    // Log MFA disablement
    await SupabaseDB.createAuditLog({
      user_id: userId,
      action: 'DELETE',
      entity_type: 'user',
      entity_id: userId,
      organization_id: null,
      new_values: { mfa_enabled: false, action: 'MFA disabled' }
    })
  }

  /**
   * Remove a used backup code
   */
  static async removeBackupCode(
    userId: string,
    codeIndex: number
  ): Promise<void> {
    const user = await SupabaseDB.getUserById(userId)
    if (!user || !user.mfa_backup_codes) return

    const updatedCodes = user.mfa_backup_codes.filter(
      (_: any, index: number) => index !== codeIndex
    )

    const supabase = getSupabaseClient()
    await supabase
      .from('users')
      .update({ mfa_backup_codes: updatedCodes })
      .eq('id', userId)
  }
}
