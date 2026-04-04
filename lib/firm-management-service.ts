import { PrismaClient, UserRole } from '@prisma/client'
import { prisma } from './prisma'
import { EmailNotificationService } from './email-notification-service'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
 'crypto'

/**
 * Firm Management Service
 * 
 * Handles firm creation, sequential numbering, and user account management
 * within the multi-tenant architecture.
 * 
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 6.1, 6.2
 */

export interface FirmCreationResult {
  success: boolean
  firmId?: string
  firmNumber?: string
  userId?: string
  error?: string
  errorCode?: string
}

export interface ClientAccountCreationResult {
  success: boolean
  userId?: string
  temporaryPassword?: string
  error?: string
  errorCode?: string
}

export interface FirmWithOwnerData {
  firmName: string
  ownerData: {
    name: string
    email: string
    password: string
  }
}

export interface ClientAccountData {
  name: string
  email: string
}

// Validation schemas
const firmWithOwnerSchema = z.object({
  firmName: z.string().min(2, 'Firm name must be at least 2 characters').max(200, 'Firm name must be less than 200 characters'),
  ownerData: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be less than 128 characters')
  })
})

const clientAccountSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Invalid email format')
})

export class FirmManagementService {
  private prisma: PrismaClient
  private emailService: EmailNotificationService

  constructor(prismaClient: PrismaClient = prisma) {
    this.prisma = prismaClient
    this.emailService = new EmailNotificationService({
      provider: 'console',
      fromEmail: process.env.EMAIL_FROM || 'noreply@quantyxglobal.com',
      fromName: 'Quantyx Global Case Management'
    })
  }

