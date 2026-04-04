import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { FirmManagementService } from '@/lib/firm-management-service'
import { z } from 'zod'

// Configure dynamic rendering for authentication
export const dynamic = 'force-dynamic'

const firmManagementService = new FirmManagementService()

// Input validation schemas
const CreateFirmSchema = z.object({
  name: z.string().min(1, 'Firm name is required').max(255, 'Firm name too long'),
  displayName: z.string().optional(),
  description: z.string().optional()
})

/**
 * POST /api/firms
 * Creates a new firm with sequential numbering
 * Requirements: 6.1, 6.2, 6.3
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

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

    // Check authorization - only SUPER_ADMIN and ADMIN can create firms
    // Clients can create firms only during self-registration (handled separately)
    if (!['SUPER_ADMIN', 'ADMIN'].includes(currentUser.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create firms' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = CreateFirmSchema.parse(body)

    // Create firm using the service
    const result = await firmManagementService.createFirm({
      name: validatedData.name,
      displayName: validatedData.displayName,
      description: validatedData.description,
      createdByUserId: currentUser.id
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    // Get the created firm details
    const createdFirm = await prisma.organization.findUnique({
      where: { id: result.firmId },
      select: {
        id: true,
        name: true,
        display_name: true,
        description: true,
        created_at: true
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Firm created successfully',
      firm: {
        id: createdFirm?.id,
        name: createdFirm?.name,
        displayName: createdFirm?.display_name,
        description: createdFirm?.description,
        firmNumber: result.firmNumber,
        createdAt: createdFirm?.created_at
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Firm creation error:', error)

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
        error: 'Failed to create firm',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/firms
 * Retrieves firms based on user role and permissions
 * Requirements: 3.1, 3.4
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

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

    let firms

    // Role-based access control
    switch (currentUser.role) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        // Admins can see all firms
        firms = await prisma.organization.findMany({
          where: {
            name: {
              not: {
                in: ['Quantyx Global', 'Internal'] // Exclude system organizations
              }
            }
          },
          select: {
            id: true,
            name: true,
            display_name: true,
            description: true,
            created_at: true,
            _count: {
              select: {
                users: true,
                cases: true
              }
            }
          },
          orderBy: {
            created_at: 'desc'
          }
        })
        break

      case 'CLIENT':
        // Clients can only see their own firm
        if (!currentUser.organization_id) {
          return NextResponse.json(
            { error: 'Client user must be associated with a firm' },
            { status: 400 }
          )
        }

        firms = await prisma.organization.findMany({
          where: { id: currentUser.organization_id },
          select: {
            id: true,
            name: true,
            display_name: true,
            description: true,
            created_at: true,
            _count: {
              select: {
                users: true,
                cases: true
              }
            }
          }
        })
        break

      default:
        return NextResponse.json(
          { error: 'Invalid user role' },
          { status: 403 }
        )
    }

    // Format response
    const formattedFirms = firms.map(firm => ({
      id: firm.id,
      name: firm.name,
      displayName: firm.display_name,
      description: firm.description,
      createdAt: firm.created_at,
      userCount: firm._count.users,
      caseCount: firm._count.cases
    }))

    return NextResponse.json({
      firms: formattedFirms,
      total: formattedFirms.length,
      userRole: currentUser.role
    })

  } catch (error) {
    console.error('Firms retrieval error:', error)

    return NextResponse.json(
      { 
        error: 'Failed to retrieve firms',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}