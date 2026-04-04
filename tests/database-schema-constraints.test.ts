import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// **Feature: medilegal-schema-redesign, Property 6: Super Admin Uniqueness**
// **Validates: Requirements 2.1**

describe('Database Schema Constraints', () => {
  beforeEach(async () => {
    // Clean up test data before each test
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'super-admin-constraint-test'
        }
      }
    })
  })

  afterEach(async () => {
    // Clean up test data after each test
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'super-admin-constraint-test'
        }
      }
    })
  })

  describe('Property 6: Super Admin Uniqueness', () => {
    it('should enforce exactly one SUPER_ADMIN account constraint', async () => {
      // Feature: medilegal-schema-redesign, Property 6: Super Admin Uniqueness
      await fc.assert(fc.asyncProperty(
        fc.array(
          fc.record({
            email: fc.string({ minLength: 5, maxLength: 20 }).map(s => `${s}@super-admin-constraint-test.com`),
            firstName: fc.string({ minLength: 2, maxLength: 30 }),
            lastName: fc.string({ minLength: 2, maxLength: 30 })
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (userDataArray) => {
          const passwordHash = await bcrypt.hash('password123', 12)
          
          // Create first SUPER_ADMIN - should succeed
          const firstSuperAdmin = await prisma.user.create({
            data: {
              email: userDataArray[0].email,
              first_name: userDataArray[0].firstName,
              last_name: userDataArray[0].lastName,
              password_hash: passwordHash,
              role: 'SUPER_ADMIN',
              is_active: true
            }
          })

          expect(firstSuperAdmin.role).toBe('SUPER_ADMIN')

          // Attempt to create additional SUPER_ADMIN accounts - should fail
          for (let i = 1; i < userDataArray.length; i++) {
            const userData = userDataArray[i]
            
            try {
              await prisma.user.create({
                data: {
                  email: userData.email,
                  first_name: userData.firstName,
                  last_name: userData.lastName,
                  password_hash: passwordHash,
                  role: 'SUPER_ADMIN',
                  is_active: true
                }
              })
              
              // If we reach here, the constraint failed
              throw new Error('Expected constraint violation but user was created')
            } catch (error) {
              // Property: Should prevent creation of multiple SUPER_ADMIN accounts
              expect(error).toBeDefined()
              // The error should be related to the constraint violation
              const errorMessage = error instanceof Error ? error.message : String(error)
              expect(
                errorMessage.includes('constraint') || 
                errorMessage.includes('unique') || 
                errorMessage.includes('super_admin') ||
                errorMessage.includes('Expected constraint violation')
              ).toBe(true)
            }
          }

          // Verify only one SUPER_ADMIN exists
          const superAdminCount = await prisma.user.count({
            where: { role: 'SUPER_ADMIN' }
          })
          expect(superAdminCount).toBe(1)
        }
      ), { numRuns: 10 })
    })

    it('should allow updating existing user to SUPER_ADMIN when none exists', async () => {
      // Feature: medilegal-schema-redesign, Property 6: Super Admin Uniqueness
      await fc.assert(fc.asyncProperty(
        fc.record({
          email: fc.string({ minLength: 5, maxLength: 20 }).map(s => `${s}@super-admin-update-test.com`),
          firstName: fc.string({ minLength: 2, maxLength: 30 }),
          lastName: fc.string({ minLength: 2, maxLength: 30 })
        }),
        async (userData) => {
          const passwordHash = await bcrypt.hash('password123', 12)
          
          // Create a regular user
          const user = await prisma.user.create({
            data: {
              email: userData.email,
              first_name: userData.firstName,
              last_name: userData.lastName,
              password_hash: passwordHash,
              role: 'ADMIN',
              is_active: true
            }
          })

          expect(user.role).toBe('ADMIN')

          // Update to SUPER_ADMIN - should succeed when no SUPER_ADMIN exists
          const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { role: 'SUPER_ADMIN' }
          })

          // Property: Should allow promotion to SUPER_ADMIN when none exists
          expect(updatedUser.role).toBe('SUPER_ADMIN')

          // Verify only one SUPER_ADMIN exists
          const superAdminCount = await prisma.user.count({
            where: { role: 'SUPER_ADMIN' }
          })
          expect(superAdminCount).toBe(1)
        }
      ), { numRuns: 10 })
    })

    it('should prevent updating user to SUPER_ADMIN when one already exists', async () => {
      // Feature: medilegal-schema-redesign, Property 6: Super Admin Uniqueness
      await fc.assert(fc.asyncProperty(
        fc.array(
          fc.record({
            email: fc.string({ minLength: 5, maxLength: 20 }).map(s => `${s}@super-admin-prevent-test.com`),
            firstName: fc.string({ minLength: 2, maxLength: 30 }),
            lastName: fc.string({ minLength: 2, maxLength: 30 })
          }),
          { minLength: 2, maxLength: 3 }
        ),
        async (userDataArray) => {
          const passwordHash = await bcrypt.hash('password123', 12)
          
          // Create existing SUPER_ADMIN
          const existingSuperAdmin = await prisma.user.create({
            data: {
              email: userDataArray[0].email,
              first_name: userDataArray[0].firstName,
              last_name: userDataArray[0].lastName,
              password_hash: passwordHash,
              role: 'SUPER_ADMIN',
              is_active: true
            }
          })

          expect(existingSuperAdmin.role).toBe('SUPER_ADMIN')

          // Create regular users and attempt to promote them
          for (let i = 1; i < userDataArray.length; i++) {
            const userData = userDataArray[i]
            
            const regularUser = await prisma.user.create({
              data: {
                email: userData.email,
                first_name: userData.firstName,
                last_name: userData.lastName,
                password_hash: passwordHash,
                role: 'ADMIN',
                is_active: true
              }
            })

            expect(regularUser.role).toBe('ADMIN')

            // Attempt to update to SUPER_ADMIN - should fail
            try {
              await prisma.user.update({
                where: { id: regularUser.id },
                data: { role: 'SUPER_ADMIN' }
              })
              
              // If we reach here, the constraint failed
              throw new Error('Expected constraint violation but user was updated')
            } catch (error) {
              // Property: Should prevent promotion to SUPER_ADMIN when one already exists
              expect(error).toBeDefined()
              const errorMessage = error instanceof Error ? error.message : String(error)
              expect(
                errorMessage.includes('constraint') || 
                errorMessage.includes('unique') || 
                errorMessage.includes('super_admin') ||
                errorMessage.includes('Expected constraint violation')
              ).toBe(true)
            }
          }

          // Verify still only one SUPER_ADMIN exists
          const superAdminCount = await prisma.user.count({
            where: { role: 'SUPER_ADMIN' }
          })
          expect(superAdminCount).toBe(1)
        }
      ), { numRuns: 10 })
    })
  })
})