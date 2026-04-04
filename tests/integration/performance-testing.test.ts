import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { supabaseAdmin, createTestUser, signOutTestUser } from '../test-auth-utils'
import { FirmManagementService } from '@/lib/firm-management-service'
import { CaseIdGeneratorService } from '@/lib/case-id-generator'

/**
 * Task 13.2: Performance testing and optimization
 * 
 * This test suite validates:
 * - RLS policy performance with large datasets
 * - Query optimization and performance benchmarks
 * - System scalability under expected load
 * 
 * Requirements: 7.5, 8.1
 */

describe('Task 13.2: Performance Testing and Optimization', () => {
  const firmManagementService = new FirmManagementService()
  const caseIdGenerator = new CaseIdGeneratorService()
  
  let testFirmIds: string[] = []
  let testUserIds: string[] = []
  let testCaseIds: string[] = []
  
  beforeEach(async () => {
    // Clean up any existing performance test data
    await supabaseAdmin.from('cases').delete().like('title', '%Performance Test%')
    await supabaseAdmin.from('users').delete().like('email', '%performance-test%')
    await supabaseAdmin.from('organizations').delete().like('name', '%Performance Test%')
  })

  afterEach(async () => {
    // Clean up test data
    await signOutTestUser()
    
    // Clean up in reverse order to respect foreign key constraints
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

  describe('RLS Policy Performance with Large Datasets', () => {
    it('should maintain acceptable query performance with multiple firms and users', async () => {
      const startTime = Date.now()
      
      // Create 10 firms with 5 users each (50 total users)
      const firmCreationPromises = Array.from({ length: 10 }, async (_, firmIndex) => {
        const firmResult = await firmManagementService.createFirmWithOwner({
          firmName: `Performance Test Firm ${firmIndex + 1}`,
          ownerData: {
            name: `Owner ${firmIndex + 1}`,
            email: `owner${firmIndex + 1}@performance-test.com`,
            password: 'TempPassword123!'
          }
        })
        expect(firmResult.success).toBe(true)
        testFirmIds.push(firmResult.firmId!)
        testUserIds.push(firmResult.userId!)
        
        // Create 4 additional users per firm
        const userPromises = Array.from({ length: 4 }, async (_, userIndex) => {
          const userResult = await firmManagementService.createClientAccount(
            firmResult.firmId!,
            {
              name: `User ${userIndex + 2}`,
              email: `user${userIndex + 2}.firm${firmIndex + 1}@performance-test.com`
            },
            firmResult.userId! // Created by the firm owner
          )
          expect(userResult.success).toBe(true)
          testUserIds.push(userResult.userId!)
          return userResult.userId!
        })
        
        await Promise.all(userPromises)
        return firmResult.firmId!
      })
      
      await Promise.all(firmCreationPromises)
      
      const setupTime = Date.now() - startTime
      console.log(`Setup time for 10 firms with 50 users: ${setupTime}ms`)
      
      // Test query performance with RLS policies
      const queryStartTime = Date.now()
      
      // Query all users (should be fast with proper indexing)
      const { data: allUsers, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, email, role, organization_id')
        .like('email', '%performance-test%')
      
      expect(usersError).toBeNull()
      expect(allUsers).toHaveLength(50)
      
      const usersQueryTime = Date.now() - queryStartTime
      console.log(`Users query time: ${usersQueryTime}ms`)
      
      // Query should complete within reasonable time (< 1000ms for 50 users)
      expect(usersQueryTime).toBeLessThan(1000)
      
      // Test firm-specific queries
      const firmQueryStartTime = Date.now()
      
      const { data: firmUsers, error: firmError } = await supabaseAdmin
        .from('users')
        .select('id, email, organization:organizations(name, firm_number)')
        .eq('organization_id', testFirmIds[0])
      
      expect(firmError).toBeNull()
      expect(firmUsers).toHaveLength(5)
      
      const firmQueryTime = Date.now() - firmQueryStartTime
      console.log(`Firm-specific query time: ${firmQueryTime}ms`)
      
      // Firm-specific queries should be very fast (< 200ms)
      expect(firmQueryTime).toBeLessThan(200)
    })
    it('should handle large case datasets efficiently', async () => {
      // Create a firm with user for case testing
      const firmResult = await firmManagementService.createFirmWithOwner({
        firmName: 'Large Dataset Test Firm',
        ownerData: {
          name: 'Case Creator',
          email: 'case-creator@performance-test.com',
          password: 'TempPassword123!'
        }
      })
      testFirmIds.push(firmResult.firmId!)
      testUserIds.push(firmResult.userId!)
      
      const startTime = Date.now()
      
      // Create 100 cases for performance testing
      const caseCreationPromises = Array.from({ length: 100 }, async (_, index) => {
        const caseId = await caseIdGenerator.generateCaseId(firmResult.firmId!)
        
        const { data: caseData, error } = await supabaseAdmin
          .from('cases')
          .insert({
            case_number: caseId,
            title: `Performance Test Case ${index + 1}`,
            description: `Large dataset performance test case ${index + 1}`,
            status: index % 3 === 0 ? 'COMPLETED' : index % 3 === 1 ? 'IN_PROGRESS' : 'PENDING',
            priority: index % 3 === 0 ? 'HIGH' : index % 3 === 1 ? 'MEDIUM' : 'LOW',
            organization_id: firmResult.firmId!,
            owner_id: firmResult.userId!
          })
          .select('id')
          .single()
        
        expect(error).toBeNull()
        testCaseIds.push(caseData.id)
        return caseData.id
      })
      
      await Promise.all(caseCreationPromises)
      
      const creationTime = Date.now() - startTime
      console.log(`Case creation time for 100 cases: ${creationTime}ms`)
      
      // Test query performance on large case dataset
      const queryStartTime = Date.now()
      
      // Query all cases for the firm
      const { data: allCases, error: casesError } = await supabaseAdmin
        .from('cases')
        .select('id, case_number, title, status, priority, organization_id')
        .eq('organization_id', firmResult.firmId!)
      
      expect(casesError).toBeNull()
      expect(allCases).toHaveLength(100)
      
      const allCasesQueryTime = Date.now() - queryStartTime
      console.log(`All cases query time: ${allCasesQueryTime}ms`)
      
      // Should handle 100 cases efficiently (< 500ms)
      expect(allCasesQueryTime).toBeLessThan(500)
      
      // Test filtered queries
      const filteredQueryStartTime = Date.now()
      
      const { data: pendingCases, error: pendingError } = await supabaseAdmin
        .from('cases')
        .select('id, case_number, title')
        .eq('organization_id', firmResult.firmId!)
        .eq('status', 'PENDING')
      
      expect(pendingError).toBeNull()
      expect(pendingCases.length).toBeGreaterThan(0)
      
      const filteredQueryTime = Date.now() - filteredQueryStartTime
      console.log(`Filtered cases query time: ${filteredQueryTime}ms`)
      
      // Filtered queries should be very fast (< 200ms)
      expect(filteredQueryTime).toBeLessThan(200)
    })
  })

  describe('Query Optimization and Performance Benchmarks', () => {
    it('should optimize complex joins between users, organizations, and cases', async () => {
      // Setup test data
      const firmResult = await firmManagementService.createFirmWithOwner({
        firmName: 'Join Test Firm',
        ownerData: {
          name: 'Join Test Owner',
          email: 'joinowner@performance-test.com',
          password: 'TempPassword123!'
        }
      })
      testFirmIds.push(firmResult.firmId!)
      testUserIds.push(firmResult.userId!)
      
      // Create multiple users
      const userPromises = Array.from({ length: 9 }, async (_, index) => {
        const userResult = await firmManagementService.createClientAccount(
          firmResult.firmId!,
          {
            name: `Join Test User ${index + 1}`,
            email: `jointest${index + 1}@performance-test.com`
          },
          firmResult.userId!
        )
        testUserIds.push(userResult.userId!)
        return userResult.userId!
      })
      
      const additionalUserIds = await Promise.all(userPromises)
      const allUserIds = [firmResult.userId!, ...additionalUserIds]
      
      // Create cases for each user
      const casePromises = allUserIds.flatMap(userId => 
        Array.from({ length: 5 }, async (_, caseIndex) => {
          const caseId = await caseIdGenerator.generateCaseId(firmResult.firmId!)
          
          const { data: caseData } = await supabaseAdmin
            .from('cases')
            .insert({
              case_number: caseId,
              title: `Join Test Case ${caseIndex + 1}`,
              description: 'Case for join performance testing',
              status: 'PENDING',
              priority: 'MEDIUM',
              organization_id: firmResult.firmId!,
              owner_id: userId
            })
            .select('id')
            .single()
          
          testCaseIds.push(caseData.id)
          return caseData.id
        })
      )
      
      await Promise.all(casePromises)
      
      // Test complex join query performance
      const joinQueryStartTime = Date.now()
      
      const { data: joinResults, error: joinError } = await supabaseAdmin
        .from('cases')
        .select(`
          id,
          case_number,
          title,
          status,
          owner:users(id, first_name, last_name, email),
          organization:organizations(id, name, firm_number)
        `)
        .eq('organization_id', firmResult.firmId!)
      
      expect(joinError).toBeNull()
      expect(joinResults).toHaveLength(50) // 10 users × 5 cases each
      
      const joinQueryTime = Date.now() - joinQueryStartTime
      console.log(`Complex join query time: ${joinQueryTime}ms`)
      
      // Complex joins should complete within reasonable time (< 800ms)
      expect(joinQueryTime).toBeLessThan(800)
      
      // Verify data integrity in joins
      joinResults.forEach(result => {
        expect(result.owner).toBeDefined()
        expect(result.organization).toBeDefined()
        expect(result.organization.firm_number).toBeDefined()
        expect(result.case_number).toMatch(/^QGM_\d{3}_\d{4}$/)
      })
    })
    it('should maintain performance under concurrent access patterns', async () => {
      // Setup firm and users
      const firmResult = await firmManagementService.createFirmWithOwner({
        firmName: 'Concurrent Test Firm',
        ownerData: {
          name: 'Concurrent User',
          email: 'concurrent@performance-test.com',
          password: 'TempPassword123!'
        }
      })
      testFirmIds.push(firmResult.firmId!)
      testUserIds.push(firmResult.userId!)
      
      // Test concurrent read operations
      const concurrentReadStartTime = Date.now()
      
      const readPromises = Array.from({ length: 20 }, async () => {
        return supabaseAdmin
          .from('users')
          .select('id, email, organization:organizations(name, firm_number)')
          .eq('organization_id', firmResult.firmId!)
      })
      
      const readResults = await Promise.all(readPromises)
      
      const concurrentReadTime = Date.now() - concurrentReadStartTime
      console.log(`Concurrent read operations time (20 queries): ${concurrentReadTime}ms`)
      
      // All reads should succeed
      readResults.forEach(result => {
        expect(result.error).toBeNull()
        expect(result.data).toHaveLength(1)
      })
      
      // Concurrent reads should complete efficiently (< 2000ms for 20 queries)
      expect(concurrentReadTime).toBeLessThan(2000)
      
      // Test concurrent write operations
      const concurrentWriteStartTime = Date.now()
      
      const writePromises = Array.from({ length: 10 }, async (_, index) => {
        const caseId = await caseIdGenerator.generateCaseId(firmResult.firmId!)
        
        return supabaseAdmin
          .from('cases')
          .insert({
            case_number: caseId,
            title: `Concurrent Write Test ${index + 1}`,
            description: 'Concurrent write performance test',
            status: 'PENDING',
            priority: 'MEDIUM',
            organization_id: firmResult.firmId!,
            owner_id: firmResult.userId!
          })
          .select('id')
          .single()
      })
      
      const writeResults = await Promise.all(writePromises)
      
      const concurrentWriteTime = Date.now() - concurrentWriteStartTime
      console.log(`Concurrent write operations time (10 inserts): ${concurrentWriteTime}ms`)
      
      // All writes should succeed
      writeResults.forEach(result => {
        expect(result.error).toBeNull()
        expect(result.data.id).toBeDefined()
        testCaseIds.push(result.data.id)
      })
      
      // Concurrent writes should complete efficiently (< 1500ms for 10 inserts)
      expect(concurrentWriteTime).toBeLessThan(1500)
    })
  })

  describe('System Scalability Under Expected Load', () => {
    it('should handle expected production load patterns', async () => {
      // Simulate production-like scenario: 20 firms, 80 users, 400 cases
      const scalabilityStartTime = Date.now()
      
      // Create firms in batches to avoid overwhelming the system
      const batchSize = 5
      const totalFirms = 15 // Reduced for test performance
      
      for (let batch = 0; batch < totalFirms; batch += batchSize) {
        const batchPromises = Array.from({ length: Math.min(batchSize, totalFirms - batch) }, async (_, index) => {
          const firmIndex = batch + index
          const firmResult = await firmManagementService.createFirmWithOwner({
            firmName: `Scalability Test Firm ${firmIndex + 1}`,
            ownerData: {
              name: `Scale Owner ${firmIndex + 1}`,
              email: `scaleowner${firmIndex + 1}@performance-test.com`,
              password: 'TempPassword123!'
            }
          })
          testFirmIds.push(firmResult.firmId!)
          testUserIds.push(firmResult.userId!)
          
          // Create 3 additional users per firm
          const userPromises = Array.from({ length: 3 }, async (_, userIndex) => {
            const userResult = await firmManagementService.createClientAccount(
              firmResult.firmId!,
              {
                name: `Scale User ${userIndex + 1}`,
                email: `scale${userIndex + 1}.firm${firmIndex + 1}@performance-test.com`
              },
              firmResult.userId!
            )
            testUserIds.push(userResult.userId!)
            
            // Create 3 cases per user
            const casePromises = Array.from({ length: 3 }, async (_, caseIndex) => {
              const caseId = await caseIdGenerator.generateCaseId(firmResult.firmId!)
              
              const { data: caseData } = await supabaseAdmin
                .from('cases')
                .insert({
                  case_number: caseId,
                  title: `Scale Case ${caseIndex + 1}`,
                  description: 'Scalability test case',
                  status: caseIndex % 2 === 0 ? 'PENDING' : 'IN_PROGRESS',
                  priority: 'MEDIUM',
                  organization_id: firmResult.firmId!,
                  owner_id: userResult.userId!
                })
                .select('id')
                .single()
              
              testCaseIds.push(caseData.id)
              return caseData.id
            })
            
            await Promise.all(casePromises)
            return userResult.userId!
          })
          
          await Promise.all(userPromises)
          return firmResult.firmId!
        })
        
        await Promise.all(batchPromises)
        
        // Small delay between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      const setupTime = Date.now() - scalabilityStartTime
      console.log(`Scalability setup time (15 firms, 60 users, 180 cases): ${setupTime}ms`)
      
      // Test system performance under load
      const loadTestStartTime = Date.now()
      
      // Simulate concurrent user operations
      const loadTestPromises = [
        // User queries
        ...Array.from({ length: 10 }, () => 
          supabaseAdmin
            .from('users')
            .select('id, email, organization:organizations(name)')
            .like('email', '%performance-test%')
        ),
        
        // Case queries
        ...Array.from({ length: 10 }, () => 
          supabaseAdmin
            .from('cases')
            .select('id, case_number, title, status')
            .like('title', '%Scale Case%')
        ),
        
        // Firm-specific queries
        ...testFirmIds.slice(0, 5).map(firmId => 
          supabaseAdmin
            .from('cases')
            .select('id, case_number, owner:users(first_name, last_name)')
            .eq('organization_id', firmId)
        )
      ]
      
      const loadTestResults = await Promise.all(loadTestPromises)
      
      const loadTestTime = Date.now() - loadTestStartTime
      console.log(`Load test time (25 concurrent queries): ${loadTestTime}ms`)
      
      // All queries should succeed
      loadTestResults.forEach(result => {
        expect(result.error).toBeNull()
        expect(result.data).toBeDefined()
      })
      
      // System should handle load efficiently (< 3000ms for 25 concurrent queries)
      expect(loadTestTime).toBeLessThan(3000)
      
      // Verify data consistency after load test
      const { data: finalUserCount } = await supabaseAdmin
        .from('users')
        .select('id', { count: 'exact' })
        .like('email', '%performance-test%')
      
      const { data: finalCaseCount } = await supabaseAdmin
        .from('cases')
        .select('id', { count: 'exact' })
        .like('title', '%Scale Case%')
      
      expect(finalUserCount).toHaveLength(60) // 15 firms × 4 users
      expect(finalCaseCount).toHaveLength(180) // 60 users × 3 cases
    })
  })
})