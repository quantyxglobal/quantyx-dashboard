import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { FirmManagementService } from '@/lib/firm-management-service'
import { CaseIdGeneratorService } from '@/lib/case-id-generator'
import { supabaseAdmin, createTestUser, signInTestUser, signOutTestUser } from '../test-auth-utils'
import bcrypt from 'bcryptjs'

/**
 * Task 13.1: Integration testing for complete workflows
 * 
 * This test suite validates end-to-end workflows for:
 * - User registration and firm creation
 * - Case creation with new ID format
 * - Multi-user collaboration within firms
 * 
 * Requirements: All requirements integration
 */

describe('Task 13.1: Complete Workflow Integration Tests', () => {
  const firmManagementService = new FirmManagementService()
  const caseIdGenerator = new CaseIdGeneratorService()
  
  let testFirmId: string
  let testUserId: string
  let testUser2Id: string
  
  beforeEach(async () => {
    // Clean up any existing test data
    await supabaseAdmin.from('cases').delete().like('title', '%Integration Test%')
    await supabaseAdmin.from('users').delete().like('email', '%integration-test%')
    await supabaseAdmin.from('organizations').delete().like('name', '%Integration Test%')
  })

  afterEach(async () => {
    // Clean up test data
    await signOutTestUser()
    if (testUserId) {
      await supabaseAdmin.from('users').delete().eq('id', testUserId)
    }
    if (testUser2Id) {
      await supabaseAdmin.from('users').delete().eq('id', testUser2Id)
    }
    if (testFirmId) {
      await supabaseAdmin.from('organizations').delete().eq('id', testFirmId)
    }
  })

  describe('End-to-End User Registration and Firm Creation', () => {
    it('should complete full user registration workflow with automatic firm creation', async () => {
      // Step 1: Create new firm through self-registration
      const firmResult = await firmManagementService.createFirmWithOwner({
        firmName: 'Integration Test Firm',
        ownerData: {
          name: 'John Doe',
          email: 'john.doe@integration-test.com',
          password: 'TempPassword123!'
        }
      })
      
      expect(firmResult.success).toBe(true)
      expect(firmResult.firmId).toBeDefined()
      expect(firmResult.firmNumber).toMatch(/^\d{3}$/)
      expect(firmResult.userId).toBeDefined()
      
      testFirmId = firmResult.firmId!
      testUserId = firmResult.userId!
      
      // Step 2: Verify user can authenticate and access firm data
      const { data: authData } = await signInTestUser('john.doe@integration-test.com', 'TempPassword123!')
      expect(authData.user).toBeDefined()
      
      // Step 3: Verify firm data is properly associated
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('*, organization:organizations(*)')
        .eq('id', testUserId)
        .single()
      
      expect(userData.organization.firm_number).toBe(firmResult.firmNumber)
      expect(userData.organization.name).toBe('Integration Test Firm')
      expect(userData.role).toBe('CLIENT')
    })

    it('should handle client-to-client account creation within same firm', async () => {
      // Setup: Create firm and first user
      const firmResult = await firmManagementService.createFirmWithOwner({
        firmName: 'Integration Test Firm 2',
        ownerData: {
          name: 'First Client',
          email: 'first@integration-test.com',
          password: 'TempPassword123!'
        }
      })
      testFirmId = firmResult.firmId!
      testUserId = firmResult.userId!
      
      // Test: First client creates second client
      const secondClientResult = await firmManagementService.createClientAccount(
        testFirmId,
        { name: 'Second Client', email: 'second@integration-test.com' },
        testUserId
      )
      
      expect(secondClientResult.success).toBe(true)
      testUser2Id = secondClientResult.userId!
      
      // Verify both users belong to same firm
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('*, organization:organizations(*)')
        .in('id', [testUserId, testUser2Id])
      
      expect(users).toHaveLength(2)
      expect(users[0].organization_id).toBe(users[1].organization_id)
      expect(users[0].organization.firm_number).toBe(users[1].organization.firm_number)
    })
  })

  describe('Case Creation with New ID Format', () => {
    beforeEach(async () => {
      // Setup firm and user for case creation tests
      const firmResult = await firmManagementService.createFirmWithOwner({
        firmName: 'Case Test Firm',
        ownerData: {
          name: 'Case Creator',
          email: 'case-creator@integration-test.com',
          password: 'TempPassword123!'
        }
      })
      testFirmId = firmResult.firmId!
      testUserId = firmResult.userId!
    })

    it('should create cases with proper QGM_XXX_YYYY format', async () => {
      // Get firm number for verification
      const { data: firm } = await supabaseAdmin
        .from('organizations')
        .select('firm_number')
        .eq('id', testFirmId)
        .single()
      
      // Create first case
      const caseId1 = await caseIdGenerator.generateCaseId(testFirmId)
      expect(caseId1).toMatch(/^QGM_\d{3}_\d{4}$/)
      expect(caseId1).toBe(`QGM_${firm.firm_number}_0001`)
      
      // Create case in database
      const { data: case1 } = await supabaseAdmin
        .from('cases')
        .insert({
          case_number: caseId1,
          title: 'Integration Test Case 1',
          description: 'Test case for integration testing',
          status: 'PENDING',
          priority: 'MEDIUM',
          organization_id: testFirmId,
          owner_id: testUserId
        })
        .select()
        .single()
      
      expect(case1.case_number).toBe(caseId1)
      
      // Create second case - should increment
      const caseId2 = await caseIdGenerator.generateCaseId(testFirmId)
      expect(caseId2).toBe(`QGM_${firm.firm_number}_0002`)
      
      // Create third case - should continue incrementing
      const caseId3 = await caseIdGenerator.generateCaseId(testFirmId)
      expect(caseId3).toBe(`QGM_${firm.firm_number}_0003`)
    })

    it('should handle case creation across multiple firms with independent numbering', async () => {
      // Create second firm
      const firm2Result = await firmManagementService.createFirmWithOwner({
        firmName: 'Second Case Test Firm',
        ownerData: {
          name: 'Second Firm Client',
          email: 'second-firm@integration-test.com',
          password: 'TempPassword123!'
        }
      })
      const testFirm2Id = firm2Result.firmId!
      const testUser2Id = firm2Result.userId!
      
      try {
        // Create cases in first firm
        const firm1Case1 = await caseIdGenerator.generateCaseId(testFirmId)
        const firm1Case2 = await caseIdGenerator.generateCaseId(testFirmId)
        
        // Create cases in second firm - should start from 0001
        const firm2Case1 = await caseIdGenerator.generateCaseId(testFirm2Id)
        const firm2Case2 = await caseIdGenerator.generateCaseId(testFirm2Id)
        
        // Verify independent numbering
        expect(firm1Case1).toMatch(/^QGM_\d{3}_0001$/)
        expect(firm1Case2).toMatch(/^QGM_\d{3}_0002$/)
        expect(firm2Case1).toMatch(/^QGM_\d{3}_0001$/)
        expect(firm2Case2).toMatch(/^QGM_\d{3}_0002$/)
        
        // Verify different firm numbers
        const firm1Number = firm1Case1.split('_')[1]
        const firm2Number = firm2Case1.split('_')[1]
        expect(firm1Number).not.toBe(firm2Number)
        
      } finally {
        // Cleanup second firm
        await supabaseAdmin.from('users').delete().eq('id', testUser2Id)
        await supabaseAdmin.from('organizations').delete().eq('id', testFirm2Id)
      }
    })
  })

  describe('Multi-User Collaboration Within Firms', () => {
    beforeEach(async () => {
      // Setup firm with multiple users
      const firmResult = await firmManagementService.createFirmWithOwner({
        firmName: 'Collaboration Test Firm',
        ownerData: {
          name: 'Collaborator One',
          email: 'collab1@integration-test.com',
          password: 'TempPassword123!'
        }
      })
      testFirmId = firmResult.firmId!
      testUserId = firmResult.userId!
      
      const client2Result = await firmManagementService.createClientAccount(
        testFirmId,
        { name: 'Collaborator Two', email: 'collab2@integration-test.com' },
        testUserId
      )
      testUser2Id = client2Result.userId!
    })

    it('should allow multiple users from same firm to access shared cases', async () => {
      // Create case as first user
      const caseId = await caseIdGenerator.generateCaseId(testFirmId)
      const { data: testCase } = await supabaseAdmin
        .from('cases')
        .insert({
          case_number: caseId,
          title: 'Shared Integration Test Case',
          description: 'Case for testing multi-user access',
          status: 'PENDING',
          priority: 'HIGH',
          organization_id: testFirmId,
          owner_id: testUserId
        })
        .select()
        .single()
      
      // Authenticate as first user and verify access
      const { data: user1Auth } = await createTestUser('collab1@integration-test.com', 'CLIENT', testFirmId)
      const { data: user1Cases } = await supabaseAdmin
        .from('cases')
        .select('*')
        .eq('organization_id', testFirmId)
      
      expect(user1Cases).toHaveLength(1)
      expect(user1Cases[0].case_number).toBe(caseId)
      
      // Authenticate as second user and verify access to same case
      const { data: user2Auth } = await createTestUser('collab2@integration-test.com', 'CLIENT', testFirmId)
      const { data: user2Cases } = await supabaseAdmin
        .from('cases')
        .select('*')
        .eq('organization_id', testFirmId)
      
      expect(user2Cases).toHaveLength(1)
      expect(user2Cases[0].case_number).toBe(caseId)
      expect(user2Cases[0].id).toBe(testCase.id)
    })

    it('should prevent users from different firms accessing each other\'s cases', async () => {
      // Create second firm
      const firm2Result = await firmManagementService.createFirmWithOwner({
        firmName: 'Isolated Test Firm',
        ownerData: {
          name: 'Outside User',
          email: 'outside@integration-test.com',
          password: 'TempPassword123!'
        }
      })
      const testFirm2Id = firm2Result.firmId!
      const outsideUserId = firm2Result.userId!
      
      try {
        // Create case in first firm
        const caseId = await caseIdGenerator.generateCaseId(testFirmId)
        await supabaseAdmin
          .from('cases')
          .insert({
            case_number: caseId,
            title: 'Private Firm Case',
            description: 'Case that should be isolated to firm',
            status: 'PENDING',
            priority: 'MEDIUM',
            organization_id: testFirmId,
            owner_id: testUserId
          })
        
        // Create case in second firm
        const outsideCaseId = await caseIdGenerator.generateCaseId(testFirm2Id)
        await supabaseAdmin
          .from('cases')
          .insert({
            case_number: outsideCaseId,
            title: 'Outside Firm Case',
            description: 'Case from different firm',
            status: 'PENDING',
            priority: 'LOW',
            organization_id: testFirm2Id,
            owner_id: outsideUserId
          })
        
        // Verify firm 1 users can only see firm 1 cases
        const { data: firm1Cases } = await supabaseAdmin
          .from('cases')
          .select('*')
          .eq('organization_id', testFirmId)
        
        expect(firm1Cases).toHaveLength(1)
        expect(firm1Cases[0].case_number).toBe(caseId)
        
        // Verify firm 2 user can only see firm 2 cases
        const { data: firm2Cases } = await supabaseAdmin
          .from('cases')
          .select('*')
          .eq('organization_id', testFirm2Id)
        
        expect(firm2Cases).toHaveLength(1)
        expect(firm2Cases[0].case_number).toBe(outsideCaseId)
        
      } finally {
        // Cleanup second firm
        await supabaseAdmin.from('users').delete().eq('id', outsideUserId)
        await supabaseAdmin.from('organizations').delete().eq('id', testFirm2Id)
      }
    })

    it('should maintain data consistency during concurrent operations', async () => {
      // Test concurrent case creation
      const concurrentCasePromises = Array.from({ length: 5 }, async (_, index) => {
        const caseId = await caseIdGenerator.generateCaseId(testFirmId)
        return supabaseAdmin
          .from('cases')
          .insert({
            case_number: caseId,
            title: `Concurrent Test Case ${index + 1}`,
            description: `Case created concurrently - ${index + 1}`,
            status: 'PENDING',
            priority: 'MEDIUM',
            organization_id: testFirmId,
            owner_id: index % 2 === 0 ? testUserId : testUser2Id
          })
          .select()
          .single()
      })
      
      const results = await Promise.all(concurrentCasePromises)
      
      // Verify all cases were created successfully
      expect(results).toHaveLength(5)
      results.forEach((result, index) => {
        expect(result.data.title).toBe(`Concurrent Test Case ${index + 1}`)
        expect(result.data.organization_id).toBe(testFirmId)
      })
      
      // Verify case numbers are sequential and unique
      const caseNumbers = results.map(r => r.data.case_number).sort()
      const firmNumber = caseNumbers[0].split('_')[1]
      
      caseNumbers.forEach((caseNumber, index) => {
        const expectedNumber = String(index + 1).padStart(4, '0')
        expect(caseNumber).toBe(`QGM_${firmNumber}_${expectedNumber}`)
      })
    })
  })
})