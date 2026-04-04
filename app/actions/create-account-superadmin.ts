'use server'

import { auth } from '@/auth'
import { SupabaseDB } from '@/lib/supabase-db'
import { supabaseEmailService } from '@/lib/supabase-email-service'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const createAccountSchema = z.object({
  accountType: z.enum(['ADMIN', 'CLIENT', 'EMPLOYEE']),
  organizationId: z.string().nullable().optional(),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').nullable().optional(),
  sendWelcomeEmail: z.boolean().default(true),
})

function generateSecurePassword(): string {
  const length = 16
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return password
}

export async function createAccountBySuperAdmin(formData: FormData) {
  const session = await auth()
  
  // Verify super admin role from database
  if (!session?.user?.id) {
    return { 
      success: false, 
      error: 'Unauthorized: Authentication required' 
    }
  }

  const currentUser = await SupabaseDB.getUserById(session.user.id)
  
  if (currentUser?.role !== 'SUPER_ADMIN') {
    return { 
      success: false, 
      error: 'Unauthorized: Super Admin access required' 
    }
  }

  try {
    // Log form data for debugging
    console.log('[CREATE_ACCOUNT] Form data received:', {
      accountType: formData.get('accountType'),
      organizationId: formData.get('organizationId'),
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      hasPassword: !!formData.get('password'),
      sendWelcomeEmail: formData.get('sendWelcomeEmail'),
    })

    // Validate input
    const rawOrgId = formData.get('organizationId')
    const orgId = rawOrgId === 'none' || !rawOrgId ? undefined : String(rawOrgId)
    const rawPassword = formData.get('password')
    const passwordValue = rawPassword ? String(rawPassword) : null
    
    const data = createAccountSchema.parse({
      accountType: formData.get('accountType'),
      organizationId: orgId,
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      password: passwordValue,
      sendWelcomeEmail: formData.get('sendWelcomeEmail') === 'true',
    })

    console.log('[CREATE_ACCOUNT] Validated data:', {
      accountType: data.accountType,
      organizationId: data.organizationId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
    })

    // Validate organization requirement based on account type
    if (data.accountType === 'CLIENT' && !data.organizationId) {
      return {
        success: false,
        error: 'Client accounts must be assigned to an organization'
      }
    }

    if (data.accountType === 'EMPLOYEE' && !data.organizationId) {
      return {
        success: false,
        error: 'Employee accounts must be assigned to Quantyx Global organization'
      }
    }

    // Check if email already exists
    console.log('[CREATE_ACCOUNT] Checking if email exists:', data.email.toLowerCase())
    const existingUser = await SupabaseDB.getUserByEmail(data.email.toLowerCase())

    if (existingUser) {
      console.log('[CREATE_ACCOUNT] Email already exists')
      return { 
        success: false, 
        error: 'Email address already in use' 
      }
    }
    console.log('[CREATE_ACCOUNT] Email is available')

    // Verify organization exists if provided
    let organization = null
    if (data.organizationId) {
      console.log('[CREATE_ACCOUNT] Verifying organization:', data.organizationId)
      organization = await SupabaseDB.getOrganizationById(data.organizationId)
      if (!organization) {
        console.log('[CREATE_ACCOUNT] Organization not found')
        return {
          success: false,
          error: 'Organization not found'
        }
      }
      console.log('[CREATE_ACCOUNT] Organization verified:', organization.name)
    }

    let password: string
    let passwordHash: string

    // Generate or use provided password
    if (!data.password) {
      password = generateSecurePassword()
      passwordHash = await bcrypt.hash(password, 12)
      console.log('[CREATE_ACCOUNT] Generated password for user')
    } else {
      password = data.password
      passwordHash = await bcrypt.hash(data.password, 12)
      console.log('[CREATE_ACCOUNT] Using provided password')
    }

    // Create user account
    console.log('[CREATE_ACCOUNT] Creating user with data:', {
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email.toLowerCase(),
      role: data.accountType,
      organization_id: data.organizationId || null
    })
    
    const user = await SupabaseDB.createUser({
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email.toLowerCase(),
      password_hash: passwordHash,
      role: data.accountType,
      organization_id: data.organizationId || null,
      mfa_setup_required: true // Require MFA setup on first login
    })

    console.log('[CREATE_ACCOUNT] User created successfully:', user.id)

    if (!user) {
      return {
        success: false,
        error: 'Failed to create user account'
      }
    }

    // Log audit action
    console.log('[CREATE_ACCOUNT] Creating audit log')
    await SupabaseDB.createAuditLog({
      action: 'CREATE',
      entity_type: 'user',
      entity_id: user.id,
      user_id: user.id,
      organization_id: data.organizationId || currentUser.organization_id || '',
      new_values: {
        account_type: data.accountType,
        email: data.email.toLowerCase(),
        name: `${data.firstName} ${data.lastName}`,
        organization_id: data.organizationId
      }
    })
    console.log('[CREATE_ACCOUNT] Audit log created')

    // Send account creation notification to support@quantyxg.com with credentials
    try {
      console.log('[CREATE_ACCOUNT] Sending email notification to support@quantyxg.com')
      const emailResult = await supabaseEmailService.sendAccountCreatedNotification(
        user.id,
        data.email.toLowerCase(),
        password,
        data.accountType,
        `${currentUser.first_name} ${currentUser.last_name}`
      )
      console.log('[CREATE_ACCOUNT] Email notification result:', emailResult)
    } catch (emailError) {
      console.error('[CREATE_ACCOUNT] Failed to send account creation notification:', emailError)
      // Don't fail the operation if email fails
    }

    // Send welcome email to the new user with credentials
    try {
      console.log('[CREATE_ACCOUNT] Sending welcome email to user:', data.email.toLowerCase())
      const welcomeResult = await supabaseEmailService.sendWelcomeEmailToUser(
        data.email.toLowerCase(),
        password,
        data.firstName,
        data.accountType
      )
      console.log('[CREATE_ACCOUNT] Welcome email result:', welcomeResult)
    } catch (emailError) {
      console.error('[CREATE_ACCOUNT] Failed to send welcome email to user:', emailError)
      // Don't fail the operation if email fails
    }

    return { 
      success: true, 
      message: `${data.accountType === 'ADMIN' ? 'Admin' : data.accountType === 'EMPLOYEE' ? 'Employee' : 'Client'} account created successfully for ${data.firstName} ${data.lastName}${!data.password ? '. Login credentials have been generated.' : ''}`,
      userId: user.id,
      temporaryPassword: !data.password ? password : undefined
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[CREATE_ACCOUNT] Validation error:', error.issues)
      return { 
        success: false, 
        error: `Validation error: ${error.issues[0].message}` 
      }
    }
    
    console.error('[CREATE_ACCOUNT] Error creating account:', error)
    return { 
      success: false, 
      error: 'Failed to create account. Please try again.' 
    }
  }
}
