import { NextRequest, NextResponse } from 'next/server'
import { userManagementService } from '@/lib/user-management-service'
import { firmManagementService } from '@/lib/firm-management-service'
import { z } from 'zod'

// Configure dynamic rendering
export const dynamic = 'force-dynamic'

// Validation schema for user registration
const registrationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be less than 128 characters'),
  firmName: z.string().min(2, 'Firm name must be at least 2 characters').max(200, 'Firm name must be less than 200 characters'),
  invitationToken: z.string().optional()
})

/**
 * POST /api/auth/register
 * Handles user registration with automatic firm creation for self-registration
 * Validates: Requirements 6.1, 6.2, 2.4, 2.5, 2.6
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const validatedData = registrationSchema.parse(body)

    // Handle self-registration (no invitation token) - Requirements 6.1, 6.2
    if (!validatedData.invitationToken) {
      // Self-registration creates new firm automatically
      const result = await firmManagementService.createFirmWithOwner({
        firmName: validatedData.firmName,
        ownerData: {
          name: validatedData.name,
          email: validatedData.email,
          password: validatedData.password
        }
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

      return NextResponse.json({
        success: true,
        message: 'Account and firm created successfully',
        userId: result.userId,
        firmId: result.firmId,
        firmNumber: result.firmNumber,
        registrationType: 'self-registration'
      }, { status: 201 })
    }

    // Handle invitation-based registration
    const result = await userManagementService.registerUser(
      {
        name: validatedData.name,
        email: validatedData.email,
        password: validatedData.password,
        firmName: validatedData.firmName
      },
      validatedData.invitationToken
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
      message: 'User registered successfully via invitation',
      userId: result.userId,
      firmId: result.firmId,
      registrationType: 'invitation-based'
    }, { status: 201 })

  } catch (error) {
    console.error('Registration error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: error.errors?.map(e => ({ field: e.path.join('.'), message: e.message })) || []
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Registration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/auth/register
 * Validates invitation tokens for registration
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      )
    }

    // Validate the invitation token
    const invitation = await userManagementService.validateInvitationToken(token)

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation token' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      valid: true,
      invitation: {
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        firmName: invitation.firm.name,
        inviterName: invitation.inviter.name,
        expiresAt: invitation.expires_at
      }
    })

  } catch (error) {
    console.error('Invitation validation error:', error)

    return NextResponse.json(
      { 
        error: 'Failed to validate invitation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}