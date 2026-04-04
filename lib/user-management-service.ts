import { PrismaClient, Role, User, Firm, UserInvitation } from '@prisma/client'
import { prisma } from './prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { CaseIdGeneratorService } from './case-id-generator'

/**
 * User Management Service
 * 
 * Handles multi-user law firm management, invitations, and access control.
 * 
 * Features:
 * - User invitation system with email-based registration
 * - Firm creation and user association
 * - Role-based access control
 * - Self-service user registration
 * - Firm-based data isolation
 */

export interface InvitationResult {
  success: boolean
  invitationId?: string
  token?: string
  error?: string
  errorCode?: string
}

export interface RegistrationResult {
  success: boolean
  userId?: string
  firmId?: string
  error?: string
  errorCode?: string
}

export interface UserRegistrationData {
  name: string
  email: string
  password: string
  firmName: string
}

export interface UserInvitationData {
  name: string
  email: string
  role: Role
}

export interface FirmCreationData {
  name: string
  createdByUserId?: string
}

// Validation schemas
export const userRegistrationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be less than 128 characters'),
  firmName: z.string().min(2, 'Firm name must be at least 2 characters').max(200, 'Firm name must be less than 200 characters')
})

export const userInvitationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Invalid email format'),
  role: z.nativeEnum(Role)
})

export const firmCreationSchema = z.object({
  name: z.string().min(2, 'Firm name must be at least 2 characters').max(200, 'Firm name must be less than 200 characters'),
  createdByUserId: z.string().uuid().optional()
})

export class UserManagementService {
  private prisma: PrismaClient
  private caseIdGenerator: CaseIdGeneratorService

  constructor(prismaClient: PrismaClient = prisma) {
    this.prisma = prismaClient
    this.caseIdGenerator = new CaseIdGeneratorService(prismaClient)
  }

