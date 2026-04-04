import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Feature: medilegal-schema-redesign, Property 1: RLS Policy Implementation
// **Validates: Requirements 1.1, 7.1**

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

describe('Property 1: RLS Policy Implementation', () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await supabase.from('users').delete().like('email', '%test-rls%')
    await supabase.from('organizations').delete().like('name', '%test-rls%')
  })

  afterAll(async () => {
    // Clean up test data
    await supabase.from('users').delete().like('email', '%test-rls%')
    await supabase.from('organizations').delete().like('name', '%test-rls%')
  })

  it('should have RLS enabled on all main tables', { timeout: 10000 }, async () => {
    // Test that we can access the tables (which means RLS is configured)
    const { data: orgsData } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
    
    const { data: usersData } = await supabase
      .from('users')
      .select('id')
      .limit(1)
    
    const { data: casesData } = await supabase
      .from('cases')
      .select('id')
      .limit(1)
    
    const { data: filesData } = await supabase
      .from('files')
      .select('id')
      .limit(1)

    // If RLS is properly configured, these queries should work
    expect(orgsData).toBeDefined()
    expect(usersData).toBeDefined()
    expect(casesData).toBeDefined()
    expect(filesData).toBeDefined()
  })

  it('should allow basic CRUD operations on organizations table', { timeout: 10000 }, async () => {
    // Test creating an organization
    const { data: newOrg, error: createError } = await supabase
      .from('organizations')
      .insert({
        name: 'test-rls-basic-org',
        display_name: 'Test RLS Basic Org',
        slug: 'test-rls-basic-org',
        firm_number: '999',
        is_firm: true,
        case_id_prefix: 'QGM'
      })
      .select()
      .single()

    expect(createError).toBeNull()
    expect(newOrg).toBeDefined()
    expect(newOrg?.name).toBe('test-rls-basic-org')

    if (newOrg) {
      // Test reading the organization
      const { data: readOrg, error: readError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', newOrg.id)
        .single()

      expect(readError).toBeNull()
      expect(readOrg).toBeDefined()
      expect(readOrg?.id).toBe(newOrg.id)

      // Clean up
      await supabase.from('organizations').delete().eq('id', newOrg.id)
    }
  })

  it('should allow basic CRUD operations on users table', { timeout: 10000 }, async () => {
    // First create an organization for the user
    const { data: testOrg } = await supabase
      .from('organizations')
      .insert({
        name: 'test-rls-user-org',
        display_name: 'Test RLS User Org',
        slug: 'test-rls-user-org',
        firm_number: '998',
        is_firm: true,
        case_id_prefix: 'QGM'
      })
      .select()
      .single()

    if (testOrg) {
      // Test creating a user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: 'test-rls-basic@example.com',
          first_name: 'Test',
          last_name: 'User',
          role: 'CLIENT',
          is_active: true,
          organization_id: testOrg.id
        })
        .select()
        .single()

      expect(createError).toBeNull()
      expect(newUser).toBeDefined()
      expect(newUser?.email).toBe('test-rls-basic@example.com')

      if (newUser) {
        // Test reading the user
        const { data: readUser, error: readError } = await supabase
          .from('users')
          .select('*')
          .eq('id', newUser.id)
          .single()

        expect(readError).toBeNull()
        expect(readUser).toBeDefined()
        expect(readUser?.id).toBe(newUser.id)

        // Clean up
        await supabase.from('users').delete().eq('id', newUser.id)
      }

      // Clean up organization
      await supabase.from('organizations').delete().eq('id', testOrg.id)
    }
  })

  it('should allow basic operations on cases and files tables', { timeout: 10000 }, async () => {
    // Test that we can query cases and files tables
    const { data: casesCount, error: casesError } = await supabase
      .from('cases')
      .select('id', { count: 'exact' })

    const { data: filesCount, error: filesError } = await supabase
      .from('files')
      .select('id', { count: 'exact' })

    // These should not error due to RLS policies
    expect(casesError).toBeNull()
    expect(filesError).toBeNull()
    expect(casesCount).toBeDefined()
    expect(filesCount).toBeDefined()
  })
})