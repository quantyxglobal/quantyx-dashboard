'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAuditAction } from '@/lib/audit-log'
import { z } from 'zod'

const assignUserSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  firmId: z.string().uuid('Invalid firm ID'),
})

export async function assignUserToFirm(formData: FormData) {
  const session = await auth()
  
  // Only admin and super admin users can assign users to firms
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return { 
      success: false, 
      error: 'Unauthorized: Admin access required' 
    }
  }

  try {
    // Validate input
    const data = assignUserSchema.parse({
      userId: formData.get('userId'),
      firmId: formData.get('firmId'),
    })

    // Verify user exists and is not already assigned to an organization
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      include: { organization: true }
    })

    if (!user) {
      return {
        success: false,
        error: 'User not found'
      }
    }

    if (user.organization_id) {
      return {
        success: false,
        error: `User is already assigned to organization: ${user.organization?.name || 'Unknown'}`
      }
    }

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.firmId }
    })

    if (!organization) {
      return {
        success: false,
        error: 'Organization not found'
      }
    }

    // Assign user to organization
    const updatedUser = await prisma.user.update({
      where: { id: data.userId },
      data: { organization_id: data.firmId },
      include: { organization: true }
    })

    // Log audit action
    await logAuditAction({
      userId: data.userId,
      action: 'user_assigned_to_firm',
      details: `Admin ${session.user.name} assigned user ${user.first_name} ${user.last_name} (${user.email}) to organization: ${organization.name}`,
      adminId: session.user.id
    })

    return { 
      success: true, 
      message: `${user.first_name} ${user.last_name} has been successfully assigned to ${organization.name}`,
      userId: updatedUser.id,
      firmId: organization.id
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: error.issues[0].message 
      }
    }
    
    console.error('Error assigning user to firm:', error)
    return { 
      success: false, 
      error: 'Failed to assign user to firm. Please try again.' 
    }
  }
}