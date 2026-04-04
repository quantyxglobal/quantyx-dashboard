import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { prisma } from '@/lib/prisma'
import { FirmManagementService } from '@/lib/firm-management-service'

/**
 * Property 8: Sequential Firm Number Generation
 * **Validates: Requirements 4.1, 4.2, 4.3**
 * 
 * For all new firm creation events, the system should assign sequential firm numbers 
 * starting from 001, ensuring uniqueness and never reusing numbers even after firm deletion.
 */

describe('Property 8: Sequential Firm Number Generation', () => {
  const firmManagementService = new FirmManagementService()

  beforeEach(async () => {
    // Clean up test data before each test
    await prisma.organization.deleteMany({
      where: {
        name: {
          startsWith: 'Test Firm'
        }
      }
    })
  })

  afterEach(async () => {
    // Clean up test data after each test
    await prisma.organization.deleteMany({
      where: {
        name: {
          startsWith: 'Test Firm'
        }
      }
    })
  })

  it('should assign sequential firm numbers starting from 001', async () => {
    // Feature: medilegal-schema-redesign, Property 8: Sequential Firm Number Generation
    await fc.assert(fc.asyncProperty(
      fc.array(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).map(s => `Test Firm ${s}`),
          displayName: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
          description: fc.option(fc.string({ minLength: 1, maxLength: 500 }))
        }),
        { minLength: 1, maxLength: 10 }
      ),
      async (firmDataArray) => {
        // Create firms sequentially
        const results = []
        
        for (const firmData of firmDataArray) {
          const result = await firmManagementService.createFirm({
            name: firmData.name,
            displayName: firmData.displayName || undefined,
            description: firmData.description || undefined
          })
          
          expect(result.success).toBe(true)
          expect(result.firmNumber).toBeDefined()
          results.push(result)
        }

        // Verify sequential numbering
        const firmNumbers = results.map(r => r.firmNumber!).sort()
        
        // Get the starting number (should account for existing firms)
        const existingFirmsCount = await prisma.organization.count({
          where: {
            name: {
              not: {
                in: ['Quantyx Global', 'Internal']
              }
            },
            id: {
              not: {
                in: results.map(r => r.firmId!).filter(Boolean)
              }
            }
          }
        })

        // Verify each firm number is sequential
        for (let i = 0; i < firmNumbers.length; i++) {
          const expectedNumber = String(existingFirmsCount + i + 1).padStart(3, '0')
          expect(firmNumbers[i]).toBe(expectedNumber)
        }

        // Verify uniqueness - no duplicates
        const uniqueNumbers = new Set(firmNumbers)
        expect(uniqueNumbers.size).toBe(firmNumbers.length)

        // Verify all numbers are 3-digit format
        firmNumbers.forEach(number => {
          expect(number).toMatch(/^\d{3}$/)
          expect(number.length).toBe(3)
        })
      }
    ), { numRuns: 50 })
  })

  it('should never reuse firm numbers even after deletion', async () => {
    // Feature: medilegal-schema-redesign, Property 8: Sequential Firm Number Generation
    await fc.assert(fc.asyncProperty(
      fc.array(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).map(s => `Test Firm Delete ${s}`),
          displayName: fc.option(fc.string({ minLength: 1, maxLength: 100 }))
        }),
        { minLength: 2, maxLength: 5 }
      ),
      async (firmDataArray) => {
        // Create initial firms
        const initialResults = []
        for (const firmData of firmDataArray) {
          const result = await firmManagementService.createFirm({
            name: firmData.name,
            displayName: firmData.displayName || undefined
          })
          expect(result.success).toBe(true)
          initialResults.push(result)
        }

        const initialNumbers = initialResults.map(r => r.firmNumber!).sort()

        // Delete some firms (simulate deletion scenario)
        const firmsToDelete = initialResults.slice(0, Math.floor(initialResults.length / 2))
        for (const firm of firmsToDelete) {
          await prisma.organization.delete({
            where: { id: firm.firmId! }
          })
        }

        // Create new firms after deletion
        const newFirmData = firmDataArray.slice(0, firmsToDelete.length).map(data => ({
          ...data,
          name: `${data.name} New`
        }))

        const newResults = []
        for (const firmData of newFirmData) {
          const result = await firmManagementService.createFirm({
            name: firmData.name,
            displayName: firmData.displayName || undefined
          })
          expect(result.success).toBe(true)
          newResults.push(result)
        }

        const newNumbers = newResults.map(r => r.firmNumber!).sort()

        // Verify new numbers don't reuse deleted numbers
        const deletedNumbers = firmsToDelete.map(f => f.firmNumber!)
        newNumbers.forEach(newNumber => {
          expect(deletedNumbers).not.toContain(newNumber)
        })

        // Verify new numbers continue the sequence
        const remainingNumbers = initialResults
          .filter(r => !firmsToDelete.some(d => d.firmId === r.firmId))
          .map(r => r.firmNumber!)
          .sort()

        const allNumbers = [...remainingNumbers, ...newNumbers].sort()
        
        // Check that numbers are still unique
        const uniqueNumbers = new Set(allNumbers)
        expect(uniqueNumbers.size).toBe(allNumbers.length)

        // Verify sequential nature (accounting for gaps from deletions)
        newNumbers.forEach(number => {
          expect(parseInt(number)).toBeGreaterThan(Math.max(...initialNumbers.map(n => parseInt(n))))
        })
      }
    ), { numRuns: 30 })
  })

  it('should handle concurrent firm creation with unique sequential numbers', async () => {
    // Feature: medilegal-schema-redesign, Property 8: Sequential Firm Number Generation
    await fc.assert(fc.asyncProperty(
      fc.array(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).map(s => `Test Concurrent Firm ${s}`),
          displayName: fc.option(fc.string({ minLength: 1, maxLength: 100 }))
        }),
        { minLength: 3, maxLength: 8 }
      ),
      async (firmDataArray) => {
        // Create firms concurrently to test race conditions
        const promises = firmDataArray.map(firmData => 
          firmManagementService.createFirm({
            name: firmData.name,
            displayName: firmData.displayName || undefined
          })
        )

        const results = await Promise.all(promises)

        // Verify all creations succeeded
        results.forEach(result => {
          expect(result.success).toBe(true)
          expect(result.firmNumber).toBeDefined()
          expect(result.firmId).toBeDefined()
        })

        // Verify all firm numbers are unique
        const firmNumbers = results.map(r => r.firmNumber!).sort()
        const uniqueNumbers = new Set(firmNumbers)
        expect(uniqueNumbers.size).toBe(firmNumbers.length)

        // Verify all numbers follow 3-digit format
        firmNumbers.forEach(number => {
          expect(number).toMatch(/^\d{3}$/)
          expect(parseInt(number)).toBeGreaterThan(0)
        })

        // Verify sequential nature (may have gaps due to concurrency, but should be ordered)
        for (let i = 1; i < firmNumbers.length; i++) {
          expect(parseInt(firmNumbers[i])).toBeGreaterThan(parseInt(firmNumbers[i - 1]))
        }
      }
    ), { numRuns: 25 })
  })

  it('should maintain firm number format consistency', async () => {
    // Feature: medilegal-schema-redesign, Property 8: Sequential Firm Number Generation
    await fc.assert(fc.asyncProperty(
      fc.integer({ min: 1, max: 20 }),
      fc.string({ minLength: 1, maxLength: 30 }).map(s => `Test Format Firm ${s}`),
      async (count, baseName) => {
        const results = []
        
        // Create specified number of firms
        for (let i = 0; i < count; i++) {
          const result = await firmManagementService.createFirm({
            name: `${baseName} ${i}`,
            displayName: `Display ${baseName} ${i}`
          })
          
          expect(result.success).toBe(true)
          results.push(result)
        }

        // Verify format consistency
        results.forEach(result => {
          const firmNumber = result.firmNumber!
          
          // Must be exactly 3 digits
          expect(firmNumber).toMatch(/^\d{3}$/)
          expect(firmNumber.length).toBe(3)
          
          // Must be zero-padded for numbers < 100
          const numValue = parseInt(firmNumber)
          if (numValue < 10) {
            expect(firmNumber.startsWith('00')).toBe(true)
          } else if (numValue < 100) {
            expect(firmNumber.startsWith('0')).toBe(true)
          }
          
          // Must be a valid positive integer
          expect(numValue).toBeGreaterThan(0)
          expect(numValue).toBeLessThan(1000)
        })

        // Verify sequential ordering
        const numbers = results.map(r => parseInt(r.firmNumber!)).sort((a, b) => a - b)
        for (let i = 1; i < numbers.length; i++) {
          expect(numbers[i]).toBeGreaterThan(numbers[i - 1])
        }
      }
    ), { numRuns: 40 })
  })
})