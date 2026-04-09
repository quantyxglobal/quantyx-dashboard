'use server'

import { auth } from '@/auth'
import { SupabaseDB } from '@/lib/supabase-db'
import { createEmailService } from '@/lib/supabase-email-service'
import { z } from 'zod'

const getInviteSchema = () => z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['client', 'CLIENT'], { message: 'Please select a role' }),
  firmId: z.string().uuid('Invalid firm ID')
})

export async function inviteUser(formData: FormData) {
  const session = await auth()
  
  // Only authenticated client users can invite others
  if (!session || session.user.role !== 'CLIENT') {
    return { 
      success: false, 
      error: 'Unauthorized: Client access required' 
    }
  }

  try {
    // Validate input
    const data = getInviteSchema().parse({
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      role: formData.get('role'),
      firmId: formData.get('firmId'),
    })

    // Normalize email to lowercase
    const normalizedEmail = data.email.toLowerCase()

    // Verify the inviter belongs to the firm they're inviting to
    const inviter = await SupabaseDB.getUserById(session.user.id)

    if (!inviter || !inviter.organization_id || inviter.organization_id !== data.firmId) {
      return {
        success: false,
        error: 'You can only invite users to your own organization'
      }
    }

    // Check if user already exists
    const existingUser = await SupabaseDB.getUserByEmail(normalizedEmail)

    if (existingUser) {
      return {
        success: false,
        error: 'A user with this email address already exists'
      }
    }

    // Create user account with auto-generated password
    const emailService = createEmailService()
    const fullName = `${data.firstName} ${data.lastName}`
    const userResult = await emailService.createUserWithPassword(
      normalizedEmail,
      fullName,
      data.firmId,
      'client',
      `${inviter.first_name} ${inviter.last_name}`
    )

    if (!userResult.success) {
      return {
        success: false,
        error: userResult.error || 'Failed to create user account'
      }
    }

    return {
      success: true,
      message: `User account created successfully for ${fullName}. Login credentials have been sent via email.`,
      userId: userResult.userId,
      temporaryPassword: userResult.temporaryPassword // For admin reference only
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0].message
      }
    }
    
    console.error('Error sending user invitation:', error)
    return {
      success: false,
      error: 'Failed to send invitation. Please try again.'
    }
  }
}