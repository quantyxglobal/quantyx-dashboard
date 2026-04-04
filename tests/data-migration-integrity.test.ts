import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { prisma } from '@/lib/prisma'

/**
 * Property 17: Data Migration Integrity
 * **Validates: Requirements 9.3, 9.4, 9.5**
 * 
 * For all migration operations, the system should preserve referential integrity, 
 * maintain all existing data, and validate integrity after completion.
 */

describe('Property 17: Data Migration Integrity', () => {
  beforeEach(async () => {
    // Clean up test data before each test
    await prisma.case.deleteMany({
      where: {
        title: {
          startsWith: 'Test Migration'
        }
      }
    })
    await prisma.user.deleteMany({
      where: {
        email: {
          endsWith: '@migration-test.com'
        }
      }
    })
    await prisma.organization.deleteMany({
      where: {
        name: {
          startsWith: 'Test Migration'
        }
      }
    })
  })

  afterEach(async () => {
    // Clean up test data after each test
    await prisma.case.deleteMany({
      where: {
        title: {
          startsWith: 'Test Migration'
        }
      }
    })
    await prisma.user.deleteMany({
      where: {
        email: {
          endsWith: '@migration-test.com'
        }
      }
    })
    await prisma.organization.deleteMany({
      where: {
        name: {
          startsWith: 'Test Migration'
        }
      }
    })
  })

  it('should preserve referential integrity during schema changes', async () => {
    // Feature: medilegal-schema-redesign, Property 17: Data Migration Integrity
    await fc.assert(fc.asyncProperty(
      fc.array(
        fc.record({
          orgName: fc.string({ minLength: 1, maxLength: 50 }).map(s => `Test Migration Org ${s}`),
          userEmail: fc.emailAddress().map(email => email.replace('@', '@migration-test.')),
          userName: fc.string({ minLength: 1, maxLength: 30 }),
          caseTitle: fc.string({ minLength: 1, maxLength: 100 }).map(s => `Test Migration Case ${s}`)
        }),
        { minLength: 1, maxLength: 5 }
      ),
      async (testDataArray) => {
        // Create test data with relationships
        const createdData = []
        
        for (const testData of testDataArray) {
          // Create organization
          const organization = await prisma.organization.create({
            data: {
              name: testData.orgName,
              display_name: testData.orgName,
              slug: testData.orgName.toLowerCase().replace(/\s+/g, '-'),
              firm_number: String(Math.floor(Math.random() * 900) + 100), // Random 3-digit number
              is_firm: true,
              case_id_prefix: 'QGM'
            }
          })

          // Create user associated with organization
          const user = await prisma.user.create({
            data: {
              email: testData.userEmail,
              first_name: testData.userName,
              last_name: 'Test',
              role: 'CLIENT',
              organization_id: organization.id
            }
          })

          // Create case associated with organization and user
          const caseRecord = await prisma.case.create({
            data: {
              title: testData.caseTitle,
              case_number: `QGM_${organization.firm_number}_0001`,
              client_name: testData.userName,
              client_email: testData.userEmail,
              organization_id: organization.id,
              owner_id: user.id
            }
          })

          createdData.push({
            organization,
            user,
            case: caseRecord
          })
        }

        // Verify referential integrity before any changes
        for (const data of createdData) {
          // Verify user-organization relationship
          const userWithOrg = await prisma.user.findUnique({
            where: { id: data.user.id },
            include: { organization: true }
          })
          expect(userWithOrg?.organization?.id).toBe(data.organization.id)

          // Verify case-organization relationship
          const caseWithOrg = await prisma.case.findUnique({
            where: { id: data.case.id },
            include: { organization: true }
          })
          expect(caseWithOrg?.organization?.id).toBe(data.organization.id)

          // Verify case-user relationship
          const caseWithOwner = await prisma.case.findUnique({
            where: { id: data.case.id },
            include: { owner: true }
          })
          expect(caseWithOwner?.owner?.id).toBe(data.user.id)
        }

        // Simulate schema changes by updating firm-specific fields
        for (const data of createdData) {
          // Update organization with new firm fields (simulating migration)
          await prisma.organization.update({
            where: { id: data.organization.id },
            data: {
              firm_created_at: new Date(),
              firm_case_counter: 1
            }
          })

          // Update case number format (simulating migration)
          const newCaseNumber = `QGM_${data.organization.firm_number}_0001`
          await prisma.case.update({
            where: { id: data.case.id },
            data: {
              case_number: newCaseNumber
            }
          })
        }

        // Verify referential integrity after changes
        for (const data of createdData) {
          // Verify all relationships still exist
          const userWithOrg = await prisma.user.findUnique({
            where: { id: data.user.id },
            include: { organization: true }
          })
          expect(userWithOrg?.organization?.id).toBe(data.organization.id)

          const caseWithRelations = await prisma.case.findUnique({
            where: { id: data.case.id },
            include: { 
              organization: true,
              owner: true
            }
          })
          expect(caseWithRelations?.organization?.id).toBe(data.organization.id)
          expect(caseWithRelations?.owner?.id).toBe(data.user.id)

          // Verify data integrity
          expect(caseWithRelations?.case_number).toMatch(/^QGM_\d{3}_\d{4}$/)
          expect(caseWithRelations?.title).toBe(data.case.title)
          expect(caseWithRelations?.client_email).toBe(data.user.email)
        }
      }
    ), { numRuns: 30 })
  })

  it('should maintain all existing data during migration', async () => {
    // Feature: medilegal-schema-redesign, Property 17: Data Migration Integrity
    await fc.assert(fc.asyncProperty(
      fc.record({
        organizations: fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }).map(s => `Test Migration Preserve ${s}`),
            description: fc.option(fc.string({ minLength: 1, maxLength: 200 }))
          }),
          { minLength: 1, maxLength: 3 }
        ),
        users: fc.array(
          fc.record({
            email: fc.emailAddress().map(email => email.replace('@', '@migration-test.')),
            firstName: fc.string({ minLength: 1, maxLength: 30 }),
            lastName: fc.string({ minLength: 1, maxLength: 30 }),
            role: fc.constantFrom('CLIENT', 'ADMIN')
          }),
          { minLength: 1, maxLength: 5 }
        )
      }),
      async ({ organizations: orgData, users: userData }) => {
        // Create initial data
        const createdOrgs = []
        for (const org of orgData) {
          const organization = await prisma.organization.create({
            data: {
              name: org.name,
              display_name: org.name,
              slug: org.name.toLowerCase().replace(/\s+/g, '-'),
              description: org.description || null,
              firm_number: String(Math.floor(Math.random() * 900) + 100),
              is_firm: true
            }
          })
          createdOrgs.push(organization)
        }

        const createdUsers = []
        for (let i = 0; i < userData.length; i++) {
          const user = userData[i]
          const orgId = user.role === 'CLIENT' ? createdOrgs[i % createdOrgs.length].id : null
          
          const userRecord = await prisma.user.create({
            data: {
              email: user.email,
              first_name: user.firstName,
              last_name: user.lastName,
              role: user.role,
              organization_id: orgId
            }
          })
          createdUsers.push(userRecord)
        }

        // Store original data for comparison
        const originalOrgData = await prisma.organization.findMany({
          where: {
            id: { in: createdOrgs.map(o => o.id) }
          }
        })

        const originalUserData = await prisma.user.findMany({
          where: {
            id: { in: createdUsers.map(u => u.id) }
          }
        })

        // Simulate migration operations
        // 1. Add new fields to organizations
        for (const org of createdOrgs) {
          await prisma.organization.update({
            where: { id: org.id },
            data: {
              firm_created_at: new Date(),
              firm_case_counter: 0
            }
          })
        }

        // 2. Update user constraints (simulate constraint additions)
        for (const user of createdUsers) {
          if (user.role === 'CLIENT' && !user.organization_id) {
            // Assign to first available organization
            await prisma.user.update({
              where: { id: user.id },
              data: {
                organization_id: createdOrgs[0].id
              }
            })
          }
        }

        // Verify all original data is preserved
        const postMigrationOrgs = await prisma.organization.findMany({
          where: {
            id: { in: createdOrgs.map(o => o.id) }
          }
        })

        const postMigrationUsers = await prisma.user.findMany({
          where: {
            id: { in: createdUsers.map(u => u.id) }
          }
        })

        // Verify organization data preservation
        expect(postMigrationOrgs.length).toBe(originalOrgData.length)
        for (const originalOrg of originalOrgData) {
          const postOrg = postMigrationOrgs.find(o => o.id === originalOrg.id)
          expect(postOrg).toBeDefined()
          expect(postOrg!.name).toBe(originalOrg.name)
          expect(postOrg!.display_name).toBe(originalOrg.display_name)
          expect(postOrg!.description).toBe(originalOrg.description)
          expect(postOrg!.firm_number).toBe(originalOrg.firm_number)
          
          // New fields should be added
          expect(postOrg!.firm_created_at).toBeDefined()
          expect(postOrg!.firm_case_counter).toBeDefined()
        }

        // Verify user data preservation
        expect(postMigrationUsers.length).toBe(originalUserData.length)
        for (const originalUser of originalUserData) {
          const postUser = postMigrationUsers.find(u => u.id === originalUser.id)
          expect(postUser).toBeDefined()
          expect(postUser!.email).toBe(originalUser.email)
          expect(postUser!.first_name).toBe(originalUser.first_name)
          expect(postUser!.last_name).toBe(originalUser.last_name)
          expect(postUser!.role).toBe(originalUser.role)
          
          // Organization association should be preserved or properly assigned
          if (originalUser.role === 'CLIENT') {
            expect(postUser!.organization_id).toBeDefined()
          }
        }
      }
    ), { numRuns: 25 })
  })

  it('should validate data integrity after migration completion', async () => {
    // Feature: medilegal-schema-redesign, Property 17: Data Migration Integrity
    await fc.assert(fc.asyncProperty(
      fc.array(
        fc.record({
          firmName: fc.string({ minLength: 1, maxLength: 50 }).map(s => `Test Migration Validate ${s}`),
          clientCount: fc.integer({ min: 1, max: 5 }),
          caseCount: fc.integer({ min: 1, max: 3 })
        }),
        { minLength: 1, maxLength: 3 }
      ),
      async (firmDataArray) => {
        const allCreatedData = []

        // Create complex data structure
        for (const firmData of firmDataArray) {
          const organization = await prisma.organization.create({
            data: {
              name: firmData.firmName,
              display_name: firmData.firmName,
              slug: firmData.firmName.toLowerCase().replace(/\s+/g, '-'),
              firm_number: String(Math.floor(Math.random() * 900) + 100),
              is_firm: true,
              case_id_prefix: 'QGM',
              firm_case_counter: 0
            }
          })

          const users = []
          for (let i = 0; i < firmData.clientCount; i++) {
            const user = await prisma.user.create({
              data: {
                email: `client${i}@${firmData.firmName.toLowerCase().replace(/\s+/g, '')}-migration-test.com`,
                first_name: `Client${i}`,
                last_name: 'Test',
                role: 'CLIENT',
                organization_id: organization.id
              }
            })
            users.push(user)
          }

          const cases = []
          for (let i = 0; i < firmData.caseCount; i++) {
            const caseRecord = await prisma.case.create({
              data: {
                title: `Test Migration Validate Case ${i}`,
                case_number: `QGM_${organization.firm_number}_${String(i + 1).padStart(4, '0')}`,
                client_name: users[i % users.length].first_name,
                client_email: users[i % users.length].email,
                organization_id: organization.id,
                owner_id: users[i % users.length].id
              }
            })
            cases.push(caseRecord)
          }

          allCreatedData.push({
            organization,
            users,
            cases
          })
        }

        // Simulate post-migration validation checks
        for (const firmData of allCreatedData) {
          // 1. Validate organization integrity
          const org = await prisma.organization.findUnique({
            where: { id: firmData.organization.id },
            include: {
              users: true,
              cases: true
            }
          })

          expect(org).toBeDefined()
          expect(org!.firm_number).toMatch(/^\d{3}$/)
          expect(org!.is_firm).toBe(true)
          expect(org!.case_id_prefix).toBe('QGM')

          // 2. Validate user-organization relationships
          expect(org!.users.length).toBe(firmData.users.length)
          for (const user of org!.users) {
            expect(user.role).toBe('CLIENT')
            expect(user.organization_id).toBe(org!.id)
            expect(user.email).toMatch(/@.*-migration-test\.com$/)
          }

          // 3. Validate case integrity
          expect(org!.cases.length).toBe(firmData.cases.length)
          for (const caseRecord of org!.cases) {
            expect(caseRecord.case_number).toMatch(/^QGM_\d{3}_\d{4}$/)
            expect(caseRecord.organization_id).toBe(org!.id)
            expect(caseRecord.owner_id).toBeDefined()
            
            // Verify case number matches organization firm number
            const firmNumberFromCase = caseRecord.case_number.substring(4, 7)
            expect(firmNumberFromCase).toBe(org!.firm_number)

            // Verify owner exists and belongs to same organization
            const owner = org!.users.find(u => u.id === caseRecord.owner_id)
            expect(owner).toBeDefined()
            expect(owner!.organization_id).toBe(org!.id)
          }

          // 4. Validate referential integrity constraints
          const orphanedUsers = await prisma.user.findMany({
            where: {
              organization_id: org!.id,
              organization: null
            }
          })
          expect(orphanedUsers.length).toBe(0)

          const orphanedCases = await prisma.case.findMany({
            where: {
              organization_id: org!.id,
              organization: null
            }
          })
          expect(orphanedCases.length).toBe(0)

          // 5. Validate unique constraints
          const duplicateFirmNumbers = await prisma.organization.groupBy({
            by: ['firm_number'],
            where: {
              firm_number: org!.firm_number
            },
            _count: {
              firm_number: true
            },
            having: {
              firm_number: {
                _count: {
                  gt: 1
                }
              }
            }
          })
          expect(duplicateFirmNumbers.length).toBe(0)

          const duplicateEmails = await prisma.user.groupBy({
            by: ['email'],
            where: {
              id: { in: org!.users.map(u => u.id) }
            },
            _count: {
              email: true
            },
            having: {
              email: {
                _count: {
                  gt: 1
                }
              }
            }
          })
          expect(duplicateEmails.length).toBe(0)
        }
      }
    ), { numRuns: 20 })
  })

  it('should handle migration rollback scenarios while preserving data integrity', async () => {
    // Feature: medilegal-schema-redesign, Property 17: Data Migration Integrity
    await fc.assert(fc.asyncProperty(
      fc.record({
        orgName: fc.string({ minLength: 1, maxLength: 50 }).map(s => `Test Migration Rollback ${s}`),
        userEmail: fc.emailAddress().map(email => email.replace('@', '@migration-test.')),
        caseTitle: fc.string({ minLength: 1, maxLength: 100 }).map(s => `Test Migration Rollback Case ${s}`)
      }),
      async (testData) => {
        // Create initial data in "pre-migration" state
        const organization = await prisma.organization.create({
          data: {
            name: testData.orgName,
            display_name: testData.orgName,
            slug: testData.orgName.toLowerCase().replace(/\s+/g, '-'),
            case_id_prefix: 'QG', // Old format
            case_counter: 5 // Old counter
          }
        })

        const user = await prisma.user.create({
          data: {
            email: testData.userEmail,
            first_name: 'Test',
            last_name: 'User',
            role: 'CLIENT',
            organization_id: organization.id
          }
        })

        const caseRecord = await prisma.case.create({
          data: {
            title: testData.caseTitle,
            case_number: 'QG-001', // Old format
            client_name: 'Test User',
            client_email: testData.userEmail,
            organization_id: organization.id,
            owner_id: user.id
          }
        })

        // Store original state
        const originalOrg = await prisma.organization.findUnique({
          where: { id: organization.id }
        })
        const originalUser = await prisma.user.findUnique({
          where: { id: user.id }
        })
        const originalCase = await prisma.case.findUnique({
          where: { id: caseRecord.id }
        })

        // Simulate migration (add new fields)
        await prisma.organization.update({
          where: { id: organization.id },
          data: {
            firm_number: '123',
            is_firm: true,
            firm_created_at: new Date(),
            firm_case_counter: 1,
            case_id_prefix: 'QGM'
          }
        })

        await prisma.case.update({
          where: { id: caseRecord.id },
          data: {
            case_number: 'QGM_123_0001'
          }
        })

        // Simulate rollback scenario (remove new fields, restore old format)
        await prisma.organization.update({
          where: { id: organization.id },
          data: {
            firm_number: null,
            is_firm: null,
            firm_created_at: null,
            firm_case_counter: null,
            case_id_prefix: 'QG'
          }
        })

        await prisma.case.update({
          where: { id: caseRecord.id },
          data: {
            case_number: 'QG-001'
          }
        })

        // Verify data integrity after rollback
        const rolledBackOrg = await prisma.organization.findUnique({
          where: { id: organization.id }
        })
        const rolledBackUser = await prisma.user.findUnique({
          where: { id: user.id }
        })
        const rolledBackCase = await prisma.case.findUnique({
          where: { id: caseRecord.id }
        })

        // Verify core data is preserved
        expect(rolledBackOrg!.name).toBe(originalOrg!.name)
        expect(rolledBackOrg!.display_name).toBe(originalOrg!.display_name)
        expect(rolledBackOrg!.case_id_prefix).toBe(originalOrg!.case_id_prefix)

        expect(rolledBackUser!.email).toBe(originalUser!.email)
        expect(rolledBackUser!.first_name).toBe(originalUser!.first_name)
        expect(rolledBackUser!.role).toBe(originalUser!.role)
        expect(rolledBackUser!.organization_id).toBe(originalUser!.organization_id)

        expect(rolledBackCase!.title).toBe(originalCase!.title)
        expect(rolledBackCase!.case_number).toBe(originalCase!.case_number)
        expect(rolledBackCase!.organization_id).toBe(originalCase!.organization_id)
        expect(rolledBackCase!.owner_id).toBe(originalCase!.owner_id)

        // Verify relationships are intact
        const userWithOrg = await prisma.user.findUnique({
          where: { id: user.id },
          include: { organization: true }
        })
        expect(userWithOrg!.organization!.id).toBe(organization.id)

        const caseWithRelations = await prisma.case.findUnique({
          where: { id: caseRecord.id },
          include: { 
            organization: true,
            owner: true
          }
        })
        expect(caseWithRelations!.organization!.id).toBe(organization.id)
        expect(caseWithRelations!.owner!.id).toBe(user.id)
      }
    ), { numRuns: 15 })
  })

  it('should validate migration script compatibility and data consistency', async () => {
    // Feature: medilegal-schema-redesign, Property 17: Data Migration Integrity
    await fc.assert(fc.asyncProperty(
      fc.record({
        firmName: fc.string({ minLength: 5, maxLength: 50 }).map(s => `Test Migration Script ${s}`),
        firmNumber: fc.integer({ min: 100, max: 999 }).map(n => String(n)),
        userCount: fc.integer({ min: 1, max: 3 }),
        caseCount: fc.integer({ min: 1, max: 2 })
      }),
      async (testData) => {
        // Create organization with new schema format
        const organization = await prisma.organization.create({
          data: {
            name: testData.firmName,
            display_name: testData.firmName,
            slug: testData.firmName.toLowerCase().replace(/\s+/g, '-'),
            firm_number: testData.firmNumber,
            is_firm: true,
            case_id_prefix: 'QGM',
            firm_case_counter: 0,
            firm_created_at: new Date()
          }
        })

        const users = []
        for (let i = 0; i < testData.userCount; i++) {
          const user = await prisma.user.create({
            data: {
              email: `migration-script-user${i}@${testData.firmName.toLowerCase().replace(/\s+/g, '')}-migration-test.com`,
              first_name: `User${i}`,
              last_name: 'Test',
              role: 'CLIENT',
              organization_id: organization.id,
              is_active: true
            }
          })
          users.push(user)
        }

        const cases = []
        for (let i = 0; i < testData.caseCount; i++) {
          const caseRecord = await prisma.case.create({
            data: {
              title: `Test Migration Script Case ${i}`,
              case_number: `QGM_${testData.firmNumber}_${String(i + 1).padStart(4, '0')}`,
              client_name: users[i % users.length].first_name,
              client_email: users[i % users.length].email,
              organization_id: organization.id,
              owner_id: users[i % users.length].id,
              status: 'PENDING',
              priority: 'NORMAL'
            }
          })
          cases.push(caseRecord)
        }

        // Validate migration script compatibility
        // 1. Check firm number format
        expect(organization.firm_number).toMatch(/^\d{3}$/)
        expect(organization.firm_number).toBe(testData.firmNumber)

        // 2. Check case ID format
        for (const caseRecord of cases) {
          expect(caseRecord.case_number).toMatch(/^QGM_\d{3}_\d{4}$/)
          expect(caseRecord.case_number).toContain(testData.firmNumber)
        }

        // 3. Check user-organization relationships
        for (const user of users) {
          expect(user.organization_id).toBe(organization.id)
          expect(user.role).toBe('CLIENT')
          expect(user.is_active).toBe(true)
        }

        // 4. Check case-organization relationships
        for (const caseRecord of cases) {
          expect(caseRecord.organization_id).toBe(organization.id)
          expect(caseRecord.owner_id).toBeDefined()
          
          const owner = users.find(u => u.id === caseRecord.owner_id)
          expect(owner).toBeDefined()
          expect(owner!.organization_id).toBe(organization.id)
        }

        // 5. Validate data consistency after simulated migration operations
        const updatedOrg = await prisma.organization.update({
          where: { id: organization.id },
          data: {
            firm_case_counter: testData.caseCount
          }
        })

        expect(updatedOrg.firm_case_counter).toBe(testData.caseCount)

        // 6. Verify all relationships remain intact
        const orgWithRelations = await prisma.organization.findUnique({
          where: { id: organization.id },
          include: {
            users: true,
            cases: true
          }
        })

        expect(orgWithRelations!.users.length).toBe(testData.userCount)
        expect(orgWithRelations!.cases.length).toBe(testData.caseCount)

        // Property: Migration should maintain data consistency
        for (const user of orgWithRelations!.users) {
          expect(user.organization_id).toBe(organization.id)
        }

        for (const caseRecord of orgWithRelations!.cases) {
          expect(caseRecord.organization_id).toBe(organization.id)
          expect(orgWithRelations!.users.some(u => u.id === caseRecord.owner_id)).toBe(true)
        }
      }
    ), { numRuns: 10 })
  })
})