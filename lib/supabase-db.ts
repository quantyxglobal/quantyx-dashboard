
import { createClient } from '@supabase/supabase-js'

// Generate UUID without crypto module (Edge Runtime compatible)
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Create a singleton Supabase client
let supabaseClient: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (!supabaseClient) {
    console.log('[SUPABASE_CLIENT] Creating new Supabase client with service role')
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            // Increase timeout to 60 seconds
            signal: AbortSignal.timeout(60000)
          })
        }
      },
      db: {
        schema: 'public'
      }
    })
  }
  return supabaseClient
}

// Force recreate client (useful after RLS changes)
export function resetSupabaseClient() {
  console.log('[SUPABASE_CLIENT] Resetting Supabase client')
  supabaseClient = null
}

// Type definitions for better type safety
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'CLIENT' | 'STAFF' | 'EMPLOYEE'
export type CaseStatus = 'PENDING' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED' | 'DELIVERED' | 'ON_HOLD'
export type CasePriority = 'SUPER_RUSH' | 'EXPEDITE' | 'NORMAL'
export type FileSource = 'CASE_UPLOAD' | 'ADMIN_UPLOAD' | 'WEBSITE_QUOTE' | 'WEBSITE_CONTACT' | 'ADDITIONAL_REQUEST'
export type FileCategory = 'MEDICAL_RECORD' | 'LEGAL_DOCUMENT' | 'IMAGE' | 'OTHER'

/**
 * Optimized Database Operations
 */
export class SupabaseDB {
  private static client = getSupabaseClient()

  /**
   * Get user by email with organization
   */
  static async getUserByEmail(email: string) {
    const { data, error } = await this.client
      .from('users')
      .select(`
        *,
        organization:organizations(*)
      `)
      .eq('email', email)
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw error
    return data
  }

  /**
   * Get user by ID with organization
   */
  static async getUserById(userId: string) {
    const { data, error } = await this.client
      .from('users')
      .select(`
        *,
        organization:organizations(*)
      `)
      .eq('id', userId)
      .eq('is_active', true)
      .single()

    if (error) throw error
    return data
  }

  /**
   * Get user with organization and recent cases
   */
  static async getUserWithCases(userId: string, caseLimit: number = 50) {
    // Get user with organization
    const { data: user, error: userError } = await this.client
      .from('users')
      .select(`
        id,
        email,
        first_name,
        last_name,
        role,
        organization_id,
        organization:organizations(
          id,
          name,
          display_name,
          firm_number,
          is_firm,
          created_at
        )
      `)
      .eq('id', userId)
      .eq('is_active', true)
      .single()

    if (userError) throw userError

    // Get cases for the organization
    const { data: cases, error: casesError } = await this.client
      .from('cases')
      .select(`
        id,
        case_number,
        title,
        status,
        priority,
        created_at,
        due_date,
        client_name,
        estimated_cost
      `)
      .eq('organization_id', user.organization_id)
      .order('created_at', { ascending: false })
      .limit(caseLimit)

    if (casesError) throw casesError

    return {
      ...user,
      organization: {
        ...user.organization,
        cases: cases || []
      }
    }
  }

  /**
   * Get case by ID with all relations
   */
  static async getCaseById(caseId: string) {
    const { data, error } = await this.client
      .from('cases')
      .select(`
        *,
        organization:organizations(*),
        owner:users!cases_owner_id_fkey(id, first_name, last_name, email),
        case_services(
          id,
          service:services(id, name, slug, description)
        ),
        files(
          id,
          filename,
          original_filename,
          file_size,
          mime_type,
          s3_key,
          s3_bucket,
          s3_region,
          source,
          category,
          created_at,
          uploaded_by:users!files_uploaded_by_id_fkey(id, first_name, last_name)
        )
      `)
      .eq('id', caseId)
      .single()

    if (error) throw error
    return data
  }

