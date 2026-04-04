'use server'

import { SupabaseDB } from '@/lib/supabase-db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const registerSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  firmName: z.string().min(2, 'Firm name must be at least 2 characters'),
  addressLine1: z.string().min(1, 'Address is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  country: z.string().min(1, 'Country is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
})

export async function registerUser(formData: FormData) {
  try {
    // Validate input
    const data = registerSchema.parse({
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      firmName: formData.get('firmName'),
      addressLine1: formData.get('addressLine1'),
      addressLine2: formData.get('addressLine2') || undefined,
      city: formData.get('city'),
      state: formData.get('state'),
      country: formData.get('country'),
      password: formData.get('password'),
    })

    // Normalize email to lowercase for case-insensitive checking
    const normalizedEmail = data.email.toLowerCase()

    // Check if email already exists using SupabaseDB
    const existingUser = await SupabaseDB.getUserByEmail(normalizedEmail)

    if (existingUser) {
      return { 
        success: false, 
        error: 'An account with this email address already exists' 
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12)

    // Check if organization already exists (case-insensitive)
    let organization = await SupabaseDB.getOrganizationByName(data.firmName)

    if (organization) {
      // Organization exists - get existing users to show contact info
      const existingUsers = await SupabaseDB.getUsersByOrganizationId(organization.id)
      
      // Filter to get only active client users
      const clientUsers = existingUsers.filter((u: any) => 
        u.role === 'CLIENT' && u.is_active
      )
      
      if (clientUsers.length > 0) {
        // Get the first client user's email (masked for privacy)
        const firstUser = clientUsers[0]
        const maskedEmail = firstUser.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
        
        return {
          success: false,
          error: 'Organization Already Exists',
          firmExists: true,
          message: `The organization "${data.firmName}" already exists in our system. To join this organization, please contact your colleague at ${maskedEmail} to send you an invitation. Alternatively, you can contact our support team at support@quantyxg.com for assistance.`
        }
      }
    }

    if (!organization) {
      // Get the next firm ID from system settings (managed by superadmin)
      const nextFirmId = await SupabaseDB.getAndIncrementNextFirmId()

      // Create new organization with address
      organization = await SupabaseDB.createOrganization({
        name: data.firmName,
        display_name: data.firmName,
        slug: data.firmName.toLowerCase().replace(/\s+/g, '-'),
        case_counter: 0, // Start case counter at 0 for new organizations
        case_id_prefix: data.firmName.substring(0, 3).toUpperCase(),
        is_firm: true,
        firm_number: nextFirmId.toString(),
        address_line1: data.addressLine1,
        address_line2: data.addressLine2 || null,
        city: data.city,
        state: data.state,
        country: data.country
      })
    }

    // Create user account with MFA setup required
    const user = await SupabaseDB.createUser({
      first_name: data.firstName,
      last_name: data.lastName,
      email: normalizedEmail,
      password_hash: passwordHash,
      role: 'CLIENT',
      organization_id: organization.id,
      is_active: true,
      mfa_setup_required: true // Require MFA setup on first login
    })

    // Log audit action (best effort - don't fail registration if logging fails)
    try {
      await SupabaseDB.createAuditLog({
        user_id: user.id,
        action: 'user_registered',
        details: `User ${data.firstName} ${data.lastName} (${normalizedEmail}) registered and joined organization: ${data.firmName}`,
        entity_type: 'user',
        entity_id: user.id,
        organization_id: organization.id
      })
    } catch (auditError) {
      console.error('[REGISTER] Audit logging failed:', auditError)
      // Continue with successful registration even if audit logging fails
    }

    return { 
      success: true, 
      message: `Account created successfully! Welcome to ${data.firmName}.`,
      organizationId: organization.id,
      userId: user.id
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: error.issues[0].message 
      }
    }
    
    console.error('[REGISTER] Error during user registration:', error)
    return { 
      success: false, 
      error: 'Registration failed. Please try again.' 
    }
  }
}