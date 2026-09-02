'use server'

import { auth } from '@/auth'
import { SupabaseDB } from '@/lib/supabase-db'
import { logAuditAction } from '@/lib/audit-log'
import { z } from 'zod'
import { createEmailService } from '@/lib/email-service-factory'

const createFirmSchema = z.object({
  name: z.string().min(2, 'Firm name must be at least 2 characters'),
  adminName: z.preprocess(
    (val) => (val === null || val === '' ? undefined : val),
    z.string().min(2, 'Admin name must be at least 2 characters').optional()
  ),
  adminEmail: z.preprocess(
    (val) => (val === null || val === '' ? undefined : val),
    z.string().email('Invalid admin email address').optional()
  ),
})

export async function createFirm(formData: FormData) {
  const session = await auth()
  
  // Only admin and super admin users can create firms
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    console.error('[CREATE_FIRM] Unauthorized access attempt')
    return { 
      success: false, 
      error: 'Unauthorized: Admin access required' 
    }
  }

  try {
    console.log('[CREATE_FIRM] Starting firm creation for user:', session.user.email)
    
    // Validate input
    const data = createFirmSchema.parse({
      name: formData.get('name'),
      adminName: formData.get('adminName'),
      adminEmail: formData.get('adminEmail'),
    })
    
    console.log('[CREATE_FIRM] Validated data:', { name: data.name, hasAdminEmail: !!data.adminEmail })

    // Check if organization with this name already exists (case-insensitive) using Supabase
    const existingOrganization = await SupabaseDB.getOrganizationByName(data.name)

    if (existingOrganization) {
      console.log('[CREATE_FIRM] Organization already exists:', data.name)
      return { 
        success: false, 
        error: 'An organization with this name already exists' 
      }
    }

    console.log('[CREATE_FIRM] Getting next firm sequence...')
    // Get next firm sequence number
    const nextFirmNumber = await SupabaseDB.getNextFirmSequence()
    const firmNumber = nextFirmNumber.toString().padStart(3, '0')
    console.log('[CREATE_FIRM] Assigned firm number:', firmNumber)

    console.log('[CREATE_FIRM] Creating organization in database using Supabase...')
    // Create organization (law firm) using Supabase for better reliability
    const organization = await SupabaseDB.createOrganization({
      name: data.name,
      display_name: data.name,
      slug: data.name.toLowerCase().replace(/\s+/g, '-'),
      is_firm: true,
      firm_number: firmNumber,
      firm_created_at: new Date(),
      firm_case_counter: 0
    })
    
    console.log('[CREATE_FIRM] Organization created successfully:', organization.id)

    // Send organization creation notification if admin details provided
    if (data.adminEmail && data.adminName) {
      try {
        console.log('[CREATE_FIRM] Sending notification email...')
        const emailService = createEmailService()
        await emailService.sendFirmCreatedNotification(
          data.name,
          data.adminEmail,
          data.adminName,
          session.user.name || session.user.email
        )
        console.log('[CREATE_FIRM] Notification email sent successfully')
      } catch (emailError) {
        console.error('[CREATE_FIRM] Failed to send organization creation notification:', emailError)
        // Don't fail the operation if email fails
      }
    }

    console.log('[CREATE_FIRM] Logging audit action...')
    // Log audit action
    await logAuditAction({
      userId: session.user.id,
      action: 'firm_created',
      details: `Admin ${session.user.name} created organization: ${data.name}`,
      adminId: session.user.id
    })

    console.log('[CREATE_FIRM] Firm creation completed successfully')
    return { 
      success: true, 
      message: `Organization "${data.name}" created successfully`,
      organizationId: organization.id
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[CREATE_FIRM] Validation error:', error.issues)
      return { 
        success: false, 
        error: error.issues[0].message 
      }
    }
    
    console.error('[CREATE_FIRM] Unexpected error:', error)
    console.error('[CREATE_FIRM] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('[CREATE_FIRM] Error details:', JSON.stringify(error, null, 2))
    
    // Return more specific error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { 
      success: false, 
      error: `Failed to create organization: ${errorMessage}. Please try again.` 
    }
  }
}