'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logAuditAction } from '@/lib/audit-log'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { createEmailService } from '@/lib/email-service-factory'

const createClientSchema = z.object({
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters'),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  clientEmail: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  sendWelcomeEmail: z.boolean().default(true),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
})

export async function createClientAccount(formData: FormData) {
  const session = await auth()
  
  // Only admins and super admins can create client accounts
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return { 
      success: false, 
      error: 'Unauthorized: Admin access required' 
    }
  }

  try {
    // Validate input
    const data = createClientSchema.parse({
      organizationName: formData.get('organizationName'),
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      clientEmail: formData.get('clientEmail'),
      password: formData.get('password'),
      sendWelcomeEmail: formData.get('sendWelcomeEmail') === 'true',
      addressLine1: formData.get('addressLine1'),
      addressLine2: formData.get('addressLine2'),
      city: formData.get('city'),
      state: formData.get('state'),
      country: formData.get('country'),
    })

    const fullName = `${data.firstName} ${data.lastName}`

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.clientEmail.toLowerCase() }
    })

    if (existingUser) {
      return { 
        success: false, 
        error: 'Email address already in use' 
      }
    }

    let passwordHash: string
    let temporaryPassword: string | undefined

    // Generate password if not provided
    if (!data.password) {
      const emailService = createEmailService()
      const userResult = await emailService.createUserWithPassword(
        data.clientEmail.toLowerCase(),
        fullName,
        '', // No firm ID for direct client accounts
        'client',
        session.user.name || session.user.email
      )

      if (!userResult.success) {
        return {
          success: false,
          error: userResult.error || 'Failed to create client account'
        }
      }

      return {
        success: true,
        message: `Client account created successfully for ${fullName}. Login credentials have been sent via email.`,
        userId: userResult.userId,
        temporaryPassword: userResult.temporaryPassword // For admin reference only
      }
    } else {
      // Use provided password
      passwordHash = await bcrypt.hash(data.password, 12)
    }

    // Create client organization and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create or find client organization
      let organization = await tx.organization.findFirst({
        where: { name: data.organizationName }
      })

      if (!organization) {
        organization = await tx.organization.create({
          data: {
            name: data.organizationName,
            display_name: data.organizationName,
            slug: data.organizationName.toLowerCase().replace(/\s+/g, '-'),
            is_firm: true, // Client organizations are always law firms
            address_line1: data.addressLine1 || null,
            address_line2: data.addressLine2 || null,
            city: data.city || null,
            state: data.state || null,
            country: data.country || null,
          }
        })
      } else if (data.addressLine1 || data.city || data.state || data.country) {
        // Update organization address if provided and organization exists
        organization = await tx.organization.update({
          where: { id: organization.id },
          data: {
            address_line1: data.addressLine1 || organization.address_line1,
            address_line2: data.addressLine2 || organization.address_line2,
            city: data.city || organization.city,
            state: data.state || organization.state,
            country: data.country || organization.country,
          }
        })
      }

      // Create user account
      const user = await tx.user.create({
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.clientEmail.toLowerCase(),
          password_hash: passwordHash,
          role: 'CLIENT',
          organization_id: organization.id
        }
      })

      return { organization, user }
    })

    // Send welcome email if requested and password was provided
    if (data.sendWelcomeEmail && data.password) {
      try {
        const emailService = createEmailService()
        await emailService.sendUserCreatedWithPasswordEmail(
          data.clientEmail.toLowerCase(),
          fullName,
          data.organizationName,
          data.password, // Send the provided password
          session.user.name || session.user.email
        )
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError)
        // Don't fail the operation if email fails
      }
    }

    // Log audit action
    await logAuditAction({
      userId: result.user.id,
      action: 'client_account_created',
      details: `Admin ${session.user.name} created client account for ${fullName} (${data.clientEmail}) in organization ${data.organizationName}`,
      adminId: session.user.id
    })

    return { 
      success: true, 
      message: `Client account created successfully for ${fullName}`,
      organizationId: result.organization.id,
      userId: result.user.id
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: error.issues[0].message 
      }
    }
    
    console.error('Error creating client account:', error)
    return { 
      success: false, 
      error: 'Failed to create client account. Please try again.' 
    }
  }
}
