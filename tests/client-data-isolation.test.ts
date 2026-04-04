import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { 
  createTestScenario, 
  signInAsTestUser, 
  createTestCase,
  cleanupTestData 
} from './test-auth-utils'

// Feature: medilegal-schema-redesign, Property 2: Client Data Isolation
// **Validates: Requirements 1.2, 3.1, 3.2, 3.3**

describe('Property 2: Client Data Isolation', () => {
  let testData: any = null

  beforeEach(async () => {
    // Create fresh test scenario for each test
    testData = await createTestScenario('Test Isolation Firm')
  })

  afterEach(async () => {
    // Clean up test data after each test
    if (testData?.cleanup) {
      await testData.cleanup()
    }
  })

  it('should restrict client access to own firm data only', { timeout: 15000 }, async () => {
    // Create two separate firms with clients
    const firm1Data = await createTestScenario('Firm One')
    const firm2Data = await createTestScenario('Firm Two')

    try {
      // Sign in as client from firm 1
      const { client: client1Auth, error: signInError1 } = await signInAsTestUser(
        firm1Data.client.email,
        firm1Data.client.password
      )
      expect(signInError1).toBeNull()
      expect(client1Auth).toBeTruthy()

      // Create a case for firm 1
      const { data: case1, error: caseError1 } = await createTestCase(
        client1Auth,
        firm1Data.firm.id,
        'Firm 1 Test Case',
        firm1Data.client.id
      )
      expect(caseError1).toBeNull()
      expect(case1).toBeTruthy()

      // Sign in as client from firm 2
      const { client: client2Auth, error: signInError2 } = await signInAsTestUser(
        firm2Data.client.email,
        firm2Data.client.password
      )
      expect(signInError2).toBeNull()
      expect(client2Auth).toBeTruthy()

      // Create a case for firm 2
      const { data: case2, error: caseError2 } = await createTestCase(
        client2Auth,
        firm2Data.firm.id,
        'Firm 2 Test Case',
        firm2Data.client.id
      )
      expect(caseError2).toBeNull()
      expect(case2).toBeTruthy()

      // Test: Client 1 should only see their firm's cases
      const { data: client1Cases, error: client1Error } = await client1Auth
        .from('cases')
        .select('*')

      expect(client1Error).toBeNull()
      expect(client1Cases).toBeTruthy()
      expect(client1Cases.length).toBe(1)
      expect(client1Cases[0].id).toBe(case1.id)
      expect(client1Cases[0].organization_id).toBe(firm1Data.firm.id)

      // Test: Client 2 should only see their firm's cases
      const { data: client2Cases, error: client2Error } = await client2Auth
        .from('cases')
        .select('*')

      expect(client2Error).toBeNull()
      expect(client2Cases).toBeTruthy()
      expect(client2Cases.length).toBe(1)
      expect(client2Cases[0].id).toBe(case2.id)
      expect(client2Cases[0].organization_id).toBe(firm2Data.firm.id)

      // Test: Client 1 cannot access firm 2's organization data
      const { data: client1Orgs, error: client1OrgError } = await client1Auth
        .from('organizations')
        .select('*')

      expect(client1OrgError).toBeNull()
      expect(client1Orgs).toBeTruthy()
      expect(client1Orgs.length).toBe(1)
      expect(client1Orgs[0].id).toBe(firm1Data.firm.id)

      // Cleanup
      await firm1Data.cleanup()
      await firm2Data.cleanup()

    } catch (error) {
      // Ensure cleanup even if test fails
      await firm1Data.cleanup()
      await firm2Data.cleanup()
      throw error
    }
  })

  it('should allow admin global access to all firm data', { timeout: 10000 }, async () => {
    // Create two firms
    const firm1Data = await createTestScenario('Admin Test Firm 1')
    const firm2Data = await createTestScenario('Admin Test Firm 2')

    try {
      // Sign in as admin
      const { client: adminAuth, error: adminSignInError } = await signInAsTestUser(
        firm1Data.admin.email,
        firm1Data.admin.password
      )
      expect(adminSignInError).toBeNull()
      expect(adminAuth).toBeTruthy()

      // Create cases in both firms using admin privileges
      const { data: case1, error: case1Error } = await createTestCase(
        adminAuth,
        firm1Data.firm.id,
        'Admin Test Case 1',
        firm1Data.client.id
      )
      expect(case1Error).toBeNull()

      const { data: case2, error: case2Error } = await createTestCase(
        adminAuth,
        firm2Data.firm.id,
        'Admin Test Case 2',
        firm2Data.client.id
      )
      expect(case2Error).toBeNull()

      // Test: Admin should see all cases from all firms
      const { data: allCases, error: casesError } = await adminAuth
        .from('cases')
        .select('*')
        .in('id', [case1.id, case2.id])

      expect(casesError).toBeNull()
      expect(allCases).toBeTruthy()
      expect(allCases.length).toBe(2)

      // Test: Admin should see all organizations
      const { data: allOrgs, error: orgsError } = await adminAuth
        .from('organizations')
        .select('*')
        .in('id', [firm1Data.firm.id, firm2Data.firm.id])

      expect(orgsError).toBeNull()
      expect(allOrgs).toBeTruthy()
      expect(allOrgs.length).toBe(2)

      // Cleanup
      await firm1Data.cleanup()
      await firm2Data.cleanup()

    } catch (error) {
      await firm1Data.cleanup()
      await firm2Data.cleanup()
      throw error
    }
  })
})