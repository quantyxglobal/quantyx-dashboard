import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireAdminAccess, handleAuthError } from '@/lib/auth-middleware'
import { firmManagementService } from '@/lib/firm-management-service'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Configure dynamic rendering for authentication
export const dynamic = 'force-dynamic'

// Validation schema for admin user creation
const adminUserCreationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be less than 128 characters'),
  role: z.nativeEnum(UserRole),
  organizationId: z.string().uuid().optional() // Required for CLIENT role
})

/**
 * POST /api/admin/users
 * Super admin creates admin/client accounts
 * Validates: Requirements 2.4, 2.5
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin access (super admin or admin)
    const authContext = await requireAdminAccess()

    // Parse and validate request body
    const body = await request.json()
    const validatedData = adminUserCreationSchema.parse(body)

    // Validate role-based creation permissions
    const canCreate = await validateRoleBasedCreation(
      authContext.user.role,
      validatedData.role,
      validatedData.organizationId
    )

    if (!canCreate.allowed) {
      return NextResponse.json(
        { 
          error: canCreate.reason,
          errorCode: 'PERMISSION_DENIED'
        },
        { status: 403 }
      )
    }

    // Normalize email
    const normalizedEmail = validatedData.email.toLowerCase()

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive'
        }
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { 
          error: 'A user with this email address already exists',
          errorCode: 'USER_ALREADY_EXISTS'
        },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validatedData.password, 12)

    // Split name into first and last name
    const nameParts = validatedData.name.trim().split(' ')
    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(' ') || firstName

    // Create user account
    const user = await prisma.user.create({
      data: {
        first_name: firstName,
        last_name: lastName,
        email: normalizedEmail,
        password_hash: passwordHash,
        role: validatedData.role,
        organization_id: validatedData.organizationId,
        is_active: true
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            firm_number: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'User account created successfully',
      user: {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        organizationName: user.organization?.name,
        firmNumber: user.organization?.firm_number,
        isActive: user.is_active,
        createdAt: user.created_at
      },
      createdBy: {
        id: authContext.user.id,
        name: `${authContext.user.firstName} ${authContext.user.lastName}`,
        role: authContext.user.role
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Admin user creation error:', error)

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
        error: 'Failed to create user account',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/users
 * List all users (admin access required)
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin access
    const authContext = await requireAdminAccess()

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const role = searchParams.get('role') as UserRole | null
    const organizationId = searchParams.get('organizationId')
    const search = searchParams.get('search')

    // Build where clause
    const where: any = {}
    
    if (role) {
      where.role = role
    }
    
    if (organizationId) {
      where.organization_id = organizationId
    }
    
    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Get users with pagination
    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              firm_number: true,
              is_firm: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.user.count({ where })
    ])

    return NextResponse.json({
      success: true,
      users: users.map(user => ({
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        organizationName: user.organization?.name,
        firmNumber: user.organization?.firm_number,
        isFirm: user.organization?.is_firm,
        isActive: user.is_active,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })

  } catch (error) {
    console.error('Admin user list error:', error)

    // Handle authentication errors
    if (error && typeof error === 'object' && 'code' in error) {
      return handleAuthError(error)
    }

    return NextResponse.json(
      { 
        error: 'Failed to retrieve users',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Validates role-based user creation permissions
 * Validates: Requirements 2.4, 2.5
 */
async function validateRoleBasedCreation(
  creatorRole: 'SUPER_ADMIN' | 'ADMIN' | 'CLIENT',
  targetRole: UserRole,
  organizationId?: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Super admin can create any account - Requirements 2.4
  if (creatorRole === 'SUPER_ADMIN') {
    // Validate organization exists if provided
    if (organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId }
      })
      
      if (!org) {
        return { allowed: false, reason: 'Organization not found' }
      }
    }
    
    // CLIENT role requires organization
    if (targetRole === UserRole.CLIENT && !organizationId) {
      return { allowed: false, reason: 'Client accounts require an organization' }
    }
    
    return { allowed: true }
  }

  // Admin can create only client accounts - Requirements 2.5
  if (creatorRole === 'ADMIN') {
    if (targetRole !== UserRole.CLIENT) {
      return { allowed: false, reason: 'Admins can only create client accounts' }
    }
    
    if (!organizationId) {
      return { allowed: false, reason: 'Client accounts require an organization' }
    }
    
    // Validate organization exists
    const org = await prisma.organization.findUnique({
      where: { id: organizationId }
    })
    
    if (!org) {
      return { allowed: false, reason: 'Organization not found' }
    }
    
    return { allowed: true }
  }

  // Clients cannot use this admin endpoint
  return { allowed: false, reason: 'Insufficient permissions' }
}