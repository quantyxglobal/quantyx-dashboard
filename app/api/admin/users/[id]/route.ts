import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess, handleAuthError } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Configure dynamic rendering for authentication
export const dynamic = 'force-dynamic'

// Lazy schema to avoid Prisma enum evaluation at module level
const getUserUpdateSchema = () => z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters').optional(),
  email: z.string().email('Invalid email format').optional(),
  role: z.nativeEnum(UserRole).optional(),
  organizationId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be less than 128 characters').optional()
})

/**
 * PUT /api/admin/users/[id]
 * Update user roles and permissions
 * Validates: Requirements 2.4, 2.5
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require admin access
    const authContext = await requireAdminAccess()
    const { id: userId } = await params

    // Parse and validate request body
    const body = await request.json()
    const validatedData = getUserUpdateSchema().parse(body)

    // Get existing user
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
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

    if (!existingUser) {
      return NextResponse.json(
        { 
          error: 'User not found',
          errorCode: 'USER_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    // Validate role change permissions
    if (validatedData.role && validatedData.role !== existingUser.role) {
      const canChangeRole = await validateRoleChangePermission(
        authContext.user.role,
        existingUser.role,
        validatedData.role
      )

      if (!canChangeRole.allowed) {
        return NextResponse.json(
          { 
            error: canChangeRole.reason,
            errorCode: 'ROLE_CHANGE_DENIED'
          },
          { status: 403 }
        )
      }
    }

    // Validate organization change
    if (validatedData.organizationId !== undefined && validatedData.organizationId !== existingUser.organization_id) {
      if (validatedData.organizationId) {
        const org = await prisma.organization.findUnique({
          where: { id: validatedData.organizationId }
        })
        
        if (!org) {
          return NextResponse.json(
            { 
              error: 'Organization not found',
              errorCode: 'ORGANIZATION_NOT_FOUND'
            },
            { status: 400 }
          )
        }
      }
    }

    // Check email uniqueness if email is being changed
    if (validatedData.email && validatedData.email.toLowerCase() !== existingUser.email.toLowerCase()) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email: {
            equals: validatedData.email.toLowerCase(),
            mode: 'insensitive'
          },
          id: { not: userId }
        }
      })

      if (emailExists) {
        return NextResponse.json(
          { 
            error: 'A user with this email address already exists',
            errorCode: 'EMAIL_ALREADY_EXISTS'
          },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: any = {}

    if (validatedData.name) {
      const nameParts = validatedData.name.trim().split(' ')
      updateData.first_name = nameParts[0]
      updateData.last_name = nameParts.slice(1).join(' ') || nameParts[0]
    }

    if (validatedData.email) {
      updateData.email = validatedData.email.toLowerCase()
    }

    if (validatedData.role) {
      updateData.role = validatedData.role
    }

    if (validatedData.organizationId !== undefined) {
      updateData.organization_id = validatedData.organizationId
    }

    if (validatedData.isActive !== undefined) {
      updateData.is_active = validatedData.isActive
    }

    if (validatedData.password) {
      updateData.password_hash = await bcrypt.hash(validatedData.password, 12)
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        name: `${updatedUser.first_name} ${updatedUser.last_name}`,
        email: updatedUser.email,
        role: updatedUser.role,
        organizationId: updatedUser.organization_id,
        organizationName: updatedUser.organization?.name,
        firmNumber: updatedUser.organization?.firm_number,
        isActive: updatedUser.is_active,
        updatedAt: updatedUser.updated_at
      },
      updatedBy: {
        id: authContext.user.id,
        name: `${authContext.user.firstName} ${authContext.user.lastName}`,
        role: authContext.user.role
      }
    })

  } catch (error) {
    console.error('Admin user update error:', error)

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
        error: 'Failed to update user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/users/[id]
 * Get user details (admin access required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require admin access
    const authContext = await requireAdminAccess()
    const { id: userId } = await params

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            firm_number: true,
            is_firm: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { 
          error: 'User not found',
          errorCode: 'USER_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        organizationName: user.organization?.name,
        firmNumber: user.organization?.firm_number,
        isFirm: user.organization?.is_firm,
        isActive: user.is_active,
        emailVerified: user.email_verified,
        lastLoginAt: user.last_login_at,
        loginCount: user.login_count,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    })

  } catch (error) {
    console.error('Admin user get error:', error)

    // Handle authentication errors
    if (error && typeof error === 'object' && 'code' in error) {
      return handleAuthError(error)
    }

    return NextResponse.json(
      { 
        error: 'Failed to retrieve user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Deactivate user account (admin access required)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require admin access
    const authContext = await requireAdminAccess()
    const { id: userId } = await params

    // Prevent self-deletion
    if (userId === authContext.user.id) {
      return NextResponse.json(
        { 
          error: 'Cannot delete your own account',
          errorCode: 'SELF_DELETION_DENIED'
        },
        { status: 400 }
      )
    }

    // Get user to check if exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json(
        { 
          error: 'User not found',
          errorCode: 'USER_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    // Deactivate user instead of hard delete
    const deactivatedUser = await prisma.user.update({
      where: { id: userId },
      data: { is_active: false }
    })

    return NextResponse.json({
      success: true,
      message: 'User account deactivated successfully',
      userId: deactivatedUser.id,
      deactivatedBy: {
        id: authContext.user.id,
        name: `${authContext.user.firstName} ${authContext.user.lastName}`,
        role: authContext.user.role
      }
    })

  } catch (error) {
    console.error('Admin user delete error:', error)

    // Handle authentication errors
    if (error && typeof error === 'object' && 'code' in error) {
      return handleAuthError(error)
    }

    return NextResponse.json(
      { 
        error: 'Failed to deactivate user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Validates role change permissions
 * Validates: Requirements 2.4, 2.5
 */
async function validateRoleChangePermission(
  adminRole: 'SUPER_ADMIN' | 'ADMIN' | 'CLIENT',
  currentRole: UserRole,
  newRole: UserRole
): Promise<{ allowed: boolean; reason?: string }> {
  // Super admin can change any role - Requirements 2.4
  if (adminRole === 'SUPER_ADMIN') {
    return { allowed: true }
  }

  // Admin can only manage client accounts - Requirements 2.5
  if (adminRole === 'ADMIN') {
    // Can only change client roles
    if (currentRole !== UserRole.CLIENT) {
      return { allowed: false, reason: 'Admins can only manage client accounts' }
    }
    
    // Can only change to client role
    if (newRole !== UserRole.CLIENT) {
      return { allowed: false, reason: 'Admins can only set client role' }
    }
    
    return { allowed: true }
  }

  return { allowed: false, reason: 'Insufficient permissions' }
}