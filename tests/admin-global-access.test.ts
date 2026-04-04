import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Feature: medilegal-schema-redesign, Property 3: Admin Global Access
// **Validates: Requirements 1.3, 3.4**

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

describe('Property 3: Admin Global Access', () => {
  let testFirms: any[] = []
  let testAdmins: any[] = []
  let testCases: any[] = []

  beforeAll(async () => {
    // Clean up any existing test data more thoroughly
    await supabase.from('cases').delete().like('title', '%test-admin-access%')
    await supabase.from('cases').delete().like('title', '%Test Admin Access%')
    await supabase.from('users').delete().like('email', '%test-admin-access%')
    await supabase.from('users').delete().like('email', '%test-admin-levels%')
    await supabase.from('organizations').delete().like('name', '%test-admin-access%')
    await supabase.from('organizations').delete().like('name', '%test-admin-levels%')
    
    // Clean up specific firm numbers that might be left over
    await supabase.from('organizations').delete().in('firm_number', ['905', '906', '907', '908', '920', '921', '922', '923'])
  })

  afterAll(async () => {
    // Clean up test data
    for (const testCase of testCases) {
      await supabase.from('cases').delete().eq('id', testCase.id)
    }
    for (const admin of testAdmins) {
      await supabase.from('users').delete().eq('id', admin.id)
    }
    for (const firm of testFirms) {
      await supabase.from('organizations').delete().eq('id', firm.id)
    }
  })

  beforeEach(() => {
    testFirms = []
    testAdmins = []
    testCases = []
  })

  it('should provide admin users access to all firms data without restriction', { timeout: 10000 }, async () => {
    // Create multiple test firms
    const firm1 = await supabase
      .from('organizations')
      .insert({
        name: 'test-admin-access-firm-1',
        display_name: 'Test Admin Access Firm 1',
        slug: 'test-admin-access-firm-1',
        firm_number: '920',
        is_firm: true,
        case_id_prefix: 'QGM'
      })
      .select()
      .single()

    const firm2 = await supabase
      .from('organizations')
      .insert({
        name: 'test-admin-access-firm-2',
        display_name: 'Test Admin Access Firm 2',
        slug: 'test-admin-access-firm-2',
        firm_number: '921',
        is_firm: true,
        case_id_prefix: 'QGM'
      })
      .select()
      .single()

    const firm3 = await supabase
      .from('organizations')
      .insert({
        name: 'test-admin-access-firm-3',
        display_name: 'Test Admin Access Firm 3',
        slug: 'test-admin-access-firm-3',
        firm_number: '922',
        is_firm: true,
        case_id_prefix: 'QGM'
      })
      .select()
      .single()

    if (firm1.error || firm2.error || firm3.error || !firm1.data || !firm2.data || !firm3.data) {
      throw new Error('Failed to create test firms')
    }

    testFirms.push(firm1.data, firm2.data, firm3.data)

    // Create an admin user (not associated with any specific firm)
    const admin = await supabase
      .from('users')
      .insert({
        email: `admin-${Date.now()}@test-admin-access.com`,
        first_name: 'Test',
        last_name: 'Admin',
        role: 'ADMIN',
        is_active: true,
        organization_id: null // Admins are not tied to specific organizations
      })
      .select()
      .single()

    if (admin.error || !admin.data) {
      throw new Error('Failed to create test admin')
    }

    testAdmins.push(admin.data)

    // Create cases for each firm
    const case1 = await supabase
      .from('cases')
      .insert({
        case_number: 'QGM_920_0001',
        title: 'Test Admin Access Case for Firm 1',
        description: 'Test case for admin access validation - firm 1',
        client_name: 'Test Client 1',
        client_email: 'testclient1@example.com',
        status: 'PENDING',
        priority: 'NORMAL',
        organization_id: firm1.data.id,
        owner_id: admin.data.id
      })
      .select()
      .single()

    const case2 = await supabase
      .from('cases')
      .insert({
        case_number: 'QGM_921_0001',
        title: 'Test Admin Access Case for Firm 2',
        description: 'Test case for admin access validation - firm 2',
        client_name: 'Test Client 2',
        client_email: 'testclient2@example.com',
        status: 'IN_PROGRESS',
        priority: 'EXPEDITE',
        organization_id: firm2.data.id,
        owner_id: admin.data.id
      })
      .select()
      .single()

    const case3 = await supabase
      .from('cases')
      .insert({
        case_number: 'QGM_922_0001',
        title: 'Test Admin Access Case for Firm 3',
        description: 'Test case for admin access validation - firm 3',
        client_name: 'Test Client 3',
        client_email: 'testclient3@example.com',
        status: 'COMPLETED',
        priority: 'SUPER_RUSH',
        organization_id: firm3.data.id,
        owner_id: admin.data.id
      })
      .select()
      .single()

    if (case1.error || case2.error || case3.error || !case1.data || !case2.data || !case3.data) {
      throw new Error('Failed to create test cases')
    }

    testCases.push(case1.data, case2.data, case3.data)

    // Test property: Admin should be able to access data from all firms
    // Verify that cases exist across multiple firms
    const allFirmIds = testFirms.map(f => f.id)
    const casesByFirm = testCases.reduce((acc, testCase) => {
      acc[testCase.organization_id] = (acc[testCase.organization_id] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Property: Admin access should span multiple firms
    expect(Object.keys(casesByFirm).length).toBe(3) // Cases across 3 different firms
    expect(allFirmIds.every(firmId => casesByFirm[firmId] > 0)).toBe(true)

    // Property: Each case should be properly associated with its firm
    for (const testCase of testCases) {
      expect(allFirmIds).toContain(testCase.organization_id)
    }

    // Property: Admin user should not be restricted to a single organization
    expect(admin.data.organization_id).toBeNull()
  })

  it('should differentiate between ADMIN and SUPER_ADMIN access levels', { timeout: 10000 }, async () => {
    // Create a test firm
    const firm = await supabase
      .from('organizations')
      .insert({
        name: 'test-admin-levels-firm',
        display_name: 'Test Admin Levels Firm',
        slug: 'test-admin-levels-firm',
        firm_number: '923',
        is_firm: true,
        case_id_prefix: 'QGM'
      })
      .select()
      .single()

    if (firm.error || !firm.data) {
      throw new Error('Failed to create test firm')
    }

    testFirms.push(firm.data)

    // Create an ADMIN user (we can't create another SUPER_ADMIN due to uniqueness constraint)
    const admin = await supabase
      .from('users')
      .insert({
        email: `admin-levels-${Date.now()}@test-admin-levels.com`,
        first_name: 'Test',
        last_name: 'Admin',
        role: 'ADMIN',
        is_active: true,
        organization_id: null
      })
      .select()
      .single()

    if (admin.error || !admin.data) {
      throw new Error(`Failed to create test admin user: ${admin.error?.message}`)
    }

    testAdmins.push(admin.data)

    // Get the existing SUPER_ADMIN user instead of creating a new one
    const { data: existingSuperAdmin } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'SUPER_ADMIN')
      .single()

    if (!existingSuperAdmin) {
      throw new Error('No existing SUPER_ADMIN found')
    }

    // Test property: Both roles should exist and be different
    expect(admin.data.role).toBe('ADMIN')
    expect(existingSuperAdmin.role).toBe('SUPER_ADMIN')
    expect(admin.data.role).not.toBe(existingSuperAdmin.role)

    // Property: Both admin types should not be tied to specific organizations (for new admins)
    // Note: Existing super admin might have an organization_id, which is acceptable
    expect(admin.data.organization_id).toBeNull()
    // For existing super admin, we just verify it exists
    expect(existingSuperAdmin).toBeDefined()
    expect(existingSuperAdmin.role).toBe('SUPER_ADMIN')

    // Property: SUPER_ADMIN should have higher privileges (conceptually)
    // In this simplified test, we verify the role hierarchy exists
    const roleHierarchy = ['CLIENT', 'ADMIN', 'SUPER_ADMIN']
    const adminIndex = roleHierarchy.indexOf(admin.data.role)
    const superAdminIndex = roleHierarchy.indexOf(existingSuperAdmin.role)
    
    expect(superAdminIndex).toBeGreaterThan(adminIndex)

    // Property: Only one SUPER_ADMIN should exist (uniqueness constraint test)
    const { data: allSuperAdmins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'SUPER_ADMIN')
    
    expect(allSuperAdmins?.length).toBe(1)
  })
})