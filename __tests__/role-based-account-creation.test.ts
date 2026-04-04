import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { UserRole } from '@prisma/client'
import { firmManagementService } from '@/lib/firm-management-service'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

/**
 * Property-Based Test for Role-Based Account Creation Permissions
 * 
 * **Validates: Requirements 2.4, 2.5, 2.6**
 * 
 * Property 7: Role-Based Account Creation Permissions
 * 
 * This test verifies that the system correctly enforces role-based permissions
 * for account creation across all user roles and scenarios.
 */

describe('Property 7: Role-Based Account Creation Permissions', () => {
  beforeEach(async () => {
    // Clean up test data before each test
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test-role-based'
        }
      }
    })
    await prisma.organization.deleteMany({
      where: {
        name: {
          startsWith: 'Test Role Based'
        }
      }
    })
  })

  afterEach(async () => {
    // Clean up test data after each test
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test-role-based'
        }
      }
    })
    await prisma.organization.deleteMany({
      where: {
        name: {
          startsWith: 'Test Role Based'
        }
      }
    })
  })

  it('should enforce super admin can create any account type', async () => {
    // Feature: medilegal-schema-redesign, Property 7: Role-Based Account Creation Permissions
    await fc.assert(fc.asyncProperty(
      fc.array(
        fc.record({
          firmName: fc.string({ minLength: 1, maxLength: 50 }).map(s => `Test Role Based Firm ${s}`),
          targetRole: fc.constantFrom('SUPER_ADMIN', 'ADMIN', 'CLIENT'),
          clientData: fc.record({
            name: fc.string({ minLength: 1, maxLength: 30 }),
            email: fc.string({ minLength: 1, maxLength: 20 }).map(s => `super-admin-${s}@test-role-based.com`)
          })
        }),
        { minLength: 1, maxLength: 5 }
      ),
      async (testCases) => {
        // Create a super admin user first
        const superAdminFirm = await prisma.organization.create({
          data: {
            name: 'Test Role Based Super Admin Firm',
            display_name: 'Test Role Based Super Admin Firm',
            slug: 'test-role-based-super-admin-firm',
            firm_number: '999',
            is_firm: true
          }
        })

        const superAdmin = await prisma.user.create({
          data: {
            first_name: 'Super',
            last_name: 'Admin',
            email: 'superadmin@test-role-based.com',
            password_hash: await bcrypt.hash('password123', 12),
            role: 'SUPER_ADMIN',
            organization_id: superAdminFirm.id,
            is_active: true
          }
        })

        // Test each case
        for (const testCase of testCases) {
          // Create target firm if needed
          let targetFirm = superAdminFirm
          if (testCase.targetRole === 'CLIENT') {
            targetFirm = await prisma.organization.create({
              data: {
                name: testCase.firmName,
                display_name: testCase.firmName,
                slug: testCase.firmName.toLowerCase().replace(/\s+/g, '-'),
                firm_number: Math.random().toString().substring(2, 5).padStart(3, '0'),
                is_firm: true
              }
            })
          }

          // Test super admin permission validation
          const permission = await firmManagementService.validateAccountCreationPermission(
            superAdmin.id,
            targetFirm.id,
            testCase.targetRole as UserRole
          )

          // Property: Super admin can create any account type - Requirements 2.4
          expect(permission.canCreate).toBe(true)
          expect(permission.reason).toBeUndefined()
        }
      }
    ), { numRuns: 10 })
  })

  it('should enforce admin can only create client accounts', async () => {
    // Feature: medilegal-schema-redesign, Property 7: Role-Based Account Creation Permissions
    await fc.assert(fc.asyncProperty(
      fc.array(
        fc.record({
          firmName: fc.string({ minLength: 1, maxLength: 50 }).map(s => `Test Role Based Admin Firm ${s}`),
          targetRole: fc.constantFrom('SUPER_ADMIN', 'ADMIN', 'CLIENT'),
          clientData: fc.record({
            name: fc.string({ minLength: 1, maxLength: 30 }),
            email: fc.string({ minLength: 1, maxLength: 20 }).map(s => `admin-${s}@test-role-based.com`)
          })
        }),
        { minLength: 1, maxLength: 5 }
      ),
      async (testCases) => {
        // Create an admin user first
        const adminFirm = await prisma.organization.create({
          data: {
            name: 'Test Role Based Admin Firm',
            display_name: 'Test Role Based Admin Firm',
            slug: 'test-role-based-admin-firm',
            firm_number: '998',
            is_firm: true
          }
        })

        const admin = await prisma.user.create({
          data: {
            first_name: 'Admin',
            last_name: 'User',
            email: 'admin@test-role-based.com',
            password_hash: await bcrypt.hash('password123', 12),
            role: 'ADMIN',
            organization_id: adminFirm.id,
            is_active: true
          }
        })

        // Test each case
        for (const testCase of testCases) {
          // Create target firm
          const targetFirm = await prisma.organization.create({
            data: {
              name: testCase.firmName,
              display_name: testCase.firmName,
              slug: testCase.firmName.toLowerCase().replace(/\s+/g, '-'),
              firm_number: Math.random().toString().substring(2, 5).padStart(3, '0'),
              is_firm: true
            }
          })

          // Test admin permission validation
          const permission = await firmManagementService.validateAccountCreationPermission(
            admin.id,
            targetFirm.id,
            testCase.targetRole as UserRole
          )

          // Property: Admin can only create client accounts - Requirements 2.5
          if (testCase.targetRole === 'CLIENT') {
            expect(permission.canCreate).toBe(true)
            expect(permission.reason).toBeUndefined()
          } else {
            expect(permission.canCreate).toBe(false)
            expect(permission.reason).toBe('Admins can only create client accounts')
          }
        }
      }
    ), { numRuns: 10 })
  })

  it('should enforce client can only create client accounts in same firm', async () => {
    // Feature: medilegal-schema-redesign, Property 7: Role-Based Account Creation Permissions
    await fc.assert(fc.asyncProperty(
      fc.array(
        fc.record({
          targetRole: fc.constantFrom('SUPER_ADMIN', 'ADMIN', 'CLIENT'),
          sameFirm: fc.boolean(),
          clientData: fc.record({
            name: fc.string({ minLength: 1, maxLength: 30 }),
            email: fc.string({ minLength: 1, maxLength: 20 }).map(s => `client-${s}@test-role-based.com`)
          })
        }),
        { minLength: 1, maxLength: 5 }
      ),
      async (testCases) => {
        // Create client user and firm
        const clientFirm = await prisma.organization.create({
          data: {
            name: 'Test Role Based Client Firm',
            display_name: 'Test Role Based Client Firm',
            slug: 'test-role-based-client-firm',
            firm_number: '997',
            is_firm: true
          }
        })

        const client = await prisma.user.create({
          data: {
            first_name: 'Client',
            last_name: 'User',
            email: 'client@test-role-based.com',
            password_hash: await bcrypt.hash('password123', 12),
            role: 'CLIENT',
            organization_id: clientFirm.id,
            is_active: true
          }
        })

        // Create different firm for testing
        const differentFirm = await prisma.organization.create({
          data: {
            name: 'Test Role Based Different Firm',
            display_name: 'Test Role Based Different Firm',
            slug: 'test-role-based-different-firm',
            firm_number: '996',
            is_firm: true
          }
        })

        // Test each case
        for (const testCase of testCases) {
          const targetFirm = testCase.sameFirm ? clientFirm : differentFirm

          // Test client permission validation
          const permission = await firmManagementService.validateAccountCreationPermission(
            client.id,
            targetFirm.id,
            testCase.targetRole as UserRole
          )

          // Property: Client can only create client accounts in same firm - Requirements 2.6
          if (testCase.targetRole === 'CLIENT' && testCase.sameFirm) {
            expect(permission.canCreate).toBe(true)
            expect(permission.reason).toBeUndefined()
          } else if (testCase.targetRole !== 'CLIENT') {
            expect(permission.canCreate).toBe(false)
            expect(permission.reason).toBe('Clients can only create client accounts')
          } else if (!testCase.sameFirm) {
            expect(permission.canCreate).toBe(false)
            expect(permission.reason).toBe('Clients can only create accounts in their own firm')
          }
        }
      }
    ), { numRuns: 10 })
  })

  it('should handle edge cases and invalid scenarios', async () => {
    // Feature: medilegal-schema-redesign, Property 7: Role-Based Account Creation Permissions
    await fc.assert(fc.asyncProperty(
      fc.record({
        invalidUserId: fc.uuid(),
        validFirmId: fc.uuid(),
        targetRole: fc.constantFrom('SUPER_ADMIN', 'ADMIN', 'CLIENT')
      }),
      async (testCase) => {
        // Test with non-existent user
        const permission = await firmManagementService.validateAccountCreationPermission(
          testCase.invalidUserId,
          testCase.validFirmId,
          testCase.targetRole as UserRole
        )

        // Property: Invalid user should be rejected
        expect(permission.canCreate).toBe(false)
        expect(permission.reason).toBe('User not found')
      }
    ), { numRuns: 5 })
  })

  it('should validate firm management service methods exist and work correctly', async () => {
    // Feature: medilegal-schema-redesign, Property 7: Role-Based Account Creation Permissions
    await fc.assert(fc.asyncProperty(
      fc.record({
        firmName: fc.string({ minLength: 5, maxLength: 50 }).map(s => `Test Validation Firm ${s}`),
        ownerEmail: fc.emailAddress().map(email => email.replace('@', '@test-role-based.')),
        ownerName: fc.string({ minLength: 2, maxLength: 30 }),
        password: fc.string({ minLength: 8, maxLength: 20 })
      }),
      async (testData) => {
        // Test firm creation with owner
        const firmResult = await firmManagementService.createFirmWithOwner({
          firmName: testData.firmName,
          ownerData: {
            name: testData.ownerName,
            email: testData.ownerEmail,
            password: testData.password
          }
        })

        // Property: Firm creation should succeed with valid data
        expect(firmResult.success).toBe(true)
        expect(firmResult.firmId).toBeDefined()
        expect(firmResult.firmNumber).toBeDefined()
        expect(firmResult.userId).toBeDefined()

        if (firmResult.success && firmResult.userId && firmResult.firmId) {
          // Test permission validation for the created user
          const permission = await firmManagementService.validateAccountCreationPermission(
            firmResult.userId,
            firmResult.firmId,
            'CLIENT'
          )

          // Property: Client should be able to create other clients in same firm
          expect(permission.canCreate).toBe(true)
          expect(permission.reason).toBeUndefined()

          // Clean up created data
          await prisma.user.deleteMany({ where: { id: firmResult.userId } })
          await prisma.organization.deleteMany({ where: { id: firmResult.firmId } })
        }
      }
    ), { numRuns: 5 })
  })
})