  /**
   * Get all active services
   */
  static async getActiveServices() {
    const { data, error } = await this.client
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) throw error
    return data || []
  }

  /**
   * Get cases for organization
   */
  static async getCasesByOrganization(organizationId: string, limit: number = 50) {
    const { data, error } = await this.client
      .from('cases')
      .select(`
        id,
        case_number,
        title,
        status,
        priority,
        created_at,
        due_date,
        client_name,
        estimated_cost
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  }

  /**
   * Get files for a case
   */
  static async getFilesByCase(caseId: string) {
    const { data, error } = await this.client
      .from('files')
      .select(`
        id,
        filename,
        original_filename,
        file_size,
        mime_type,
        s3_key,
        s3_bucket,
        s3_region,
        source,
        category,
        created_at,
        uploaded_by:users!files_uploaded_by_id_fkey(id, first_name, last_name)
      `)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  // ==================== USER OPERATIONS ====================

  /**
   * Get basic user information
   */
  static async getUser(userId: string) {
    const { data, error } = await this.client
      .from('users')
      .select('id, organization_id, first_name, last_name, email, role, is_active, created_at')
      .eq('id', userId)
      .single()

    if (error) throw error
    return data
  }

  /**
   * Get user with organization information
   */
  static async getUserWithOrganization(userId: string) {
    const { data, error } = await this.client
      .from('users')
      .select(`
        id,
        organization_id,
        first_name,
        last_name,
        email,
        role,
        is_active,
        organization:organizations(
          id,
          name,
          display_name,
          firm_number,
          is_firm,
          created_at
        )
      `)
      .eq('id', userId)
      .single()

    if (error) throw error
    return data
  }

  /**
   * Get user with organization and cases
   */
  static async getUserWithOrganizationAndCases(userId: string, caseLimit: number = 50) {
    const { data: user, error: userError } = await this.client
      .from('users')
      .select(`
        organization_id,
        first_name,
        last_name,
        organization:organizations(
          name,
          display_name,
          firm_number,
          is_firm,
          created_at
        )
      `)
      .eq('id', userId)
      .single()

    if (userError) throw userError

    // Get cases separately
    const { data: cases, error: casesError } = await this.client
      .from('cases')
      .select(`
        id,
        case_number,
        title,
        status,
        priority,
        created_at,
        due_date,
        client_name,
        estimated_cost
      `)
      .eq('organization_id', user.organization_id)
      .order('created_at', { ascending: false })
      .limit(caseLimit)

    if (casesError) throw casesError

    return {
      organization_id: user.organization_id,
      first_name: user.first_name,
      last_name: user.last_name,
      organization: {
        ...user.organization,
        cases: cases || []
      }
    }
  }

  // ==================== ORGANIZATION OPERATIONS ====================

  /**
   * Get all organizations with case counts
   */
  static async getOrganizationsWithCaseCounts() {
    // Get organizations first
    const { data: orgs, error: orgError } = await this.client
      .from('organizations')
      .select('id, name, display_name, is_firm, firm_number, created_at')
      .order('name', { ascending: true })

    if (orgError) throw orgError

    // Get case counts for each organization
    const orgsWithCounts = []
    for (const org of orgs || []) {
      const { count } = await this.client
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
      
      orgsWithCounts.push({
        ...org,
        _count: {
          cases: count || 0
        }
      })
    }

    return orgsWithCounts
  }

  // ==================== CASE OPERATIONS ====================

  /**
   * Get all cases with organization information
   * For employees, only returns cases assigned to them via case_assignments table
   */
  static async getAllCasesWithOrganization(userId?: string, userRole?: string) {
    // If user is an employee, get cases from case_assignments
    if (userRole === 'EMPLOYEE' && userId) {
      return await this.getCasesByAssignedEmployee(userId)
    }

    // For non-employees, get all cases
    const { data: cases, error } = await this.client
      .from('cases')
      .select(`
        id,
        case_number,
        title,
        status,
        priority,
        created_at,
        updated_at,
        due_date,
        client_name,
        estimated_cost,
        organization_id,
        assigned_to_id,
        organization:organizations(
          id,
          name,
          display_name,
          firm_number
        )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Transform to match expected structure
    return cases?.map(caseItem => ({
      ...caseItem,
      organization: Array.isArray(caseItem.organization) ? caseItem.organization[0] : caseItem.organization
    })) || []
  }

  /**
   * Create a new case
   */
  static async createCase(caseData: {
    case_number: string
    title: string
    description?: string | null
    client_name: string
    client_email: string
    status: CaseStatus
    priority: CasePriority
    organization_id: string
    owner_id: string
    special_instructions?: string | null
    estimate_required: boolean
  }) {
    const { data, error } = await this.client
      .from('cases')
      .insert(caseData)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Update case status
   */
  static async updateCaseStatus(caseId: string, status: CaseStatus) {
    const { data, error } = await this.client
      .from('cases')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', caseId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // ==================== SERVICE OPERATIONS ====================

  /**
   * Get services by slugs
   */
  static async getServicesBySlugs(slugs: string[]) {
    const { data, error } = await this.client
      .from('services')
      .select('id, slug, name')
      .in('slug', slugs)
      .eq('is_active', true)

    if (error) throw error
    return data || []
  }

  /**
   * Get service by slug
   */
  static async getServiceBySlug(slug: string) {
    const { data, error } = await this.client
      .from('services')
      .select('id, slug, name, description')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw error
    return data
  }

  /**
   * Create case services
   */
  static async createCaseServices(caseServices: Array<{
    id: string
    case_id: string
    service_id: string
    created_at: string
    updated_at: string
  }>) {
    const { error } = await this.client
      .from('case_services')
      .insert(caseServices)

    if (error) throw error
  }

  // ==================== FILE OPERATIONS ====================

  /**
   * Create a file record
   */
  static async createFile(fileData: {
    id: string
    filename: string
    original_filename: string
    file_extension?: string | null
    mime_type: string
    file_size: number
    s3_bucket: string
    s3_key: string
    s3_region: string
    source: FileSource
    category: FileCategory
    case_id: string
    uploaded_by_id: string
  }) {
    const { data, error } = await this.client
      .from('files')
      .insert(fileData)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Get file by ID
   */
  static async getFileById(fileId: string) {
    const { data, error } = await this.client
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single()

    if (error) throw error
    return data
  }

  // ==================== AUDIT LOG OPERATIONS ====================

  /**
   * Create audit log entry
   */
  static async createAuditLog(logData: {
    action: string
    entity_type: string
    entity_id: string
    user_id: string
    organization_id: string | null
    old_values?: any
    new_values?: any
  }) {
    const { error } = await this.client
      .from('audit_logs')
      .insert({
        id: generateUUID(),
        ...logData,
        created_at: new Date().toISOString()
      })

    if (error) throw error
  }

  // ==================== CASE ID GENERATION ====================

  /**
   * Generate unique case ID
   */
  static async generateCaseId(organizationId: string): Promise<string> {
    // Get organization info
    const { data: org, error: orgError } = await this.client
      .from('organizations')
      .select('firm_number, firm_case_counter')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      throw new Error(`Organization with ID ${organizationId} not found`)
    }

    if (!org.firm_number) {
      throw new Error(`Organization ${organizationId} does not have a firm number assigned`)
    }

    // Increment the case counter
    const newCounter = (org.firm_case_counter || 0) + 1
    
    const { error: updateError } = await this.client
      .from('organizations')
      .update({ firm_case_counter: newCounter })
      .eq('id', organizationId)

    if (updateError) {
      throw new Error(`Failed to update case counter: ${updateError.message}`)
    }

    // Format the case ID: QGM_XXX_YYYY format
    const firmNumberStr = org.firm_number.padStart(3, '0')
    const caseSequenceStr = newCounter.toString().padStart(4, '0')
    
    return `QGM_${firmNumberStr}_${caseSequenceStr}`
  }

  /**
   * Get next case sequence for organization
   */
  static async getNextCaseSequence(organizationId: string): Promise<number> {
    const { data: org, error: orgError } = await this.client
      .from('organizations')
      .select('firm_case_counter')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      throw new Error(`Organization with ID ${organizationId} not found`)
    }

    return (org.firm_case_counter || 0) + 1
  }

  /**
   * Get next firm sequence number
   */
  static async getNextFirmSequence(): Promise<number> {
    const { data: maxOrg, error: maxError } = await this.client
      .from('organizations')
      .select('firm_number')
      .not('firm_number', 'is', null)
      .order('firm_number', { ascending: false })
      .limit(1)
      .single()

    if (maxError && maxError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      throw new Error(`Failed to get max firm number: ${maxError.message}`)
    }

    const nextSequence = maxOrg?.firm_number 
      ? parseInt(maxOrg.firm_number) + 1 
      : 1

    return nextSequence
  }

  // ==================== SUPERADMIN DELETE OPERATIONS ====================

  /**
   * Delete a user (SUPERADMIN only)
   */
  static async deleteUser(userId: string) {
    const { error } = await this.client
      .from('users')
      .delete()
      .eq('id', userId)

    if (error) throw error
  }

  /**
   * Delete a case and all related data (SUPERADMIN only)
   */
  static async deleteCase(caseId: string) {
    // Delete case services first
    await this.client
      .from('case_services')
      .delete()
      .eq('case_id', caseId)

    // Delete files
    await this.client
      .from('files')
      .delete()
      .eq('case_id', caseId)

    // Delete audit logs
    await this.client
      .from('audit_logs')
      .delete()
      .eq('entity_id', caseId)

    // Delete the case
    const { error } = await this.client
      .from('cases')
      .delete()
      .eq('id', caseId)

    if (error) throw error
  }

  /**
   * Delete an organization/firm and all related data (SUPERADMIN only)
   */
  static async deleteOrganization(organizationId: string) {
    // Get all cases for this organization
    const { data: cases } = await this.client
      .from('cases')
      .select('id')
      .eq('organization_id', organizationId)

    // Delete all cases and their related data
    if (cases && cases.length > 0) {
      for (const caseItem of cases) {
        await this.deleteCase(caseItem.id)
      }
    }

    // Delete users in this organization
    await this.client
      .from('users')
      .delete()
      .eq('organization_id', organizationId)

    // Delete the organization
    const { error } = await this.client
      .from('organizations')
      .delete()
      .eq('id', organizationId)

    if (error) throw error
  }

  /**
   * Get all users (SUPERADMIN only)
   */
  static async getAllUsers() {
    const { data, error } = await this.client
      .from('users')
      .select(`
        id,
        email,
        first_name,
        last_name,
        role,
        is_active,
        created_at,
        organization:organizations(id, name, display_name)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  /**
   * Get all organizations (SUPERADMIN only)
   */
  static async getAllOrganizations() {
    const { data, error } = await this.client
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  /**
   * Get organization by ID
   */
  static async getOrganizationById(organizationId: string) {
    const { data, error } = await this.client
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }
    return data
  }

  /**
   * Get organization by name (case-insensitive)
   */
  static async getOrganizationByName(name: string) {
    const { data, error } = await this.client
      .from('organizations')
      .select('*')
      .ilike('name', name)
      .maybeSingle()

    if (error) throw error
    return data
  }

  /**
   * Get last organization (by case_counter)
   */
  static async getLastOrganization() {
    const { data, error } = await this.client
      .from('organizations')
      .select('*')
      .order('case_counter', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data
  }

  /**
   * Create a new organization
   */
  static async createOrganization(orgData: {
    name: string
    display_name: string
    slug: string
    case_counter: number
    case_id_prefix: string
    is_firm: boolean
    firm_number: string
    address_line1?: string
    address_line2?: string | null
    city?: string
    state?: string
    country?: string
  }) {
    const { data, error } = await this.client
      .from('organizations')
      .insert({
        ...orgData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Create a new user
   */
  static async createUser(userData: {
    first_name: string
    last_name: string
    email: string
    password_hash: string
    role: UserRole
    organization_id: string | null
    mfa_setup_required?: boolean
  }) {
    const { data, error } = await this.client
      .from('users')
      .insert({
        first_name: userData.first_name,
        last_name: userData.last_name,
        email: userData.email,
        password_hash: userData.password_hash,
        role: userData.role,
        organization_id: userData.organization_id,
        is_active: true,
        mfa_setup_required: userData.mfa_setup_required || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()

    if (error) {
      console.error('[SUPABASE_DB] Error creating user:', error)
      throw error
    }
    
    if (!data || data.length === 0) {
      throw new Error('User creation failed: No data returned')
    }
    
    return data[0]
  }

  /**
   * Get all users by organization ID
   */
  static async getUsersByOrganizationId(organizationId: string) {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  /**
   * Get pending invitations by organization ID
   */
  static async getPendingInvitationsByOrganizationId(organizationId: string) {
    const { data, error } = await this.client
      .from('user_invitations')
      .select(`
        *,
        inviter:users!user_invitations_invited_by_id_fkey(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('organization_id', organizationId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false})

    if (error) throw error
    return data || []
  }

  /**
   * Create additional file upload record
   */
  static async createAdditionalFileUpload(uploadData: {
    case_id: string
    uploaded_by: string
    services: string[]
    specific_instructions?: string
    upload_date: Date
  }) {
    const { data, error } = await this.client
      .from('additional_file_uploads')
      .insert({
        id: generateUUID(),
        case_id: uploadData.case_id,
        uploaded_by: uploadData.uploaded_by,
        services: uploadData.services,
        specific_instructions: uploadData.specific_instructions,
        upload_date: uploadData.upload_date.toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Create multiple files with additional upload reference
   */
  static async createFilesWithAdditionalUpload(filesData: Array<{
    case_id: string
    filename: string
    original_filename: string
    s3_key: string
    file_size: number
    mime_type: string
    source: FileSource
    uploaded_by_id: string
    additional_upload_id?: string
  }>) {
    const { data, error } = await this.client
      .from('files')
      .insert(filesData.map(file => ({
        id: generateUUID(),
        ...file,
        s3_bucket: process.env.AWS_S3_BUCKET_NAME || 'quantyx-medilegal-files',
        s3_region: process.env.AWS_REGION || 'us-east-1',
        category: 'OTHER' as FileCategory,
        created_at: new Date().toISOString()
      })))
      .select()

    if (error) throw error
    return data
  }

  /**
   * Get additional file uploads for a case
   */
  static async getAdditionalFileUploadsByCase(caseId: string) {
    const { data, error } = await this.client
      .from('additional_file_uploads')
      .select(`
        *,
        uploaded_by_user:users!uploaded_by(
          id,
          first_name,
          last_name,
          email
        ),
        files!files_additional_upload_id_fkey(
          id,
          filename,
          original_filename,
          s3_key,
          file_size,
          mime_type,
          source,
          created_at
        )
      `)
      .eq('case_id', caseId)
      .order('upload_date', { ascending: false })

    if (error) throw error
    return data || []
  }

  /**
   * Get case by case number
   */
  static async getCaseByCaseNumber(caseNumber: string) {
    const { data, error } = await this.client
      .from('cases')
      .select('*')
      .eq('case_number', caseNumber)
      .single()

    if (error) throw error
    return data
  }

  /**
   * Create password reset token
   */
  static async createPasswordResetToken(tokenData: {
    user_id: string
    token: string
    expires_at: Date
  }) {
    // First, delete any existing tokens for this user
    await this.client
      .from('password_reset_tokens')
      .delete()
      .eq('user_id', tokenData.user_id)

    // Create new token
    const { data, error } = await this.client
      .from('password_reset_tokens')
      .insert({
        id: generateUUID(),
        user_id: tokenData.user_id,
        token: tokenData.token,
        expires_at: tokenData.expires_at.toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Get password reset token
   */
  static async getPasswordResetToken(token: string) {
    const { data, error } = await this.client
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null
      }
      throw error
    }

    // Check if token is expired
    if (new Date(data.expires_at) < new Date()) {
      return null
    }

    return data
  }

  /**
   * Delete password reset token
   */
  static async deletePasswordResetToken(token: string) {
    const { error } = await this.client
      .from('password_reset_tokens')
      .delete()
      .eq('token', token)

    if (error) throw error
  }

  /**
   * Update user password
   */
  static async updateUserPassword(userId: string, hashedPassword: string) {
    const { data, error } = await this.client
      .from('users')
      .update({ password_hash: hashedPassword })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // ==================== CASE ASSIGNMENT OPERATIONS ====================

  /**
   * Get all employees assigned to a case
   */
  static async getCaseAssignments(caseId: string) {
    try {
      const { data, error } = await this.client
        .from('case_assignments')
        .select(`
          id,
          case_id,
          user_id,
          assigned_at,
          user:users!case_assignments_user_id_fkey(
            id,
            first_name,
            last_name,
            email,
            role
          ),
          assigned_by:users!case_assignments_assigned_by_id_fkey(
            id,
            first_name,
            last_name
          )
        `)
        .eq('case_id', caseId)
        .order('assigned_at', { ascending: false })

      if (error) {
        // Handle RLS permission errors gracefully
        if (error.code === '42501') {
          console.warn('[SUPABASE_DB] RLS permission denied for case_assignments, returning empty array')
          return []
        }
        throw error
      }
      return data || []
    } catch (error: any) {
      // Catch any RLS or permission errors and return empty array
      if (error?.code === '42501' || error?.message?.includes('permission denied')) {
        console.warn('[SUPABASE_DB] Permission error accessing case_assignments, returning empty array')
        return []
      }
      throw error
    }
  }

  /**
   * Add a case assignment (assign employee to case)
   */
  static async addCaseAssignment(caseId: string, userId: string, assignedById: string) {
    const { data, error } = await this.client
      .from('case_assignments')
      .insert({
        id: generateUUID(),
        case_id: caseId,
        user_id: userId,
        assigned_by_id: assignedById,
        assigned_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      // If duplicate, ignore (UNIQUE constraint violation)
      if (error.code === '23505') {
        return null
      }
      throw error
    }
    return data
  }

  /**
   * Remove a case assignment (unassign employee from case)
   */
  static async removeCaseAssignment(caseId: string, userId: string) {
    const { error } = await this.client
      .from('case_assignments')
      .delete()
      .eq('case_id', caseId)
      .eq('user_id', userId)

    if (error) throw error
  }

  /**
   * Update case assignments (replace all assignments with new list)
   */
  static async updateCaseAssignments(caseId: string, userIds: string[], assignedById: string) {
    try {
      // Delete all existing assignments
      const { error: deleteError } = await this.client
        .from('case_assignments')
        .delete()
        .eq('case_id', caseId)

      // Ignore RLS errors on delete
      if (deleteError && deleteError.code !== '42501') {
        throw deleteError
      }

      // Add new assignments
      if (userIds.length > 0) {
        const assignments = userIds.map(userId => ({
          id: generateUUID(),
          case_id: caseId,
          user_id: userId,
          assigned_by_id: assignedById,
          assigned_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        }))

        const { error: insertError } = await this.client
          .from('case_assignments')
          .insert(assignments)

        if (insertError) {
          // Handle RLS permission errors
          if (insertError.code === '42501') {
            console.warn('[SUPABASE_DB] RLS permission denied for case_assignments insert, operation may not have completed')
            // Don't throw - allow operation to continue
            return
          }
          throw insertError
        }
      }
    } catch (error: any) {
      // Catch any RLS or permission errors
      if (error?.code === '42501' || error?.message?.includes('permission denied')) {
        console.warn('[SUPABASE_DB] Permission error updating case_assignments')
        // Don't throw - allow operation to continue
        return
      }
      throw error
    }
  }

  /**
   * Get all cases assigned to a specific employee
   */
  static async getCasesByAssignedEmployee(userId: string) {
    try {
      const { data, error } = await this.client
        .from('case_assignments')
        .select(`
          case:cases(
            id,
            case_number,
            title,
            status,
            priority,
            created_at,
            updated_at,
            due_date,
            client_name,
            estimated_cost,
            organization_id,
            organization:organizations(
              id,
              name,
              display_name,
              firm_number
            )
          )
        `)
        .eq('user_id', userId)
        .order('assigned_at', { ascending: false })

      if (error) {
        // Handle RLS permission errors gracefully
        if (error.code === '42501') {
          console.warn('[SUPABASE_DB] RLS permission denied for case_assignments, returning empty array')
          return []
        }
        throw error
      }
      
      // Extract cases from the nested structure
      return data?.map(item => item.case).filter(Boolean) || []
    } catch (error: any) {
      // Catch any RLS or permission errors and return empty array
      if (error?.code === '42501' || error?.message?.includes('permission denied')) {
        console.warn('[SUPABASE_DB] Permission error accessing case_assignments, returning empty array')
        return []
      }
      throw error
    }
  }

  // ==================== SYSTEM SETTINGS OPERATIONS ====================

  /**
   * Get a system setting by key
   */
  static async getSystemSetting(key: string) {
    const { data, error } = await this.client
      .from('system_settings')
      .select('*')
      .eq('key', key)
      .maybeSingle()

    if (error) throw error
    return data
  }

  /**
   * Update a system setting
   */
  static async updateSystemSetting(key: string, value: any, description?: string) {
    const { data, error } = await this.client
      .from('system_settings')
      .update({
        value: value,
        description: description,
        updated_at: new Date().toISOString()
      })
      .eq('key', key)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Get next firm ID and increment it
   */
  static async getAndIncrementNextFirmId(): Promise<number> {
    const setting = await this.getSystemSetting('next_firm_id')
    
    if (!setting) {
      throw new Error('next_firm_id setting not found in system_settings')
    }

    const currentFirmId = typeof setting.value === 'string' 
      ? parseInt(setting.value) 
      : setting.value

    // Increment for next time
    await this.updateSystemSetting('next_firm_id', (currentFirmId + 1).toString())

    return currentFirmId
  }
}
