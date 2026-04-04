import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { userManagementService } from '@/lib/user-management-service'
import { requireAdminAccess, handleAuthError } from '@/lib/auth-middleware'
import { z } from 'zod'

// Configure dynamic rendering for authentication
export const dynamic = 'force-dynamic'

// Validation schema for firm creation
const createFirmSchema = z.object({
  name: z.string().min(2, 'Firm name must be at least 2 characters').max(200, 'Firm name must be less than 200 characters')
})

/**
 * GET /api/admin/firms
 * Admin-only endpoint to retrieve all firms with their users
 * Uses enhanced authentication middleware for role-based access control
 */
export async function GET(request: NextRequest) {
  try {
    // Use enhanced authentication middleware - admin access required
    const authContext = await requireAdminAccess()

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Max 100 per page
    const search = searchParams.get('search')

    const skip = (page - 1) * limit

    // Build where clause for search
    let whereClause: any = {}
    if (search) {
      whereClause = {
        name: {
          contains: search,
          mode: 'insensitive'
        }
      }
    }

    // Get organizations (firms) with pagination - RLS policies handle access control
    const [organizations, totalCount] = await Promise.all([
      prisma.organization.findMany({
        where: {
          ...whereClause,
          is_firm: true // Only get firms, not internal organizations
        },
        include: {
          users: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              role: true,
              is_active: true,
              created_at: true
            },
            orderBy: { created_at: 'asc' }
          },
          cases: {
            select: {
              id: true,
              case_number: true,
              status: true
            }
          },
          user_invitations: {
            where: {
              accepted_at: null,
              expires_at: { gt: new Date() }
            },
            select: {
              id: true,
              email: true,
              invited_name: true,
              role: true,
              created_at: true
            }
          }
        },
        orderBy: { firm_created_at: 'desc' },
        skip,
        take: limit
      }),
      prisma.organization.count({ 
        where: {
          ...whereClause,
          is_firm: true
        }
      })
    ])

    const totalPages = Math.ceil(totalCount / limit)

    // Format the response
    const formattedFirms = organizations.map(org => ({
      id: org.id,
      name: org.display_name || org.name,
      firm_number: org.firm_number,
      firm_case_counter: org.firm_case_counter,
      created_at: org.firm_created_at || org.created_at,
      updated_at: org.updated_at,
      users: org.users.map(user => ({
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at
      })),
      pending_invitations: org.user_invitations.map(inv => ({
        id: inv.id,
        email: inv.email,
        name: inv.invited_name,
        role: inv.role,
        created_at: inv.created_at
      })),
      stats: {
        total_users: org.users.length,
        active_users: org.users.filter(u => u.is_active).length,
        total_cases: org.cases.length,
        pending_invitations: org.user_invitations.length,
        active_cases: org.cases.filter(c => c.status === 'pending' || c.status === 'in_progress').length
      }
    }))

    return NextResponse.json({
      firms: formattedFirms,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      user_context: {
        role: authContext.user.role,
        can_manage_all_firms: true
      }
    })

  } catch (error) {
    console.error('Admin firms retrieval error:', error)

    // Handle authentication errors
    if (error && typeof error === 'object' && 'code' in error) {
      return handleAuthError(error)
    }

    return NextResponse.json(
      { 
        error: 'Failed to retrieve firms',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/firms
 * Admin-only endpoint to create new firms
 * Uses enhanced authentication middleware for role-based access control
 */
export async function POST(request: NextRequest) {
  try {
    // Use enhanced authentication middleware - admin access required
    const authContext = await requireAdminAccess()

    // Parse and validate request body
    const body = await request.json()
    const validatedData = createFirmSchema.parse(body)

    // Create the firm using user management service
    const result = await userManagementService.createOrFindFirm({
      name: validatedData.name,
      createdByUserId: authContext.user.id
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

    // Get the created firm with details
    const organization = await prisma.organization.findUnique({
      where: { id: result.firmId },
      include: {
        users: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            role: true,
            is_active: true,
            created_at: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Firm created successfully',
      firm: {
        id: organization!.id,
        name: organization!.display_name || organization!.name,
        firm_number: organization!.firm_number,
        firm_case_counter: organization!.firm_case_counter,
        created_at: organization!.firm_created_at || organization!.created_at,
        users: organization!.users.map(user => ({
          id: user.id,
          name: `${user.first_name} ${user.last_name}`,
          email: user.email,
          role: user.role,
          is_active: user.is_active,
          created_at: user.created_at
        })),
        stats: {
          total_users: organization!.users.length,
          active_users: organization!.users.filter(u => u.is_active).length,
          total_cases: 0,
          pending_invitations: 0,
          active_cases: 0
        }
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Admin firm creation error:', error)

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
        error: 'Failed to create firm',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}