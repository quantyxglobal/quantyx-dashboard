import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { prisma } from '@/lib/prisma'
import { FirmManagementService } from '@/lib/firm-management-service'
import bcrypt from 'bcryptjs'

/**
 * Property 9: Firm Association Preservation
 * **Validates: Requirements 4.4**
 * 
 * For all client-to-client account creation events, the new client account should be 
 * automatically assigned to the same firm as the creating client.
 */

describe('Property 9: Firm Association Preservation', () => {
  const firmManagementService = new FirmManagementService()

  beforeEach(async () => {
    // Clean up test data before each test
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test-firm-association'
        }
      }
    })
    await prisma.organization.deleteMany({
      where: {
        name: {
          startsWith: 'Test Association Firm'
        }
      }
    })
  })

  afterEach(async () => {
    // Clean up test data after each test
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test-firm-association'
        }
      }
    })
    await prisma.organization.deleteMany({
      where: {
        name: {
          startsWith: 'Test Association Firm'
        }
      }
    })
  })

  it('should preserve firm association when client creates another client account', async () => {
    // Feature: medilegal-schema-redesign, Property 9: Firm Association Preservation
    await fc.assert(fc.asyncProperty(
      fc.record({
        firmName: fc.string({ minLength: 1, maxLength: 50 }).map(s => `Test Association Firm ${s}`),
        creatingClient: fc.record({
          firstName: fc.string({ minLength: 1, maxLength: 30 }),
          lastName: fc.string({ minLength: 1, maxLength: 30 }),
          email: fc.string({ minLength: 1, maxLength: 20 }).map(s => `creator-${s}@test-firm-association.com`)
        }),
        newClients: fc.array(
          fc.record({
            firstName: fc.string({ minLength: 1, maxLength: 30 }),
            lastName: fc.string({ minLength: 1, maxLength: 30 }),
            email: fc.string({ minLength: 1, maxLength: 20 }).map(s => `new-client-${s}@test-firm-association.com`)
          }),
          { minLength: 1, maxLength: 5 }
        )
      }),
      async ({ firmName, creatingClient, newClients }) => {
        // Create a firm first
        const firmResult = await firmManagementService.createFirm({
          name: firmName,
          displayName: firmName
        })
        expect(firmResult.success).toBe(true)
        const firmId = firmResult.firmId!

        // Create the initial client user manually (simulating existing client)
        const hashedPassword = await bcrypt.hash('tempPassword123', 12)
        const creatingUser = await prisma.user.create({
          data: {
            first_name: creatingClient.firstName,
            last_name: creatingClient.lastName,
            email: creatingClient.email,
            password_hash: hashedPassword,
            role: 'CLIENT',
            organization_id: firmId,
            is_active: true
          }
        })

        // Create new client accounts using the creating client
        const createdClients = []
        for (const newClientData of newClients) {
          const result = await firmManagementService.createClientAccount({
            firmId,
            clientData: {
              firstName: newClientData.firstName,
              lastName: newClientData.lastName,
              email: newClientData.email
            },
            createdByUserId: creatingUser.id
          })

          expect(result.success).toBe(true)
          expect(result.userId).toBeDefined()
          createdClients.push(result.userId!)
        }

        // Verify all created clients are associated with the same firm
        for (const clientId of createdClients) {
          const client = await prisma.user.findUnique({
            where: { id: clientId },
            include: { organization: true }
          })

          expect(client).toBeDefined()
          expect(client!.organization_id).toBe(firmId)
          expect(client!.organization!.id).toBe(firmId)
          expect(client!.role).toBe('CLIENT')
          expect(client!.is_active).toBe(true)
        }

        // Verify the creating client is still associated with the same firm
        const updatedCreatingUser = await prisma.user.findUnique({
          where: { id: creatingUser.id },
          include: { organization: true }
        })

        expect(updatedCreatingUser!.organization_id).toBe(firmId)
        expect(updatedCreatingUser!.organization!.id).toBe(firmId)

        // Verify all users belong to the same firm
        const allFirmUsers = await prisma.user.findMany({
          where: { organization_id: firmId },
          select: { id: true, role: true }
        })

        const expectedUserIds = [creatingUser.id, ...createdClients]
        expect(allFirmUsers.length).toBe(expectedUserIds.length)
        
        expectedUserIds.forEach(userId => {
          expect(allFirmUsers.some(user => user.id === userId)).toBe(true)
        })

        // Verify all are clients
        allFirmUsers.forEach(user => {
          expect(user.role).toBe('CLIENT')
        })
      }
    ), { numRuns: 30 })
  })

  it('should prevent clients from creating accounts in different firms', async () => {
    // Feature: medilegal-schema-redesign, Property 9: Firm Association Preservation
    await fc.assert(fc.asyncProperty(
      fc.record({
        firm1Name: fc.string({ minLength: 1, maxLength: 50 }).map(s => `Test Firm 1 ${s}`),
        firm2Name: fc.string({ minLength: 1, maxLength: 50 }).map(s => `Test Firm 2 ${s}`),
        client1: fc.record({
          firstName: fc.string({ minLength: 1, maxLength: 30 }),
          lastName: fc.string({ minLength: 1, maxLength: 30 }),
          email: fc.string({ minLength: 1, maxLength: 20 }).map(s => `client1-${s}@test-firm-association.com`)
        }),
        newClient: fc.record({
          firstName: fc.string({ minLength: 1, maxLength: 30 }),
          lastName: fc.string({ minLength: 1, maxLength: 30 }),
          email: fc.string({ minLength: 1, maxLength: 20 }).map(s => `new-${s}@test-firm-association.com`)
        })
      }),
      async ({ firm1Name, firm2Name, client1, newClient }) => {
        // Create two different firms
        const firm1Result = await firmManagementService.createFirm({
          name: firm1Name,
          displayName: firm1Name
        })
        expect(firm1Result.success).toBe(true)
        const firm1Id = firm1Result.firmId!

        const firm2Result = await firmManagementService.createFirm({
          name: firm2Name,
          displayName: firm2Name
        })
        expect(firm2Result.success).toBe(true)
        const firm2Id = firm2Result.firmId!

        // Create a client in firm1
        const hashedPassword = await bcrypt.hash('tempPassword123', 12)
        const client1User = await prisma.user.create({
          data: {
            first_name: client1.firstName,
            last_name: client1.lastName,
            email: client1.email,
            password_hash: hashedPassword,
            role: 'CLIENT',
            organization_id: firm1Id,
            is_active: true
          }
        })

        // Try to create a client account in firm2 using client from firm1
        const result = await firmManagementService.createClientAccount({
          firmId: firm2Id, // Different firm
          clientData: {
            firstName: newClient.firstName,
            lastName: newClient.lastName,
            email: newClient.email
          },
          createdByUserId: client1User.id // Client from firm1
        })

        // Should fail due to firm association mismatch
        expect(result.success).toBe(false)
        expect(result.error).toContain('same firm')

        // Verify no user was created in firm2
        const firm2Users = await prisma.user.findMany({
          where: { organization_id: firm2Id }
        })
        expect(firm2Users.length).toBe(0)

        // Verify client1 is still only in firm1
        const client1Updated = await prisma.user.findUnique({
          where: { id: client1User.id }
        })
        expect(client1Updated!.organization_id).toBe(firm1Id)
      }
    ), { numRuns: 25 })
  })

  it('should maintain firm association across multiple client creation chains', async () => {
    // Feature: medilegal-schema-redesign, Property 9: Firm Association Preservation
    await fc.assert(fc.asyncProperty(
      fc.record({
        firmName: fc.string({ minLength: 1, maxLength: 50 }).map(s => `Test Chain Firm ${s}`),
        clientChain: fc.array(
          fc.record({
            firstName: fc.string({ minLength: 1, maxLength: 30 }),
            lastName: fc.string({ minLength: 1, maxLength: 30 }),
            email: fc.string({ minLength: 1, maxLength: 20 }).map(s => `chain-${s}@test-firm-association.com`)
          }),
          { minLength: 2, maxLength: 6 }
        )
      }),
      async ({ firmName, clientChain }) => {
        // Create a firm
        const firmResult = await firmManagementService.createFirm({
          name: firmName,
          displayName: firmName
        })
        expect(firmResult.success).toBe(true)
        const firmId = firmResult.firmId!

        // Create the first client manually
        const hashedPassword = await bcrypt.hash('tempPassword123', 12)
        const firstClient = await prisma.user.create({
          data: {
            first_name: clientChain[0].firstName,
            last_name: clientChain[0].lastName,
            email: clientChain[0].email,
            password_hash: hashedPassword,
            role: 'CLIENT',
            organization_id: firmId,
            is_active: true
          }
        })

        let previousClientId = firstClient.id
        const allClientIds = [firstClient.id]

        // Create a chain where each client creates the next one
        for (let i = 1; i < clientChain.length; i++) {
          const clientData = clientChain[i]
          
          const result = await firmManagementService.createClientAccount({
            firmId,
            clientData: {
              firstName: clientData.firstName,
              lastName: clientData.lastName,
              email: clientData.email
            },
            createdByUserId: previousClientId
          })

          expect(result.success).toBe(true)
          expect(result.userId).toBeDefined()
          
          allClientIds.push(result.userId!)
          previousClientId = result.userId!
        }

        // Verify all clients in the chain belong to the same firm
        for (const clientId of allClientIds) {
          const client = await prisma.user.findUnique({
            where: { id: clientId },
            select: { 
              id: true, 
              organization_id: true, 
              role: true,
              first_name: true,
              last_name: true
            }
          })

          expect(client).toBeDefined()
          expect(client!.organization_id).toBe(firmId)
          expect(client!.role).toBe('CLIENT')
        }

        // Verify firm has exactly the expected number of users
        const firmUsers = await prisma.user.findMany({
          where: { organization_id: firmId },
          select: { id: true }
        })

        expect(firmUsers.length).toBe(clientChain.length)
        
        // Verify all created clients are in the firm
        allClientIds.forEach(clientId => {
          expect(firmUsers.some(user => user.id === clientId)).toBe(true)
        })
      }
    ), { numRuns: 20 })
  })

  it('should preserve firm association with concurrent client creation', async () => {
    // Feature: medilegal-schema-redesign, Property 9: Firm Association Preservation
    await fc.assert(fc.asyncProperty(
      fc.record({
        firmName: fc.string({ minLength: 1, maxLength: 50 }).map(s => `Test Concurrent Firm ${s}`),
        creatingClients: fc.array(
          fc.record({
            firstName: fc.string({ minLength: 1, maxLength: 30 }),
            lastName: fc.string({ minLength: 1, maxLength: 30 }),
            email: fc.string({ minLength: 1, maxLength: 20 }).map(s => `creator-${s}@test-firm-association.com`)
          }),
          { minLength: 2, maxLength: 4 }
        ),
        newClientsPerCreator: fc.array(
          fc.array(
            fc.record({
              firstName: fc.string({ minLength: 1, maxLength: 30 }),
              lastName: fc.string({ minLength: 1, maxLength: 30 }),
              email: fc.string({ minLength: 1, maxLength: 20 }).map(s => `concurrent-${s}@test-firm-association.com`)
            }),
            { minLength: 1, maxLength: 3 }
          ),
          { minLength: 2, maxLength: 4 }
        )
      }),
      async ({ firmName, creatingClients, newClientsPerCreator }) => {
        // Ensure arrays match
        const minLength = Math.min(creatingClients.length, newClientsPerCreator.length)
        const trimmedCreatingClients = creatingClients.slice(0, minLength)
        const trimmedNewClients = newClientsPerCreator.slice(0, minLength)

        // Create a firm
        const firmResult = await firmManagementService.createFirm({
          name: firmName,
          displayName: firmName
        })
        expect(firmResult.success).toBe(true)
        const firmId = firmResult.firmId!

        // Create the initial creating clients
        const hashedPassword = await bcrypt.hash('tempPassword123', 12)
        const creatingUserIds = []
        
        for (const clientData of trimmedCreatingClients) {
          const user = await prisma.user.create({
            data: {
              first_name: clientData.firstName,
              last_name: clientData.lastName,
              email: clientData.email,
              password_hash: hashedPassword,
              role: 'CLIENT',
              organization_id: firmId,
              is_active: true
            }
          })
          creatingUserIds.push(user.id)
        }

        // Create new clients concurrently from different creating clients
        const allPromises = []
        for (let i = 0; i < creatingUserIds.length; i++) {
          const creatingUserId = creatingUserIds[i]
          const newClientsForThisCreator = trimmedNewClients[i]

          for (const newClientData of newClientsForThisCreator) {
            const promise = firmManagementService.createClientAccount({
              firmId,
              clientData: {
                firstName: newClientData.firstName,
                lastName: newClientData.lastName,
                email: newClientData.email
              },
              createdByUserId: creatingUserId
            })
            allPromises.push(promise)
          }
        }

        const results = await Promise.all(allPromises)

        // Verify all creations succeeded
        results.forEach(result => {
          expect(result.success).toBe(true)
          expect(result.userId).toBeDefined()
        })

        // Verify all created clients belong to the same firm
        const createdUserIds = results.map(r => r.userId!)
        for (const userId of createdUserIds) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { organization_id: true, role: true }
          })

          expect(user!.organization_id).toBe(firmId)
          expect(user!.role).toBe('CLIENT')
        }

        // Verify total user count in firm
        const totalExpectedUsers = creatingUserIds.length + createdUserIds.length
        const firmUsers = await prisma.user.findMany({
          where: { organization_id: firmId }
        })

        expect(firmUsers.length).toBe(totalExpectedUsers)
      }
    ), { numRuns: 15 })
  })
})