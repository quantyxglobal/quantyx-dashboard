import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth-middleware'
import { firmManagementService } from '@/lib/firm-management-service'
import { EmailNotificationService } from '@/lib/email-notification-service'
import { z } from 'zod'

// Configure dynamic rendering for authentication
export const dynamic = 'force-dynamic'

// Validation schema for client account creation
const clientCreationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Invalid email format')
})

/**
 * POST /api/users/invite
 * Client creates other client accounts within same firm
 * Validates: Requirements 2.6, 6.3, 6.4
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication - clients, admins, and super admins can create accounts
    const authContext = await requireAuth(['SUPER_ADMIN', 'ADMIN', 'CLIENT'])()

    // Parse and validate request body
    const body = await request.json()
    const validatedData = clientCreationSchema.parse(body)

    // For client users, validate firm-scoped invitation - Requirements 2.6, 6.3
    if (authContext.user.role === 'CLIENT') {
      if (!authContext.user.organizationId) {
        return NextResponse.json(
          { 
            error: 'Client user must be associated with a firm',
            errorCode: 'NO_FIRM_ASSOCIATION'
          },
          { status: 400 }
        )
      }

      // Create client account within same firm
      const result = await firmManagementService.createClientAccount(
        authContext.user.organizationId,
        {
          name: validatedData.name,
          email: validatedData.email
        },
        authContext.user.id
      )

      if (!result.success) {
        return NextResponse.json(
          { 
            error: result.error,
            errorCode: result.errorCode
          },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Client account created successfully within firm',
        userId: result.userId,
        temporaryPassword: result.temporaryPassword,
        createdBy: {
          id: authContext.user.id,
          name: `${authContext.user.firstName} ${authContext.user.lastName}`,
          role: authContext.user.role,
          firmId: authContext.user.organizationId
        },
        accountType: 'client-to-client'
      }, { status: 201 })
    }

    // For admin and super admin users, use existing invitation system
    // This maintains backward compatibility with existing functionality
    const userManagementService = (await import('@/lib/user-management-service')).userManagementService
    
    const result = await userManagementService.inviteUser(authContext.user.id, {
      name: validatedData.name,
      email: validatedData.email,
      role: 'CLIENT' as any // Default to CLIENT role for invitations
    })

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error,
          errorCode: result.errorCode
        },
        { status: 400 }
      )
    }

    // Send invitation email asynchronously for admin/super admin invitations
    try {
      const emailService = new EmailNotificationService({
        provider: 'console',
        fromEmail: process.env.EMAIL_FROM || 'noreply@quantyxglobal.com',
        fromName: 'Quantyx Global Case Management'
      })

      if (authContext.organization) {
        await emailService.sendUserInvitation(
          validatedData.email,
          result.token!,
          authContext.organization.name,
          `${authContext.user.firstName} ${authContext.user.lastName}`
        )
      }
    } catch (emailError) {
      // Log email error but don't fail the invitation
      console.error('Failed to send invitation email:', emailError)
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
      invitationId: result.invitationId,
      invitedEmail: validatedData.email,
      invitedName: validatedData.name,
      role: 'CLIENT',
      inviter_context: {
        role: authContext.user.role,
        organization: authContext.organization?.name,
        firmNumber: authContext.user.firmNumber
      },
      accountType: 'invitation-based'
    }, { status: 201 })

  } catch (error) {
    console.error('User invitation/creation error:', error)

    // Handle authentication errors
    if (error && typeof error === 'object' && 'code' in error) {
      return handleAuthError(error)
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to create user account or send invitation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}