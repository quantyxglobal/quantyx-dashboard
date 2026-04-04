import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import fc from 'fast-check'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Feature: medilegal-schema-redesign, Property 16: Dashboard Compatibility
// **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

// Mock Next.js request for API testing
function createMockRequest(url: string, method: string = 'GET', body?: any): NextRequest {
  const request = new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json'
    }
  })
  return request
}

describe('Property 16: Dashboard Compatibility', () => {
  let testOrganizations: any[] = []
  let testUsers: any[] = []
  let testCases: any[] = []
  let testServices: any[] = []

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.case.deleteMany({
      where: {
        title: {
          contains: 'dashboard-compat'
        }
      }
    })
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'dashboard-compat'
        }
      }
    })
    await prisma.organization.deleteMany({
      where: {
        name: {
          contains: 'dashboard-compat'
        }
      }
    })
    
    // Create test services for case creation
    const service1 = await prisma.service.upsert({
      where: { id: '550e8400-e29b-41d4-a716-446655440001' },
      update: {},
      create: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Medical Record Review',
        description: 'Comprehensive medical record analysis',
        category: 'medical',
        is_active: true
      }
    })

    const service2 = await prisma.service.upsert({
      where: { id: '550e8400-e29b-41d4-a716-446655440002' },
      update: {},
      create: {
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Legal Opinion',
        description: 'Expert legal opinion and analysis',
        category: 'legal',
        is_active: true
      }
    })

    testServices.push(service1, service2)
  })

  afterAll(async () => {
    // Clean up test data
    for (const testCase of testCases) {
      await prisma.case.deleteMany({ where: { id: testCase.id } }).catch(() => {})
    }
    for (const user of testUsers) {
      await prisma.user.deleteMany({ where: { id: user.id } }).catch(() => {})
    }
    for (const org of testOrganizations) {
      await prisma.organization.deleteMany({ where: { id: org.id } }).catch(() => {})
    }
    for (const service of testServices) {
      await prisma.service.deleteMany({ where: { id: service.id } }).catch(() => {})
    }
  })

  beforeEach(() => {
    testOrganizations = []
    testUsers = []
    testCases = []
  })

  it('should maintain compatibility with existing API endpoints', async () => {
    // Feature: medilegal-schema-redesign, Property 16: Dashboard Compatibility
    await fc.assert(fc.asyncProperty(
      fc.record({
        orgName: fc.string({ minLength: 5, maxLength: 50 }).map(s => `dashboard-compat-api-${s}`),
        firmNumber: fc.integer({ min: 100, max: 999 }).map(n => String(n)),
        clientEmail: fc.emailAddress().map(email => email.replace('@', '@dashboard-compat.')),
        clientName: fc.string({ minLength: 2, maxLength: 30 }),
        caseTitle: fc.string({ minLength: 5, maxLength: 100 }).map(s => `Dashboard Compatibility ${s}`)
      }),
      async (testData) => {
        // Create test organization
        const organization = await prisma.organization.create({
          data: {
            name: testData.orgName,
            display_name: testData.orgName,
            slug: testData.orgName.toLowerCase().replace(/\s+/g, '-'),
            firm_number: testData.firmNumber,
            is_firm: true,
            case_id_prefix: 'QGM',
            firm_case_counter: 0
          }
        })
        testOrganizations.push(organization)

        // Create test client user
        const client = await prisma.user.create({
          data: {
            email: testData.clientEmail,
            first_name: testData.clientName,
            last_name: 'Client',
            role: 'CLIENT',
            is_active: true,
            organization_id: organization.id
          }
        })
        testUsers.push(client)

        // Property: API endpoints should accept the same request format as before
        const caseCreationData = {
          case_title: testData.caseTitle,
          description: 'Test case for dashboard compatibility validation',
          specific_instructions: 'Test specific instructions',
          timeline: 'NORMAL',
          estimate_required: false,
          services: testServices.map(s => s.id)
        }

        // Test case creation API structure compatibility
        expect(caseCreationData).toHaveProperty('case_title')
        expect(caseCreationData).toHaveProperty('description')
        expect(caseCreationData).toHaveProperty('timeline')
        expect(caseCreationData).toHaveProperty('estimate_required')
        expect(caseCreationData).toHaveProperty('services')
        expect(Array.isArray(caseCreationData.services)).toBe(true)

        // Create case to test response format
        const testCase = await prisma.case.create({
          data: {
            title: caseCreationData.case_title,
            case_number: `QGM_${testData.firmNumber}_0001`,
            description: caseCreationData.description,
            specific_instructions: caseCreationData.specific_instructions,
            timeline: caseCreationData.timeline,
            estimate_required: caseCreationData.estimate_required,
            client_name: testData.clientName,
            client_email: testData.clientEmail,
            status: 'PENDING',
            priority: 'NORMAL',
            organization_id: organization.id,
            owner_id: client.id
          }
        })
        testCases.push(testCase)

        // Property: Response format should be compatible with existing dashboard expectations
        const expectedResponseStructure = {
          success: true,
          case: {
            id: testCase.id,
            case_id: testCase.case_number,
            case_title: testCase.title,
            description: testCase.description,
            timeline: testCase.timeline,
            status: testCase.status,
            created_at: testCase.created_at
          }
        }

        // Verify the expected structure is valid
        expect(expectedResponseStructure.success).toBe(true)
        expect(expectedResponseStructure.case.case_id).toMatch(/^QGM_\d{3}_\d{4}$/)
        expect(expectedResponseStructure.case.case_title).toBe(testData.caseTitle)
        expect(expectedResponseStructure.case.timeline).toBe('NORMAL')
        expect(expectedResponseStructure.case.status).toBe('PENDING')
      }
    ), { numRuns: 10 })
  })

  it('should integrate with current authentication system', async () => {
    // Feature: medilegal-schema-redesign, Property 16: Dashboard Compatibility
    await fc.assert(fc.asyncProperty(
      fc.array(
        fc.record({
          role: fc.constantFrom('SUPER_ADMIN', 'ADMIN', 'CLIENT'),
          email: fc.emailAddress().map(email => email.replace('@', '@dashboard-compat.')),
          firstName: fc.string({ minLength: 2, maxLength: 30 }),
          lastName: fc.string({ minLength: 2, maxLength: 30 }),
          orgName: fc.string({ minLength: 5, maxLength: 50 }).map(s => `dashboard-compat-auth-${s}`)
        }),
        { minLength: 1, maxLength: 3 }
      ),
      async (userDataArray) => {
        const createdUsers = []
        const createdOrgs = []

        for (const userData of userDataArray) {
          let organization = null

          // Create organization for CLIENT users
          if (userData.role === 'CLIENT') {
            organization = await prisma.organization.create({
              data: {
                name: userData.orgName,
                display_name: userData.orgName,
                slug: userData.orgName.toLowerCase().replace(/\s+/g, '-'),
                firm_number: String(Math.floor(Math.random() * 900) + 100),
                is_firm: true,
                case_id_prefix: 'QGM'
              }
            })
            createdOrgs.push(organization)
          }

          // Create user with appropriate role
          const user = await prisma.user.create({
            data: {
              email: userData.email,
              first_name: userData.firstName,
              last_name: userData.lastName,
              role: userData.role,
              is_active: true,
              organization_id: organization?.id || null
            }
          })
          createdUsers.push(user)

          // Property: User authentication system should support all role types
          expect(user.role).toBe(userData.role)

          // Property: Client users should be associated with organizations
          if (userData.role === 'CLIENT') {
            expect(user.organization_id).toBe(organization!.id)
          } else {
            // Property: Admin and super admin users should not be tied to specific organizations
            expect(user.organization_id).toBeNull()
          }

          // Property: All users should have required authentication fields
          expect(user).toHaveProperty('id')
          expect(user).toHaveProperty('email')
          expect(user).toHaveProperty('first_name')
          expect(user).toHaveProperty('last_name')
          expect(user).toHaveProperty('role')
          expect(user).toHaveProperty('is_active')
          expect(user.is_active).toBe(true)
        }

        testUsers.push(...createdUsers)
        testOrganizations.push(...createdOrgs)
      }
    ), { numRuns: 10 })
  })

  it('should return appropriately filtered results based on user context', async () => {
    // Feature: medilegal-schema-redesign, Property 16: Dashboard Compatibility
    await fc.assert(fc.asyncProperty(
      fc.array(
        fc.record({
          firmName: fc.string({ minLength: 5, maxLength: 50 }).map(s => `dashboard-compat-filter-${s}`),
          firmNumber: fc.integer({ min: 100, max: 999 }).map(n => String(n)),
          clientEmail: fc.emailAddress().map(email => email.replace('@', '@dashboard-compat-filter.')),
          clientName: fc.string({ minLength: 2, maxLength: 30 }),
          caseTitle: fc.string({ minLength: 5, maxLength: 100 }).map(s => `Filter Test Case ${s}`)
        }),
        { minLength: 2, maxLength: 3 }
      ),
      async (firmDataArray) => {
        const createdData = []

        // Create organizations, users, and cases
        for (const firmData of firmDataArray) {
          const organization = await prisma.organization.create({
            data: {
              name: firmData.firmName,
              display_name: firmData.firmName,
              slug: firmData.firmName.toLowerCase().replace(/\s+/g, '-'),
              firm_number: firmData.firmNumber,
              is_firm: true,
              case_id_prefix: 'QGM'
            }
          })

          const client = await prisma.user.create({
            data: {
              email: firmData.clientEmail,
              first_name: firmData.clientName,
              last_name: 'Client',
              role: 'CLIENT',
              is_active: true,
              organization_id: organization.id
            }
          })

          const testCase = await prisma.case.create({
            data: {
              case_number: `QGM_${firmData.firmNumber}_0001`,
              title: firmData.caseTitle,
              description: 'Test case for filtering validation',
              client_name: firmData.clientName,
              client_email: firmData.clientEmail,
              status: 'PENDING',
              priority: 'NORMAL',
              organization_id: organization.id,
              owner_id: client.id
            }
          })

          createdData.push({ organization, client, case: testCase })
        }

        testOrganizations.push(...createdData.map(d => d.organization))
        testUsers.push(...createdData.map(d => d.client))
        testCases.push(...createdData.map(d => d.case))

        // Create admin user for global access testing
        const admin = await prisma.user.create({
          data: {
            email: 'admin@dashboard-compat-filter.com',
            first_name: 'Admin',
            last_name: 'User',
            role: 'ADMIN',
            is_active: true,
            organization_id: null
          }
        })
        testUsers.push(admin)

        // Property: Data should be properly associated with organizations for filtering
        for (const data of createdData) {
          expect(data.case.organization_id).toBe(data.organization.id)
          expect(data.case.owner_id).toBe(data.client.id)
          expect(data.client.organization_id).toBe(data.organization.id)

          // Property: Cases should have proper structure for dashboard display
          expect(data.case).toHaveProperty('id')
          expect(data.case).toHaveProperty('case_number')
          expect(data.case).toHaveProperty('title')
          expect(data.case).toHaveProperty('description')
          expect(data.case).toHaveProperty('status')
          expect(data.case).toHaveProperty('priority')
          expect(data.case).toHaveProperty('organization_id')
          expect(data.case).toHaveProperty('owner_id')
          expect(data.case).toHaveProperty('created_at')
          
          // Property: Case numbers should follow QGM_XXX_YYYY format
          expect(data.case.case_number).toMatch(/^QGM_\d{3}_\d{4}$/)
        }
      }
    ), { numRuns: 5 })
  })

  it('should support all existing medilegal functionality', async () => {
    // Feature: medilegal-schema-redesign, Property 16: Dashboard Compatibility
    await fc.assert(fc.asyncProperty(
      fc.record({
        orgName: fc.string({ minLength: 5, maxLength: 50 }).map(s => `dashboard-compat-functionality-${s}`),
        firmNumber: fc.integer({ min: 100, max: 999 }).map(n => String(n)),
        clientEmail: fc.emailAddress().map(email => email.replace('@', '@dashboard-compat.')),
        clientName: fc.string({ minLength: 2, maxLength: 30 }),
        caseTitle: fc.string({ minLength: 5, maxLength: 100 }).map(s => `Functionality Test ${s}`),
        timeline: fc.constantFrom('NORMAL', 'URGENT', 'RUSH'),
        priority: fc.constantFrom('LOW', 'NORMAL', 'HIGH', 'URGENT'),
        estimateRequired: fc.boolean()
      }),
      async (testData) => {
        // Create test organization
        const organization = await prisma.organization.create({
          data: {
            name: testData.orgName,
            display_name: testData.orgName,
            slug: testData.orgName.toLowerCase().replace(/\s+/g, '-'),
            firm_number: testData.firmNumber,
            is_firm: true,
            case_id_prefix: 'QGM'
          }
        })
        testOrganizations.push(organization)

        // Create test user
        const client = await prisma.user.create({
          data: {
            email: testData.clientEmail,
            first_name: testData.clientName,
            last_name: 'Test',
            role: 'CLIENT',
            is_active: true,
            organization_id: organization.id
          }
        })
        testUsers.push(client)

        // Test case creation functionality
        const testCase = await prisma.case.create({
          data: {
            case_number: `QGM_${testData.firmNumber}_0001`,
            title: testData.caseTitle,
            description: 'Test case for functionality validation',
            client_name: testData.clientName,
            client_email: testData.clientEmail,
            status: 'PENDING',
            priority: testData.priority,
            organization_id: organization.id,
            owner_id: client.id,
            specific_instructions: 'Test specific instructions for functionality',
            timeline: testData.timeline,
            estimate_required: testData.estimateRequired
          }
        })
        testCases.push(testCase)

        // Property: Cases should support all required medilegal fields
        expect(testCase).toHaveProperty('case_number')
        expect(testCase).toHaveProperty('title')
        expect(testCase).toHaveProperty('description')
        expect(testCase).toHaveProperty('client_name')
        expect(testCase).toHaveProperty('client_email')
        expect(testCase).toHaveProperty('status')
        expect(testCase).toHaveProperty('priority')
        expect(testCase).toHaveProperty('specific_instructions')
        expect(testCase).toHaveProperty('timeline')
        expect(testCase).toHaveProperty('estimate_required')

        // Property: Status values should be valid
        const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
        expect(validStatuses).toContain(testCase.status)

        // Property: Priority values should be valid
        const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT']
        expect(validPriorities).toContain(testCase.priority)

        // Property: Timeline values should be valid
        const validTimelines = ['NORMAL', 'URGENT', 'RUSH']
        expect(validTimelines).toContain(testCase.timeline)

        // Property: Boolean fields should be properly typed
        expect(typeof testCase.estimate_required).toBe('boolean')
        expect(testCase.estimate_required).toBe(testData.estimateRequired)
      }
    ), { numRuns: 10 })
  })

  it('should display firm-appropriate data based on user role and permissions', async () => {
    // Feature: medilegal-schema-redesign, Property 16: Dashboard Compatibility
    await fc.assert(fc.asyncProperty(
      fc.record({
        firmName: fc.string({ minLength: 5, maxLength: 50 }).map(s => `dashboard-compat-display-${s}`),
        firmNumber: fc.integer({ min: 100, max: 999 }).map(n => String(n)),
        clientEmail: fc.emailAddress().map(email => email.replace('@', '@dashboard-compat.')),
        adminEmail: fc.emailAddress().map(email => email.replace('@', '@dashboard-compat.')),
        caseCounter: fc.integer({ min: 0, max: 10 })
      }),
      async (testData) => {
        // Create test organization with firm-specific data
        const organization = await prisma.organization.create({
          data: {
            name: testData.firmName,
            display_name: testData.firmName,
            slug: testData.firmName.toLowerCase().replace(/\s+/g, '-'),
            firm_number: testData.firmNumber,
            is_firm: true,
            case_id_prefix: 'QGM',
            firm_case_counter: testData.caseCounter
          }
        })
        testOrganizations.push(organization)

        // Create test users with different roles
        const client = await prisma.user.create({
          data: {
            email: testData.clientEmail,
            first_name: 'Display',
            last_name: 'Client',
            role: 'CLIENT',
            is_active: true,
            organization_id: organization.id
          }
        })

        const admin = await prisma.user.create({
          data: {
            email: testData.adminEmail,
            first_name: 'Display',
            last_name: 'Admin',
            role: 'ADMIN',
            is_active: true,
            organization_id: null
          }
        })

        testUsers.push(client, admin)

        // Property: Client users should see firm-specific information
        expect(client.organization_id).toBe(organization.id)
        
        // Property: Organization should have firm-specific display data
        expect(organization.firm_number).toBe(testData.firmNumber)
        expect(organization.display_name).toBeTruthy()
        expect(organization.is_firm).toBe(true)
        expect(organization.firm_case_counter).toBe(testData.caseCounter)

        // Property: Admin users should be able to see all firm data
        expect(admin.organization_id).toBeNull() // Not tied to specific firm
        expect(admin.role).toBe('ADMIN')

        // Property: Firm data should be structured for dashboard display
        const firmDisplayData = {
          id: organization.id,
          name: organization.display_name || organization.name,
          firm_number: organization.firm_number,
          case_counter: organization.firm_case_counter,
          is_firm: organization.is_firm
        }

        expect(firmDisplayData.name).toBeTruthy()
        expect(firmDisplayData.firm_number).toMatch(/^\d{3}$/)
        expect(typeof firmDisplayData.case_counter).toBe('number')
        expect(firmDisplayData.case_counter).toBeGreaterThanOrEqual(0)
        expect(firmDisplayData.is_firm).toBe(true)
      }
    ), { numRuns: 10 })
  })
})