  /**
   * Creates a new firm with sequential numbering and owner account
   * Validates: Requirements 6.1, 6.2, 4.1, 4.2, 4.3
   */
  async createFirmWithOwner(data: FirmWithOwnerData): Promise<FirmCreationResult> {
    try {
      // Validate input data
      const validatedData = firmWithOwnerSchema.parse(data)
      const normalizedEmail = validatedData.ownerData.email.toLowerCase()

      // Check if user already exists
      const existingUser = await this.prisma.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive'
          }
        }
      })

      if (existingUser) {
        return {
          success: false,
          error: 'A user with this email address already exists',
          errorCode: 'USER_ALREADY_EXISTS'
        }
      }

      // Create firm and owner in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Get next sequential firm number - Requirements 4.1, 4.2, 4.3
        const lastFirm = await tx.organization.findFirst({
          where: { 
            firm_number: { not: null },
            is_firm: true
          },
          orderBy: { firm_number: 'desc' }
        })

        const nextFirmNumber = lastFirm?.firm_number 
          ? String(parseInt(lastFirm.firm_number) + 1).padStart(3, '0')
          : '001'

        // Create organization with firm-specific fields
        const organization = await tx.organization.create({
          data: {
            name: validatedData.firmName,
            display_name: validatedData.firmName,
            slug: validatedData.firmName.toLowerCase().replace(/\s+/g, '-'),
            firm_number: nextFirmNumber,
            is_firm: true,
            firm_created_at: new Date(),
            case_id_prefix: 'QGM',
            firm_case_counter: 0
          }
        })

        // Hash password
        const passwordHash = await bcrypt.hash(validatedData.ownerData.password, 12)

        // Split name into first and last name
        const nameParts = validatedData.ownerData.name.trim().split(' ')
        const firstName = nameParts[0]
        const lastName = nameParts.slice(1).join(' ') || firstName

        // Create owner user account
        const user = await tx.user.create({
          data: {
            first_name: firstName,
            last_name: lastName,
            email: normalizedEmail,
            password_hash: passwordHash,
            role: UserRole.CLIENT,
            organization_id: organization.id,
            is_active: true
          }
        })

        return { 
          organization, 
          user,
          firmNumber: nextFirmNumber
        }
      })

      return {
        success: true,
        firmId: result.organization.id,
        firmNumber: result.firmNumber,
        userId: result.user.id
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.errors && error.errors.length > 0 ? error.errors[0].message : 'Validation failed',
          errorCode: 'VALIDATION_ERROR'
        }
      }

      return {
        success: false,
        error: `Failed to create firm: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorCode: 'FIRM_CREATION_FAILED'
      }
    }
  }

  /**
   * Creates a client account within an existing firm
   * Validates: Requirements 2.6, 6.3, 6.4
   */
  async createClientAccount(
    firmId: string,
    clientData: ClientAccountData,
    createdByUserId: string
  ): Promise<ClientAccountCreationResult> {
    try {
      // Validate input data
      const validatedData = clientAccountSchema.parse(clientData)
      const normalizedEmail = validatedData.email.toLowerCase()

      // Verify the creating user has permission and is in the same firm
      const creatingUser = await this.prisma.user.findUnique({
        where: { id: createdByUserId },
        include: { organization: true }
      })

      if (!creatingUser || !creatingUser.organization) {
        return {
          success: false,
          error: 'Creating user not found or not associated with a firm',
          errorCode: 'INVALID_CREATOR'
        }
      }

      // Verify firm access - Requirements 2.6
      if (creatingUser.organization_id !== firmId) {
        return {
          success: false,
          error: 'Cannot create account in different firm',
          errorCode: 'FIRM_ACCESS_DENIED'
        }
      }

      // Check if user already exists
      const existingUser = await this.prisma.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive'
          }
        }
      })

      if (existingUser) {
        return {
          success: false,
          error: 'A user with this email address already exists',
          errorCode: 'USER_ALREADY_EXISTS'
        }
      }

      // Generate temporary password - Requirements 6.4
      const temporaryPassword = this.generateTemporaryPassword()
      const passwordHash = await bcrypt.hash(temporaryPassword, 12)

      // Split name into first and last name
      const nameParts = validatedData.name.trim().split(' ')
      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ') || firstName

      // Create user account
      const user = await this.prisma.user.create({
        data: {
          first_name: firstName,
          last_name: lastName,
          email: normalizedEmail,
          password_hash: passwordHash,
          role: UserRole.CLIENT,
          organization_id: firmId,
          is_active: true
        }
      })

      // Send credentials to support email - Requirements 6.5
      try {
        await this.sendNewAccountCredentials(
          validatedData.email,
          validatedData.name,
          temporaryPassword,
          creatingUser.organization.name,
          `${creatingUser.first_name} ${creatingUser.last_name}`,
          creatingUser.organization.firm_number || 'N/A'
        )
      } catch (emailError) {
        console.error('Failed to send account credentials email:', emailError)
        // Don't fail the account creation if email fails
      }

      return {
        success: true,
        userId: user.id,
        temporaryPassword
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.errors && error.errors.length > 0 ? error.errors[0].message : 'Validation failed',
          errorCode: 'VALIDATION_ERROR'
        }
      }

      return {
        success: false,
        error: `Failed to create client account: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorCode: 'ACCOUNT_CREATION_FAILED'
      }
    }
  }

  /**
   * Gets the next sequential firm number
   * Validates: Requirements 4.1, 4.2, 4.3
   */
  async getNextFirmNumber(): Promise<string> {
    const lastFirm = await this.prisma.organization.findFirst({
      where: { 
        firm_number: { not: null },
        is_firm: true
      },
      orderBy: { firm_number: 'desc' }
    })

    return lastFirm?.firm_number 
      ? String(parseInt(lastFirm.firm_number) + 1).padStart(3, '0')
      : '001'
  }

  /**
   * Validates if a user can create accounts in a specific firm
   * Validates: Requirements 2.4, 2.5, 2.6
   */
  async validateAccountCreationPermission(
    userId: string, 
    targetFirmId: string, 
    targetRole: UserRole
  ): Promise<{ canCreate: boolean; reason?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, organization_id: true }
    })

    if (!user) {
      return { canCreate: false, reason: 'User not found' }
    }

    // Super admin can create any account - Requirements 2.4
    if (user.role === UserRole.SUPER_ADMIN) {
      return { canCreate: true }
    }

    // Admin can create only client accounts - Requirements 2.5
    if (user.role === UserRole.ADMIN) {
      return { 
        canCreate: targetRole === UserRole.CLIENT,
        reason: targetRole !== UserRole.CLIENT ? 'Admins can only create client accounts' : undefined
      }
    }

    // Client can create only client accounts in same firm - Requirements 2.6
    if (user.role === UserRole.CLIENT) {
      if (targetRole !== UserRole.CLIENT) {
        return { canCreate: false, reason: 'Clients can only create client accounts' }
      }
      
      if (user.organization_id !== targetFirmId) {
        return { canCreate: false, reason: 'Clients can only create accounts in their own firm' }
      }
      
      return { canCreate: true }
    }

    return { canCreate: false, reason: 'Invalid user role' }
  }

  /**
   * Checks if a user can create a client account in a specific firm
   * Used by property tests for validation
   */
  async canCreateClientAccount(
    userId: string,
    targetFirmId: string
  ): Promise<boolean> {
    const result = await this.validateAccountCreationPermission(userId, targetFirmId, UserRole.CLIENT)
    return result.canCreate
  }

  /**
   * Generates a secure temporary password
   * Requirements: Must contain uppercase, lowercase, numbers, and special characters
   * Must not contain ambiguous characters (I, O, 0, 1)
   */
  private generateTemporaryPassword(): string {
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
   * Sends new account credentials to support email
   * Validates: Requirements 6.5, 10.2, 10.3, 10.4
   */
  private async sendNewAccountCredentials(
    userEmail: string,
    userName: string,
    temporaryPassword: string,
    firmName: string,
    creatorName: string,
    firmNumber: string
  ): Promise<void> {
    const supportEmail = 'support@quantyxg.com'
    const subject = `New Client Account Created - ${firmName} (Firm #${firmNumber})`
    
    const emailContent = `
New client account has been created:

Account Details:
- Name: ${userName}
- Email: ${userEmail}
- Temporary Password: ${temporaryPassword}
- Firm: ${firmName} (Firm #${firmNumber})

Created by: ${creatorName}
Created at: ${new Date().toISOString()}

Please provide these credentials to the new user and instruct them to change their password upon first login.

---
Quantyx Global Case Management System
    `.trim()

    // Send email to support
    await this.emailService.sendEmail({
      to: supportEmail,
      subject,
      text: emailContent,
      html: emailContent.replace(/\n/g, '<br>')
    })
  }
}

// Export a default instance for convenience
export const firmManagementService = new FirmManagementService()