'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAuditAction } from '@/lib/audit-log'
import { z } from 'zod'
import { createEmailService } from '@/lib/email-service-factory'

const createFirmSchema = z.object({
  name: z.string().min(2, 'Firm name must be at least 2 characters'),
  adminName: z.string().min(2, 'Admin name must be at least 2 characters').optional(),
  adminEmail: z.string().email('Invalid admin email address').optional(),
})

export async function createFirm(formData: FormData) {
  const session = await auth()
  
  // Only admin and super admin users can create firms
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return { 
      success: false, 
      error: 'Unauthorized: Admin access required' 
    }
  }

  try {
    // Validate input
    const data = createFirmSchema.parse({
      name: formData.get('name'),
      adminName: formData.get('adminName'),
      adminEmail: formData.get('adminEmail'),
    })

    // Check if organization with this name already exists (case-insensitive)
    const existingOrganization = await prisma.organization.findFirst({
      where: { 
        name: {
          equals: data.name,
          mode: 'insensitive'
        }
      }
    })

    if (existingOrganization) {
      return { 
        success: false, 
        error: 'An organization with this name already exists' 
      }
    }

    // Create organization
    const organization = await prisma.organization.create({
      data: {
        name: data.name,
        display_name: data.name,
        slug: data.name.toLowerCase().replace(/\s+/g, '-')
      }
    })

    // Send organization creation notification if admin details provided
    if (data.adminEmail && data.adminName) {
      try {
        const emailService = createEmailService()
        await emailService.sendFirmCreatedNotification(
          data.name,
          data.adminEmail,
          data.adminName,
          session.user.name || session.user.email
        )
      } catch (emailError) {
        console.error('Failed to send organization creation notification:', emailError)
        // Don't fail the operation if email fails
      }
    }

    // Log audit action
    await logAuditAction({
      userId: session.user.id,
      action: 'firm_created',
      details: `Admin ${session.user.name} created organization: ${data.name}`,
      adminId: session.user.id
    })

    return { 
      success: true, 
      message: `Organization "${data.name}" created successfully`,
      organizationId: organization.id
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: error.issues[0].message 
      }
    }
    
    console.error('Error creating organization:', error)
    return { 
      success: false, 
      error: 'Failed to create organization. Please try again.' 
    }
  }
}