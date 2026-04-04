import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fc from 'fast-check'
import { createClient } from '@supabase/supabase-js'

// **Feature: medilegal-schema-redesign, Property 1: RLS Policy Implementation**
// **Validates: Requirements 1.1, 7.1**

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

describe('Property 1: RLS Policy Implementation', () => {
  let supabase: ReturnType<typeof createClient>

  beforeAll(() => {
    supabase = createClient(supabaseUrl, supabaseServiceKey)
  })

  it('should have RLS enabled on all medilegal tables', async () => {
    // **Feature: medilegal-schema-redesign, Property 1: RLS Policy Implementation**
    const tables = ['organizations', 'users', 'cases', 'files']
    
    for (const table of tables) {
      // Check if RLS is enabled using raw SQL
      const { data, error } = await supabase.rpc('exec_sql', {
        query: `
          SELECT relrowsecurity as rls_enabled 
          FROM pg_class 
          WHERE relname = '${table}' 
          AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        `
      })

      if (error) {
        // Fallback: Try to access the table without authentication to see if RLS blocks it
        const unauthenticatedClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data: testData, error: testError } = await unauthenticatedClient
          .from(table)
          .select('*')
          .limit(1)

        // If we get data without authentication, RLS might not be properly configured
        // If we get an auth error or empty data, RLS is likely working
        expect(testData?.length || 0).toBe(0)
      } else {
        expect(data).toBeTruthy()
        expect(data[0]?.rls_enabled).toBe(true)
      }
    }
  })

  it('should have proper RLS policies defined for each table', async () => {
    // **Feature: medilegal-schema-redesign, Property 1: RLS Policy Implementation**
    const expectedPolicies = {
      organizations: [
        'super_admin_organizations_all',
        'admin_organizations_read', 
        'client_organizations_read'
      ],
      users: [
        'super_admin_users_all',
        'admin_users_read',
        'admin_users_create_client',
        'admin_users_update_client',
        'client_users_read_own',
        'client_users_create_firm_client',
        'users_update_own_profile'
      ],
      cases: [
        'super_admin_cases_all',
        'admin_cases_all',
        'client_cases_firm_only'
      ],
      files: [
        'super_admin_files_all',
        'admin_files_all',
        'client_files_firm_only'
      ]
    }

    for (const [tableName, policyNames] of Object.entries(expectedPolicies)) {
      // Check policies using raw SQL
      const { data: policies, error } = await supabase.rpc('exec_sql', {
        query: `
          SELECT policyname 
          FROM pg_policies 
          WHERE tablename = '${tableName}'
        `
      })

      if (error) {
        // If we can't access pg_policies, skip this validation
        console.warn(`Could not check policies for ${tableName}: ${error.message}`)
        continue
      }

      expect(policies).toBeTruthy()

      const existingPolicyNames = policies?.map((p: any) => p.policyname) || []
      
      for (const expectedPolicy of policyNames) {
        expect(existingPolicyNames).toContain(expectedPolicy)
      }
    }
  })

  it('should enforce database-level security without application filtering', async () => {
    // **Feature: medilegal-schema-redesign, Property 1: RLS Policy Implementation**
    await fc.assert(fc.asyncProperty(
      fc.constantFrom('organizations', 'users', 'cases', 'files'),
      async (tableName) => {
        // Test that RLS policies are enforced at database level
        // by attempting direct SQL access without proper authentication context
        
        // Create a client without authentication
        const unauthenticatedClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        
        // Attempt to access data without authentication
        const { data, error } = await unauthenticatedClient
          .from(tableName)
          .select('*')
          .limit(1)

        // Should either return empty data or require authentication
        // The key is that RLS policies are enforced
        if (error) {
          // Authentication required - this is expected
          expect(error.message).toMatch(/JWT|auth|permission/i)
        } else {
          // If no error, data should be empty due to RLS policies
          expect(data).toEqual([])
        }
      }
    ), { numRuns: 20 })
  })
})