  /**
   * Invites a user to join a law firm
   * @param inviterUserId - The ID of the user sending the invitation
   * @param invitationData - The invitation data (name, email, role)
   * @returns Promise<InvitationResult> - The result of the invitation
   */
  async inviteUser(inviterUserId: string, invitationData: UserInvitationData): Promise<InvitationResult> {
    try {
      // Validate input data
      const validatedData = userInvitationSchema.parse(invitationData)

      // Normalize email to lowercase for consistent checking
      const normalizedEmail = validatedData.email.toLowerCase()

      // Get the inviter's firm
      const inviter = await this.prisma.user.findUnique({
        where: { id: inviterUserId },
        include: { firm: true }
      })

      if (!inviter || !inviter.firm) {
        return {
          success: false,
          error: 'Inviter not found or not associated with a firm',
          errorCode: 'INVITER_NOT_FOUND'
        }
      }

      // Check if user is already registered (case-insensitive)
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

      // Check if there's already a pending invitation for this email and firm
      const existingInvitation = await this.prisma.userInvitation.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive'
          },
          firm_id: inviter.firm.id,
          accepted_at: null
        }
      })

      if (existingInvitation && !existingInvitation.accepted_at) {
        return {
          success: false,
          error: 'An invitation for this email address is already pending',
          errorCode: 'INVITATION_PENDING'
        }
      }

      // Generate invitation token
      const token = this.generateInvitationToken()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now

      // Create invitation
      const invitation = await this.prisma.userInvitation.create({
        data: {
          email: normalizedEmail,
          name: validatedData.name,
          role: validatedData.role,
          firm_id: inviter.firm.id,
          invited_by: inviterUserId,
          token,
          expires_at: expiresAt
        }
      })

      return {
        success: true,
        invitationId: invitation.id,
        token: invitation.token
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
        error: `Failed to invite user: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorCode: 'INVITATION_FAILED'
      }
    }
  }

  /**
   * Registers a new user with firm association
   * @param registrationData - The user registration data
   * @param invitationToken - Optional invitation token for firm association
   * @returns Promise<RegistrationResult> - The result of the registration
   */
  async registerUser(registrationData: UserRegistrationData, invitationToken?: string): Promise<RegistrationResult> {
    try {
      // Validate input data
      const validatedData = userRegistrationSchema.parse(registrationData)

      // Normalize email to lowercase for consistent checking
      const normalizedEmail = validatedData.email.toLowerCase()

      // Check if user already exists (case-insensitive)
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

      let firmId: string
      let invitation: UserInvitation | null = null

      // If invitation token provided, validate and use it
      if (invitationToken) {
        invitation = await this.prisma.userInvitation.findUnique({
          where: { token: invitationToken },
          include: { firm: true }
        })

        if (!invitation) {
          return {
            success: false,
            error: 'Invalid invitation token',
            errorCode: 'INVALID_INVITATION'
          }
        }

        if (invitation.expires_at < new Date()) {
          return {
            success: false,
            error: 'Invitation has expired',
            errorCode: 'INVITATION_EXPIRED'
          }
        }

        if (invitation.accepted_at) {
          return {
            success: false,
            error: 'Invitation has already been accepted',
            errorCode: 'INVITATION_ALREADY_ACCEPTED'
          }
        }

        if (invitation.email.toLowerCase() !== normalizedEmail) {
          return {
            success: false,
            error: 'Email address does not match invitation',
            errorCode: 'EMAIL_MISMATCH'
          }
        }

        firmId = invitation.firm_id
      } else {
        // Create new firm or find existing one
        const firmResult = await this.createOrFindFirm({ name: validatedData.firmName })
        if (!firmResult.success) {
          return {
            success: false,
            error: firmResult.error,
            errorCode: firmResult.errorCode
          }
        }
        firmId = firmResult.firmId!
      }

      // Hash password
      const passwordHash = await bcrypt.hash(validatedData.password, 12)

      // Create user in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create user
        const user = await tx.user.create({
          data: {
            name: validatedData.name,
            email: normalizedEmail,
            password_hash: passwordHash,
            role: invitation?.role || Role.client,
            firm_id: firmId
          }
        })

        // If this was an invitation, mark it as accepted
        if (invitation) {
          await tx.userInvitation.update({
            where: { id: invitation.id },
            data: {
              accepted_at: new Date(),
              invited_user_id: user.id
            }
          })
        }

        return { userId: user.id, firmId }
      })

      return {
        success: true,
        userId: result.userId,
        firmId: result.firmId
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.errors && error.errors.length > 0 ? error.errors[0].message : 'Validation failed',
          errorCode: 'VALIDATION_ERROR'
        }
      }

      // Handle database constraint violations (e.g., unique email constraint)
      if (error instanceof Error) {
        if (error.message.includes('Unique constraint failed') && error.message.includes('email')) {
          return {
            success: false,
            error: 'A user with this email address already exists',
            errorCode: 'USER_ALREADY_EXISTS'
          }
        }
      }

      return {
        success: false,
        error: `Failed to register user: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorCode: 'REGISTRATION_FAILED'
      }
    }
  }

  /**
   * Associates a user with a firm
   * @param userId - The ID of the user to associate
   * @param firmId - The ID of the firm to associate with
   * @returns Promise<void>
   */
  async associateUserWithFirm(userId: string, firmId: string): Promise<void> {
    try {
      // Verify user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        throw new Error(`User with ID ${userId} not found`)
      }

      // Verify firm exists
      const firm = await this.prisma.firm.findUnique({
        where: { id: firmId }
      })

      if (!firm) {
        throw new Error(`Firm with ID ${firmId} not found`)
      }

      // Update user's firm association
      await this.prisma.user.update({
        where: { id: userId },
        data: { firm_id: firmId }
      })
    } catch (error) {
      throw new Error(`Failed to associate user with firm: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validates if a user has access to a specific case
   * @param userId - The ID of the user
   * @param caseId - The ID of the case
   * @returns Promise<boolean> - True if user has access
   */
  async validateFirmAccess(userId: string, caseId: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, firm_id: true }
      })

      if (!user) {
        return false
      }

      // Admin users have access to all cases
      if (user.role === Role.admin) {
        return true
      }

      // Client users can only access cases from their firm
      if (!user.firm_id) {
        return false
      }

      const caseRecord = await this.prisma.case.findUnique({
        where: { id: caseId },
        select: { firm_id: true }
      })

      if (!caseRecord) {
        return false
      }

      return user.firm_id === caseRecord.firm_id
    } catch (error) {
      return false
    }
  }

  /**
   * Creates a new firm or finds an existing one by name
   * @param firmData - The firm creation data
   * @returns Promise with firm creation result
   */
  async createOrFindFirm(firmData: FirmCreationData): Promise<{ success: boolean; firmId?: string; error?: string; errorCode?: string }> {
    try {
      // Validate input data
      const validatedData = firmCreationSchema.parse(firmData)

      // Check if firm already exists (case-insensitive)
      const existingFirm = await this.prisma.firm.findFirst({
        where: {
          name: {
            equals: validatedData.name,
            mode: 'insensitive'
          }
        }
      })

      if (existingFirm) {
        return {
          success: true,
          firmId: existingFirm.id
        }
      }

      // Create new firm with next sequence number
      const firmSequence = await this.caseIdGenerator.getNextFirmSequence()

      const newFirm = await this.prisma.firm.create({
        data: {
          name: validatedData.name,
          firm_sequence: firmSequence
        }
      })

      return {
        success: true,
        firmId: newFirm.id
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
   * Gets all users associated with a firm
   * @param firmId - The ID of the firm
   * @returns Promise<User[]> - Array of users in the firm
   */
  async getFirmUsers(firmId: string): Promise<User[]> {
    try {
      return await this.prisma.user.findMany({
        where: { firm_id: firmId },
        orderBy: { created_at: 'asc' }
      })
    } catch (error) {
      throw new Error(`Failed to get firm users: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Gets pending invitations for a firm
   * @param firmId - The ID of the firm
   * @returns Promise<UserInvitation[]> - Array of pending invitations
   */
  async getPendingInvitations(firmId: string): Promise<UserInvitation[]> {
    try {
      return await this.prisma.userInvitation.findMany({
        where: {
          firm_id: firmId,
          accepted_at: null,
          expires_at: { gt: new Date() }
        },
        include: {
          inviter: { select: { name: true, email: true } }
        },
        orderBy: { created_at: 'desc' }
      })
    } catch (error) {
      throw new Error(`Failed to get pending invitations: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validates an invitation token
   * @param token - The invitation token to validate
   * @returns Promise with invitation details or null if invalid
   */
  async validateInvitationToken(token: string): Promise<UserInvitation | null> {
    try {
      const invitation = await this.prisma.userInvitation.findUnique({
        where: { token },
        include: { firm: true, inviter: { select: { name: true, email: true } } }
      })

      if (!invitation) {
        return null
      }

      // Check if invitation is expired
      if (invitation.expires_at < new Date()) {
        return null
      }

      // Check if invitation is already accepted
      if (invitation.accepted_at) {
        return null
      }

      return invitation
    } catch (error) {
      return null
    }
  }

  /**
   * Generates a secure invitation token
   * @returns string - A secure random token
   */
  private generateInvitationToken(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Cleans up expired invitations
   * @returns Promise<number> - Number of expired invitations deleted
   */
  async cleanupExpiredInvitations(): Promise<number> {
    try {
      const result = await this.prisma.userInvitation.deleteMany({
        where: {
          expires_at: { lt: new Date() },
          accepted_at: null
        }
      })

      return result.count
    } catch (error) {
      throw new Error(`Failed to cleanup expired invitations: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Export a default instance for convenience
export const userManagementService = new UserManagementService()