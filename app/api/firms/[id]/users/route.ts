import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { FirmManagementService } from '@/lib/firm-management-service'
import { z } from 'zod'

// Configure dynamic rendering for authentication
export const dynamic = 'force-dynamic'

const firmManagementService = new FirmManagementService()

// Input validation schema for creating client accounts
const CreateClientSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long'),
  email: z.string().email('Invalid email address').toLowerCase()
})

/**
 * GET /api/firms/[id]/users
 * Retrieves users associated with a specific firm
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: firmId } = await params

    // Get current user details
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { organization: true }
    })

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check authorization based on role
    let canAccess = false
    switch (currentUser.role) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        canAccess = true
        break
      case 'CLIENT':
        canAccess = currentUser.organization_id === firmId
        break
    }

    if (!canAccess) {
      return NextResponse.json(
        { error: 'Access denied to this firm' },
        { status: 403 }
      )
    }

    // Verify firm exists
    const firm = await prisma.organization.findUnique({
      where: { id: firmId },
      select: {
        id: true,
        name: true,
        display_name: true,
        created_at: true
      }
    })

    if (!firm) {
      return NextResponse.json(
        { error: 'Firm not found' },
        { status: 404 }
      )
    }

    // Get firm users
    const users = await prisma.user.findMany({
      where: { organization_id: firmId },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        last_login_at: true
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    // Format user data (exclude sensitive information)
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      role: user.role,
      isActive: user.is_active,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }))

    return NextResponse.json({
      firm: {
        id: firm.id,
        name: firm.name,
        displayName: firm.display_name,
        createdAt: firm.created_at
      },
      users: formattedUsers,
      totalUsers: formattedUsers.length
    })

  } catch (error) {
    console.error('Firm users retrieval error:', error)

    return NextResponse.json(
      { 
        error: 'Failed to retrieve firm users',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/firms/[id]/users
 * Creates a new client account within the specified firm
 * Requirements: 6.1, 6.2, 6.3
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: firmId } = await params

    // Get current user details
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        id: true, 
        role: true, 
        organization_id: true,
        first_name: true,
        last_name: true
      }
    })

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = CreateClientSchema.parse(body)

    // Create client account using the service
    const result = await firmManagementService.createClientAccount({
      firmId,
      clientData: {
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        email: validatedData.email
      },
      createdByUserId: currentUser.id
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    // Get the created user details (excluding sensitive information)
    const createdUser = await prisma.user.findUnique({
      where: { id: result.userId },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true,
        is_active: true,
        created_at: true,
        organization: {
          select: {
            id: true,
            name: true,
            display_name: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Client account created successfully',
      user: {
        id: createdUser?.id,
        name: `${createdUser?.first_name} ${createdUser?.last_name}`,
        firstName: createdUser?.first_name,
        lastName: createdUser?.last_name,
        email: createdUser?.email,
        role: createdUser?.role,
        isActive: createdUser?.is_active,
        createdAt: createdUser?.created_at,
        firm: createdUser?.organization
      },
      // Note: temporaryPassword is not returned for security reasons
      // It's sent to support@quantyxg.com via email
      credentialsSent: true
    }, { status: 201 })

  } catch (error) {
    console.error('Client account creation error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to create client account',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}