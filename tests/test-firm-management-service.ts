/**
 * Test-specific Firm Management Service
 * 
 * This service uses Supabase directly instead of Prisma to bypass RLS issues during testing.
 */

import { supabaseTestClient } from './supabase-test-client'
import bcrypt from 'bcryptjs'

export class TestFirmManagementService {
  
  /**
   * Generates a secure temporary password for testing
   */
  generateTemporaryPassword(): string {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const lowercase = 'abcdefghijkmnpqrstuvwxyz'
    const numbers = '23456789'
    const special = '!@#$%&*'
    
    // Ensure at least one character from each category
    let password = ''
    password += uppercase.charAt(Math.floor(Math.random() * uppercase.length))
    password += lowercase.charAt(Math.floor(Math.random() * lowercase.length))
    password += numbers.charAt(Math.floor(Math.random() * numbers.length))
    password += special.charAt(Math.floor(Math.random() * special.length))
    
    // Fill remaining 8 characters randomly from all categories
    const allChars = uppercase + lowercase + numbers + special
    for (let i = 4; i < 12; i++) {
      password += allChars.charAt(Math.floor(Math.random() * allChars.length))
    }
    
    // Shuffle the password to randomize character positions
    return password.split('').sort(() => Math.random() - 0.5).join('')
  }

  /**
   * Validates if a user can create accounts in a specific firm
   */
  async canCreateClientAccount(userId: string, targetFirmId: string): Promise<boolean> {
    try {
      const { data: user, error } = await supabaseTestClient
        .from('users')
        .select('role, organization_id')
        .eq('id', userId)
        .single()

      if (error || !user) {
        return false
      }

      // Super admin can create any account
      if (user.role === 'SUPER_ADMIN') {
        return true
      }

      // Admin can create client accounts
      if (user.role === 'ADMIN') {
        return true
      }

      // Client can create client accounts in same firm
      if (user.role === 'CLIENT') {
        return user.organization_id === targetFirmId
      }

      return false
    } catch (error) {
      console.error('Error checking account creation permissions:', error)
      return false
    }
  }

  /**
   * Creates a new firm with sequential numbering
   */
  async createFirmWithOwner(data: {
    firmName: string
    ownerData: {
      name: string
      email: string
      password: string
    }
  }) {
    try {
      // Get next firm number
      const { data: lastFirm } = await supabaseTestClient
        .from('organizations')
        .select('firm_number')
        .not('firm_number', 'is', null)
        .eq('is_firm', true)
        .order('firm_number', { ascending: false })
        .limit(1)
        .single()

      const nextFirmNumber = lastFirm?.firm_number 
        ? String(parseInt(lastFirm.firm_number) + 1).padStart(3, '0')
        : '001'

      // Create organization
      const { data: organization, error: orgError } = await supabaseTestClient
        .from('organizations')
        .insert({
          name: data.firmName,
          display_name: data.firmName,
          slug: data.firmName.toLowerCase().replace(/\s+/g, '-'),
          firm_number: nextFirmNumber,
          is_firm: true,
          firm_created_at: new Date().toISOString(),
          case_id_prefix: 'QGM',
          firm_case_counter: 0
        })
        .select()
        .single()

      if (orgError || !organization) {
        return {
          success: false,
          error: `Failed to create organization: ${orgError?.message || 'Unknown error'}`
        }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.ownerData.password, 12)

      // Split name
      const nameParts = data.ownerData.name.trim().split(' ')
      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ') || firstName

      // Create user
      const { data: user, error: userError } = await supabaseTestClient
        .from('users')
        .insert({
          first_name: firstName,
          last_name: lastName,
          email: data.ownerData.email.toLowerCase(),
          password_hash: passwordHash,
          role: 'CLIENT',
          organization_id: organization.id,
          is_active: true
        })
        .select()
        .single()

      if (userError || !user) {
        // Clean up organization if user creation fails
        await supabaseTestClient.from('organizations').delete().eq('id', organization.id)
        return {
          success: false,
          error: `Failed to create user: ${userError?.message || 'Unknown error'}`
        }
      }

      return {
        success: true,
        firmId: organization.id,
        firmNumber: nextFirmNumber,
        userId: user.id
      }

    } catch (error) {
      return {
        success: false,
        error: `Failed to create firm: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Creates a client account within an existing firm
   */
  async createClientAccount(
    firmId: string,
    clientData: { name: string; email: string },
    createdByUserId: string
  ) {
    try {
      // Verify creating user permissions
      const canCreate = await this.canCreateClientAccount(createdByUserId, firmId)
      if (!canCreate) {
        return {
          success: false,
          error: 'Insufficient permissions to create client account'
        }
      }

      // Generate temporary password
      const temporaryPassword = this.generateTemporaryPassword()
      const passwordHash = await bcrypt.hash(temporaryPassword, 12)

      // Split name
      const nameParts = clientData.name.trim().split(' ')
      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ') || firstName

      // Create user
      const { data: user, error } = await supabaseTestClient
        .from('users')
        .insert({
          first_name: firstName,
          last_name: lastName,
          email: clientData.email.toLowerCase(),
          password_hash: passwordHash,
          role: 'CLIENT',
          organization_id: firmId,
          is_active: true
        })
        .select()
        .single()

      if (error || !user) {
        return {
          success: false,
          error: `Failed to create client account: ${error?.message || 'Unknown error'}`
        }
      }

      return {
        success: true,
        userId: user.id,
        temporaryPassword
      }

    } catch (error) {
      return {
        success: false,
        error: `Failed to create client account: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }
}

// Export singleton instance for tests
export const testFirmManagementService = new TestFirmManagementService()