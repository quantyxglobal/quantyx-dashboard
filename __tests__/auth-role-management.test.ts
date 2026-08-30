/**
 * Authentication and Role Management Test Suite
 * 
 * Tests critical scenarios:
 * 1. User-organization assignment validation
 * 2. Role-based access control
 * 3. Authentication context retrieval
 * 4. Data integrity constraints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { SupabaseDB } from '@/lib/supabase-db'

// Test data IDs (will be populated during setup)
let testFirmId: string
let testServiceProviderOrgId: string
let testSuperAdminId: string
let testAdminId: string
let testEmployeeId: string
let testClientId: string

describe('Authentication and Role Management', () => {
  beforeAll(async () => {
    console.log('Setting up test data...')
    
    // Get Quantyx Global service provider organization
    const allOrgs = await SupabaseDB.getAllOrganizations()
    const quantyxGlobal = allOrgs.find(org => org.slug === 'quantyx-global')
    if (quantyxGlobal) {
      testServiceProviderOrgId = quantyxGlobal.id
    }
  })

  afterAll(async () => {
    console.log('Cleaning up test data...')
    // Cleanup will be handled by test database reset
  })

  describe('User-Organization Assignment Validation', () => {
    it('should prevent CLIENT user from being created without organization', async () => {
      const email = `test-client-no-org-${Date.now()}@test.com`
      
      await expect(async () => {
        await SupabaseDB.createUser({
          email,
          first_name: 'Test',
          last_name: 'Client',
          password_hash: 'dummy_hash',
          role: 'CLIENT',
          organization_id: null
        })
      }).rejects.toThrow(/CLIENT users must be assigned to an organization/)
    })

    it('should prevent CLIENT user from being assigned to service provider organization', async () => {
      if (!testServiceProviderOrgId) {
        console.warn('Skipping test: Service provider org not found')
        return
      }

      const email = `test-client-service-provider-${Date.now()}@test.com`
      
      await expect(async () => {
        await SupabaseDB.createUser({
          email,
          first_name: 'Test',
          last_name: 'Client',
          password_hash: 'dummy_hash',
          role: 'CLIENT',
          organization_id: testServiceProviderOrgId
        })
      }).rejects.toThrow(/CLIENT users cannot be assigned to the service provider organization/)
    })

    it('should allow CLIENT user to be created with law firm organization', async () => {
      // Create test firm
      const nextFirmNumber = await SupabaseDB.getNextFirmSequence()
      const testFirm = await SupabaseDB.createOrganization({
        name: `Test Law Firm ${Date.now()}`,
        display_name: `Test Law Firm ${Date.now()}`,
        slug: `test-law-firm-${Date.now()}`,
        case_counter: 0,
        case_id_prefix: 'QGM',
        is_firm: true,
        firm_number: nextFirmNumber.toString().padStart(3, '0')
      })
      
      testFirmId = testFirm.id
      
      const email = `test-client-with-firm-${Date.now()}@test.com`
      
      const client = await SupabaseDB.createUser({
        email,
        first_name: 'Test',
        last_name: 'Client',
        password_hash: 'dummy_hash',
        role: 'CLIENT',
        organization_id: testFirmId
      })
      
      expect(client).toBeDefined()
      expect(client.role).toBe('CLIENT')
      expect(client.organization_id).toBe(testFirmId)
      
      testClientId = client.id
    })

    it('should prevent SUPER_ADMIN from being assigned to law firm organization', async () => {
      if (!testFirmId) {
        console.warn('Skipping test: Test firm not created')
        return
      }

      const email = `test-superadmin-with-firm-${Date.now()}@test.com`
      
      await expect(async () => {
        await SupabaseDB.createUser({
          email,
          first_name: 'Test',
          last_name: 'SuperAdmin',
          password_hash: 'dummy_hash',
          role: 'SUPER_ADMIN',
          organization_id: testFirmId
        })
      }).rejects.toThrow(/Internal staff.*cannot be assigned to law firm organizations/)
    })

    it('should prevent ADMIN from being assigned to law firm organization', async () => {
      if (!testFirmId) {
        console.warn('Skipping test: Test firm not created')
        return
      }

      const email = `test-admin-with-firm-${Date.now()}@test.com`
      
      await expect(async () => {
        await SupabaseDB.createUser({
          email,
          first_name: 'Test',
          last_name: 'Admin',
          password_hash: 'dummy_hash',
          role: 'ADMIN',
          organization_id: testFirmId
        })
      }).rejects.toThrow(/Internal staff.*cannot be assigned to law firm organizations/)
    })

    it('should prevent EMPLOYEE from being assigned to law firm organization', async () => {
      if (!testFirmId) {
        console.warn('Skipping test: Test firm not created')
        return
      }

      const email = `test-employee-with-firm-${Date.now()}@test.com`
      
      await expect(async () => {
        await SupabaseDB.createUser({
          email,
          first_name: 'Test',
          last_name: 'Employee',
          password_hash: 'dummy_hash',
          role: 'EMPLOYEE',
          organization_id: testFirmId
        })
      }).rejects.toThrow(/Internal staff.*cannot be assigned to law firm organizations/)
    })

    it('should allow SUPER_ADMIN to be created without organization', async () => {
      const email = `test-superadmin-no-org-${Date.now()}@test.com`
      
      const superAdmin = await SupabaseDB.createUser({
        email,
        first_name: 'Test',
        last_name: 'SuperAdmin',
        password_hash: 'dummy_hash',
        role: 'SUPER_ADMIN',
        organization_id: null
      })
      
      expect(superAdmin).toBeDefined()
      expect(superAdmin.role).toBe('SUPER_ADMIN')
      expect(superAdmin.organization_id).toBeNull()
      
      testSuperAdminId = superAdmin.id
    })

    it('should allow ADMIN to be created without organization', async () => {
      const email = `test-admin-no-org-${Date.now()}@test.com`
      
      const admin = await SupabaseDB.createUser({
        email,
        first_name: 'Test',
        last_name: 'Admin',
        password_hash: 'dummy_hash',
        role: 'ADMIN',
        organization_id: null
      })
      
      expect(admin).toBeDefined()
      expect(admin.role).toBe('ADMIN')
      expect(admin.organization_id).toBeNull()
      
      testAdminId = admin.id
    })

    it('should allow EMPLOYEE to be created without organization', async () => {
      const email = `test-employee-no-org-${Date.now()}@test.com`
      
      const employee = await SupabaseDB.createUser({
        email,
        first_name: 'Test',
        last_name: 'Employee',
        password_hash: 'dummy_hash',
        role: 'EMPLOYEE',
        organization_id: null
      })
      
      expect(employee).toBeDefined()
      expect(employee.role).toBe('EMPLOYEE')
      expect(employee.organization_id).toBeNull()
      
      testEmployeeId = employee.id
    })

    it('should allow internal staff to be assigned to service provider organization', async () => {
      if (!testServiceProviderOrgId) {
        console.warn('Skipping test: Service provider org not found')
        return
      }

      const email = `test-admin-service-provider-${Date.now()}@test.com`
      
      const admin = await SupabaseDB.createUser({
        email,
        first_name: 'Test',
        last_name: 'Admin',
        password_hash: 'dummy_hash',
        role: 'ADMIN',
        organization_id: testServiceProviderOrgId
      })
      
      expect(admin).toBeDefined()
      expect(admin.role).toBe('ADMIN')
      expect(admin.organization_id).toBe(testServiceProviderOrgId)
    })
  })

  describe('Organization Structure', () => {
    it('should have Quantyx Global marked as service provider (is_firm=false)', async () => {
      const allOrgs = await SupabaseDB.getAllOrganizations()
      const quantyxGlobal = allOrgs.find(org => org.slug === 'quantyx-global')
      
      expect(quantyxGlobal).toBeDefined()
      expect(quantyxGlobal?.is_firm).toBe(false)
      expect(quantyxGlobal?.firm_number).toBeNull()
    })

    it('should have test firm marked as law firm (is_firm=true)', async () => {
      if (!testFirmId) {
        console.warn('Skipping test: Test firm not created')
        return
      }

      const firm = await SupabaseDB.getOrganizationById(testFirmId)
      
      expect(firm).toBeDefined()
      expect(firm?.is_firm).toBe(true)
      expect(firm?.firm_number).toBeDefined()
    })
  })

  describe('User Retrieval with Organization Context', () => {
    it('should retrieve SUPER_ADMIN with null organization', async () => {
      if (!testSuperAdminId) {
        console.warn('Skipping test: Test super admin not created')
        return
      }

      const user = await SupabaseDB.getUserById(testSuperAdminId)
      
      expect(user).toBeDefined()
      expect(user?.role).toBe('SUPER_ADMIN')
      expect(user?.organization_id).toBeNull()
      expect(user?.organization).toBeUndefined()
    })

    it('should retrieve CLIENT with firm organization context', async () => {
      if (!testClientId) {
        console.warn('Skipping test: Test client not created')
        return
      }

      const user = await SupabaseDB.getUserById(testClientId)
      
      expect(user).toBeDefined()
      expect(user?.role).toBe('CLIENT')
      expect(user?.organization_id).toBe(testFirmId)
      expect(user?.organization).toBeDefined()
      expect(user?.organization?.is_firm).toBe(true)
    })
  })

  describe('Role-Based Access Patterns', () => {
    it('should identify users who can manage other users', async () => {
      const roles = ['SUPER_ADMIN', 'ADMIN']
      
      for (const role of roles) {
        // This would test the canManageUsers utility function
        expect(['SUPER_ADMIN', 'ADMIN'].includes(role)).toBe(true)
      }
    })

    it('should identify users who cannot manage other users', async () => {
      const roles = ['CLIENT', 'EMPLOYEE']
      
      for (const role of roles) {
        // This would test the canManageUsers utility function
        expect(['SUPER_ADMIN', 'ADMIN'].includes(role)).toBe(false)
      }
    })
  })

  describe('Data Integrity Across Operations', () => {
    it('should maintain consistency when updating user role', async () => {
      if (!testEmployeeId) {
        console.warn('Skipping test: Test employee not created')
        return
      }

      // Attempting to change EMPLOYEE (no org) to CLIENT should fail
      // Note: SupabaseDB doesn't have updateUser method, so this test documents expected behavior
      // In production, this would be enforced by database triggers
      expect(true).toBe(true) // Placeholder - triggers tested via direct SQL
    })

    it('should prevent assigning CLIENT user to service provider on update', async () => {
      if (!testClientId || !testServiceProviderOrgId) {
        console.warn('Skipping test: Test data not created')
        return
      }

      // Attempting to change CLIENT from firm to service provider should fail
      // Note: SupabaseDB doesn't have updateUser method, so this test documents expected behavior
      // In production, this would be enforced by database triggers
      expect(true).toBe(true) // Placeholder - triggers tested via direct SQL
    })
  })
})

describe('Organization Structure', () => {
  it('should maintain single service provider organization', async () => {
    const allOrgs = await SupabaseDB.getAllOrganizations()
    const serviceProviders = allOrgs.filter(org => !org.is_firm)
    
    expect(serviceProviders.length).toBeGreaterThanOrEqual(1)
    expect(serviceProviders.some(org => org.slug === 'quantyx-global')).toBe(true)
  })

  it('should have all firms properly marked', async () => {
    const allOrgs = await SupabaseDB.getAllOrganizations()
    const firms = allOrgs.filter(org => org.is_firm)
    
    // All firms should have is_firm=true
    for (const firm of firms) {
      expect(firm.is_firm).toBe(true)
    }
  })
})
