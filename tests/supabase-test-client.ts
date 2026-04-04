/**
 * Supabase Test Client
 * 
 * This module provides a test client that uses Supabase directly instead of Prisma
 * to bypass RLS policy issues during testing.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Service role client bypasses RLS policies
export const supabaseTestClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

/**
 * Test database operations using Supabase client
 */
export class SupabaseTestDatabase {
  
  async connect(): Promise<void> {
    // Test connection
    const { data, error } = await supabaseTestClient
      .from('users')
      .select('count')
      .limit(1)
    
    if (error && !error.message.includes('relation "users" does not exist')) {
      throw new Error(`Database connection failed: ${error.message}`)
    }
  }

  async disconnect(): Promise<void> {
    // Supabase client doesn't need explicit disconnection
  }

  // User operations
  async createUser(userData: {
    id?: string
    email: string
    first_name: string
    last_name: string
    role: string
    organization_id?: string
    password_hash?: string
  }) {
    const { data, error } = await supabaseTestClient
      .from('users')
      .insert(userData)
      .select()
      .single()
    
    if (error) throw new Error(`Failed to create user: ${error.message}`)
    return data
  }

  async findUser(where: { id?: string; email?: string }) {
    let query = supabaseTestClient.from('users').select('*')
    
    if (where.id) query = query.eq('id', where.id)
    if (where.email) query = query.eq('email', where.email)
    
    const { data, error } = await query.single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw new Error(`Failed to find user: ${error.message}`)
    }
    
    return data
  }

  async deleteUsers(where: { email?: { contains?: string } }) {
    let query = supabaseTestClient.from('users').delete()
    
    if (where.email?.contains) {
      query = query.like('email', `%${where.email.contains}%`)
    }
    
    const { error } = await query
    if (error) throw new Error(`Failed to delete users: ${error.message}`)
  }

  async countUsers(): Promise<number> {
    const { count, error } = await supabaseTestClient
      .from('users')
      .select('*', { count: 'exact', head: true })
    
    if (error) throw new Error(`Failed to count users: ${error.message}`)
    return count || 0
  }

  // Organization operations
  async createOrganization(orgData: {
    name: string
    display_name: string
    slug: string
    firm_number?: string
    is_firm?: boolean
    case_id_prefix?: string
    firm_case_counter?: number
  }) {
    const { data, error } = await supabaseTestClient
      .from('organizations')
      .insert(orgData)
      .select()
      .single()
    
    if (error) throw new Error(`Failed to create organization: ${error.message}`)
    return data
  }

  async findOrganization(where: { id?: string; firm_number?: string }) {
    let query = supabaseTestClient.from('organizations').select('*')
    
    if (where.id) query = query.eq('id', where.id)
    if (where.firm_number) query = query.eq('firm_number', where.firm_number)
    
    const { data, error } = await query.single()
    
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to find organization: ${error.message}`)
    }
    
    return data
  }

  async deleteOrganizations(where: { name?: { contains?: string } }) {
    let query = supabaseTestClient.from('organizations').delete()
    
    if (where.name?.contains) {
      query = query.like('name', `%${where.name.contains}%`)
    }
    
    const { error } = await query
    if (error) throw new Error(`Failed to delete organizations: ${error.message}`)
  }

  // Case operations
  async createCase(caseData: {
    case_number: string
    title: string
    description?: string
    organization_id: string
    owner_id: string
    status?: string
    priority?: string
  }) {
    const { data, error } = await supabaseTestClient
      .from('cases')
      .insert(caseData)
      .select()
      .single()
    
    if (error) throw new Error(`Failed to create case: ${error.message}`)
    return data
  }

  async findCases(where: { organization_id?: string }) {
    let query = supabaseTestClient.from('cases').select('*')
    
    if (where.organization_id) {
      query = query.eq('organization_id', where.organization_id)
    }
    
    const { data, error } = await query
    
    if (error) throw new Error(`Failed to find cases: ${error.message}`)
    return data || []
  }

  async deleteCases(where: { organization_id?: string }) {
    let query = supabaseTestClient.from('cases').delete()
    
    if (where.organization_id) {
      query = query.eq('organization_id', where.organization_id)
    }
    
    const { error } = await query
    if (error) throw new Error(`Failed to delete cases: ${error.message}`)
  }

  // Audit log operations
  async deleteAuditLogs() {
    const { error } = await supabaseTestClient
      .from('audit_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all
    
    if (error) throw new Error(`Failed to delete audit logs: ${error.message}`)
  }

  // Generic cleanup
  async cleanup() {
    try {
      // Clean up in dependency order
      await this.deleteCases({})
      await this.deleteUsers({ email: { contains: 'test' } })
      await this.deleteOrganizations({ name: { contains: 'Test' } })
      await this.deleteAuditLogs()
    } catch (error) {
      console.warn('Cleanup warning:', error)
      // Don't throw on cleanup errors
    }
  }
}

// Export singleton instance
export const testDb = new SupabaseTestDatabase()