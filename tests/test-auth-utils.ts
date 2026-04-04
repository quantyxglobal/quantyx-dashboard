import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Service role client for admin operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Regular client for authenticated operations
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)

export interface TestUser {
  id: string
  email: string
  password: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'CLIENT'
  organizationId?: string
  firstName: string
  lastName: string
}

export interface TestOrganization {
  id: string
  name: string
  firmNumber?: string
  isFirm: boolean
}

/**
 * Create a test organization with proper firm numbering
 */
export async function createTestOrganization(
  name: string,
  isFirm: boolean = true
): Promise<{ data: TestOrganization | null; error: any }> {
  try {
    // Get next firm number if this is a firm
    let firmNumber: string | undefined
    if (isFirm) {
      const { data: lastFirm } = await supabaseAdmin
        .from('organizations')
        .select('firm_number')
        .not('firm_number', 'is', null)
        .order('firm_number', { ascending: false })
        .limit(1)
        .single()

      const nextNumber = lastFirm?.firm_number 
        ? parseInt(lastFirm.firm_number) + 1
        : 1
      firmNumber = nextNumber.toString().padStart(3, '0')
    }

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .insert({
        name,
        display_name: name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        firm_number: firmNumber,
        is_firm: isFirm,
        case_id_prefix: 'QGM',
        firm_case_counter: 0
      })
      .select()
      .single()

    if (error) {
      console.error('Organization creation error:', error)
      return { data: null, error: JSON.stringify(error) }
    }

    return {
      data: {
        id: data.id,
        name: data.name,
        firmNumber: data.firm_number,
        isFirm: data.is_firm
      },
      error: null
    }
  } catch (error) {
    console.error('Organization creation exception:', error)
    return { data: null, error: error instanceof Error ? error.message : JSON.stringify(error) }
  }
}

/**
 * Create a test user with proper authentication setup
 */
export async function createTestUser(
  email: string,
  password: string,
  role: 'SUPER_ADMIN' | 'ADMIN' | 'CLIENT',
  firstName: string = 'Test',
  lastName: string = 'User',
  organizationId?: string
): Promise<{ data: TestUser | null; error: any }> {
  try {
    // First create user in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName
      }
    })

    if (authError || !authUser.user) {
      console.error('Auth user creation error:', authError)
      return { data: null, error: JSON.stringify(authError) }
    }

    // Then insert the user record in the database with the same ID
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id, // Use the same ID from auth
        email: email.toLowerCase(),
        first_name: firstName,
        last_name: lastName,
        role,
        organization_id: organizationId,
        is_active: true,
        email_verified: true
      })
      .select()
      .single()

    if (error) {
      console.error('User database record creation error:', error)
      // Clean up auth user if database insert fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      return { data: null, error: JSON.stringify(error) }
    }

    return {
      data: {
        id: data.id,
        email: data.email,
        password,
        role: data.role,
        organizationId: data.organization_id,
        firstName: data.first_name,
        lastName: data.last_name
      },
      error: null
    }
  } catch (error) {
    console.error('User creation exception:', error)
    return { data: null, error: error instanceof Error ? error.message : JSON.stringify(error) }
  }
}

/**
 * Sign in as a test user and return authenticated client
 */
export async function signInAsTestUser(
  email: string,
  password: string
): Promise<{ client: any; user: any; error: any }> {
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      return { client: null, user: null, error }
    }

    return {
      client: supabaseClient,
      user: data.user,
      error: null
    }
  } catch (error) {
    return { client: null, user: null, error }
  }
}

/**
 * Legacy function name for backward compatibility
 */
export const signInTestUser = signInAsTestUser

/**
 * Create a test case with proper organization association
 */
