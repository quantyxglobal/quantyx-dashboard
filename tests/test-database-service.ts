import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Service role client for admin operations (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

/**
 * Test Database Service - Bypasses RLS policies for testing
 * 
 * This service provides database operations that work in test environments
 * by using the Supabase admin client with service role permissions.
 */
export class TestDatabaseService {
  
  /**
   * Clean up test data by pattern matching
   */
  async cleanupTestData(patterns: {
    users?: string[]
    organizations?: string[]
    cases?: string[]
    auditLogs?: boolean
  }) {
    const results = []

    // Clean users
    if (patterns.users) {
      for (const pattern of patterns.users) {
        const result = await supabaseAdmin
          .from('users')
          .delete()
          .like('email', pattern)
        results.push({ table: 'users', pattern, result })
      }
    }

    // Clean organizations
    if (patterns.organizations) {
      for (const pattern of patterns.organizations) {
        const result = await supabaseAdmin
          .from('organizations')
          .delete()
          .like('name', pattern)
        results.push({ table: 'organizations', pattern, result })
      }
    }

    // Clean cases
    if (patterns.cases) {
      for (const pattern of patterns.cases) {
        const result = await supabaseAdmin
          .from('cases')
          .delete()
          .like('title', pattern)
        results.push({ table: 'cases', pattern, result })
      }
    }

    // Clean audit logs
    if (patterns.auditLogs) {
      const result = await supabaseAdmin
        .from('audit_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all
      results.push({ table: 'audit_logs', pattern: 'all', result })
    }

    return results
  }

  /**
   * Create test user with proper organization setup
   */
  async createTestUser(userData: {
    email: string
    password: string
    firstName: string
    lastName: string
    role: 'SUPER_ADMIN' | 'ADMIN' | 'CLIENT'
    organizationId?: string
  }) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({
        email: userData.email.toLowerCase(),
        email_verified: true,
        password_hash: userData.password, // In real tests, this should be hashed
        first_name: userData.firstName,
        last_name: userData.lastName,
        role: userData.role,
        organization_id: userData.organizationId,
        is_active: true,
        failed_login_attempts: 0
      })
      .select()
      .single()

    return { data, error }
  }

  /**
   * Create test organization
   */
  async createTestOrganization(orgData: {
    name: string
    isFirm?: boolean
    firmNumber?: string
  }) {
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: orgData.name,
        display_name: orgData.name,
        slug: orgData.name.toLowerCase().replace(/\s+/g, '-'),
        is_firm: orgData.isFirm ?? true,
        firm_number: orgData.firmNumber,
        case_id_prefix: 'QGM',
        firm_case_counter: 0
      })
      .select()
      .single()

    return { data, error }
  }

  /**
   * Create test case
   */
  async createTestCase(caseData: {
    title: string
    description?: string
    organizationId: string
    createdBy: string
  }) {
    const { data, error } = await supabaseAdmin
      .from('cases')
      .insert({
        title: caseData.title,
        description: caseData.description || 'Test case description',
        organization_id: caseData.organizationId,
        created_by: caseData.createdBy,
        status: 'ACTIVE'
      })
      .select()
      .single()

    return { data, error }
  }

  /**
   * Get data by ID (bypasses RLS)
   */
  async getById(table: string, id: string) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .eq('id', id)
      .single()

    return { data, error }
  }

  /**
   * Update data by ID (bypasses RLS)
   */
  async updateById(table: string, id: string, updates: Record<string, any>) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  }

  /**
   * Delete by ID (bypasses RLS)
   */
  async deleteById(table: string, id: string) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq('id', id)

    return { data, error }
  }
}

// Export singleton instance
export const testDb = new TestDatabaseService()