export async function createTestCase(
  authenticatedClient: any,
  organizationId: string,
  title: string,
  ownerId: string
): Promise<{ data: any; error: any }> {
  try {
    // Get organization to determine case number
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('firm_number, firm_case_counter')
      .eq('id', organizationId)
      .single()

    if (!org) {
      return { data: null, error: 'Organization not found' }
    }

    // Generate case number
    const caseNumber = org.firm_case_counter + 1
    const caseId = `QGM_${org.firm_number}_${caseNumber.toString().padStart(4, '0')}`

    // Update organization case counter
    await supabaseAdmin
      .from('organizations')
      .update({ firm_case_counter: caseNumber })
      .eq('id', organizationId)

    // Create case using authenticated client
    const { data, error } = await authenticatedClient
      .from('cases')
      .insert({
        case_number: caseId,
        title,
        description: `Test case for ${title}`,
        client_name: 'Test Client',
        client_email: 'test@example.com',
        organization_id: organizationId,
        owner_id: ownerId,
        status: 'PENDING',
        priority: 'NORMAL'
      })
      .select()
      .single()

    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Clean up test data
 */
export async function cleanupTestData(
  userIds: string[] = [],
  organizationIds: string[] = [],
  caseIds: string[] = []
): Promise<void> {
  try {
    // Clean up in reverse dependency order
    if (caseIds.length > 0) {
      await supabaseAdmin.from('cases').delete().in('id', caseIds)
    }
    
    if (userIds.length > 0) {
      // Delete from auth first, then from database
      for (const userId of userIds) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId)
        } catch (error) {
          console.warn(`Failed to delete auth user ${userId}:`, error)
        }
      }
      // Database records should be cleaned up by cascade or triggers
    }
    
    if (organizationIds.length > 0) {
      await supabaseAdmin.from('organizations').delete().in('id', organizationIds)
    }
  } catch (error) {
    console.error('Cleanup error:', error)
  }
}

/**
 * Sign out current user
 */
export async function signOutTestUser(): Promise<void> {
  await supabaseClient.auth.signOut()
}

/**
 * Create a complete test scenario with firm, users, and cases
 */
export async function createTestScenario(firmName: string = 'Test Firm') {
  // Add timestamp to make names unique
  const timestamp = Date.now()
  const uniqueFirmName = `${firmName} ${timestamp}`
  
  // Create firm
  const firm = await createTestOrganization(uniqueFirmName, true)
  if (firm.error || !firm.data) {
    throw new Error(`Failed to create test firm: ${firm.error}`)
  }

  // Check if super admin already exists
  const { data: existingSuperAdmin } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .eq('role', 'SUPER_ADMIN')
    .limit(1)
    .single()

  let superAdmin: any
  if (existingSuperAdmin) {
    // Use existing super admin
    superAdmin = {
      data: {
        id: existingSuperAdmin.id,
        email: existingSuperAdmin.email,
        password: 'password123', // We'll assume this for testing
        role: 'SUPER_ADMIN',
        firstName: 'Existing',
        lastName: 'SuperAdmin'
      },
      error: null
    }
  } else {
    // Create new super admin
    superAdmin = await createTestUser(
      `superadmin-${timestamp}@test.com`,
      'password123',
      'SUPER_ADMIN',
      'Super',
      'Admin'
    )
    if (superAdmin.error || !superAdmin.data) {
      throw new Error(`Failed to create super admin: ${superAdmin.error}`)
    }
  }

  // Create admin (no organization)
  const admin = await createTestUser(
    `admin-${timestamp}@test.com`,
    'password123',
    'ADMIN',
    'Test',
    'Admin'
  )
  if (admin.error || !admin.data) {
    throw new Error(`Failed to create admin: ${admin.error}`)
  }

  // Create client in firm
  const client = await createTestUser(
    `client-${timestamp}@test.com`,
    'password123',
    'CLIENT',
    'Test',
    'Client',
    firm.data.id
  )
  if (client.error || !client.data) {
    throw new Error(`Failed to create client: ${client.error}`)
  }

  return {
    firm: firm.data,
    superAdmin: superAdmin.data,
    admin: admin.data,
    client: client.data,
    cleanup: async () => {
      await cleanupTestData(
        [admin.data!.id, client.data!.id], // Don't delete existing super admin
        [firm.data!.id]
      )
    }
  }
}