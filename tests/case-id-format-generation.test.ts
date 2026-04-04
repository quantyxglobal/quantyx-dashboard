import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { CaseIdGeneratorService } from '@/lib/case-id-generator'

/**
 * Property 10: Case ID Format Generation
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**
 * 
 * For all new case creation events, the generated case ID should follow the QGM_XXX_YYYY format 
 * where XXX is the firm's 3-digit number and YYYY is a 4-digit sequential case number starting 
 * at 0001 for each firm.
 */

describe('Property 10: Case ID Format Generation', () => {

  it('should validate case ID format correctly', async () => {
    // Feature: medilegal-schema-redesign, Property 10: Case ID Format Generation
    await fc.assert(fc.property(
      fc.record({
        validIds: fc.array(
          fc.record({
            firmNumber: fc.integer({ min: 1, max: 999 }).map(n => n.toString().padStart(3, '0')),
            caseNumber: fc.integer({ min: 1, max: 9999 }).map(n => n.toString().padStart(4, '0'))
          }),
          { minLength: 1, maxLength: 10 }
        ),
        invalidIds: fc.array(
          fc.oneof(
            fc.constant('QG-001'),           // Old format
            fc.constant('QGM_1_0001'),       // Firm number not padded
            fc.constant('QGM_001_1'),        // Case number not padded
            fc.constant('QGM_001'),          // Missing case number
            fc.constant('QGM_001_0001_EXTRA'), // Extra parts
            fc.constant('QGM_ABC_0001'),     // Non-numeric firm number
            fc.constant('QGM_001_ABCD'),     // Non-numeric case number
            fc.constant(''),                 // Empty string
            fc.constant('INVALID'),          // Completely wrong format
            fc.string({ minLength: 1, maxLength: 20 }) // Random strings
          ),
          { minLength: 1, maxLength: 5 }
        )
      }),
      (testData) => {
        // Test valid IDs
        testData.validIds.forEach(validId => {
          const caseId = `QGM_${validId.firmNumber}_${validId.caseNumber}`
          expect(CaseIdGeneratorService.validateCaseIdFormat(caseId)).toBe(true)
          
          const parsed = CaseIdGeneratorService.parseCaseId(caseId)
          expect(parsed).not.toBeNull()
          expect(parsed!.firmNumber).toBe(validId.firmNumber)
          expect(parsed!.caseSequence).toBe(parseInt(validId.caseNumber))
        })

        // Test invalid IDs
        testData.invalidIds.forEach(invalidId => {
          expect(CaseIdGeneratorService.validateCaseIdFormat(invalidId)).toBe(false)
          expect(CaseIdGeneratorService.parseCaseId(invalidId)).toBeNull()
        })
      }
    ), { numRuns: 100 })
  })

  it('should generate correct format components', () => {
    // Feature: medilegal-schema-redesign, Property 10: Case ID Format Generation
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 999 }),
      fc.integer({ min: 1, max: 9999 }),
      (firmNum, caseNum) => {
        const firmNumber = firmNum.toString().padStart(3, '0')
        const caseNumber = caseNum.toString().padStart(4, '0')
        const expectedCaseId = `QGM_${firmNumber}_${caseNumber}`
        
        // Validate format
        expect(CaseIdGeneratorService.validateCaseIdFormat(expectedCaseId)).toBe(true)
        
        // Parse and verify components
        const parsed = CaseIdGeneratorService.parseCaseId(expectedCaseId)
        expect(parsed).not.toBeNull()
        expect(parsed!.firmNumber).toBe(firmNumber)
        expect(parsed!.caseSequence).toBe(caseNum)
        
        // Verify format structure
        const parts = expectedCaseId.split('_')
        expect(parts).toHaveLength(3)
        expect(parts[0]).toBe('QGM')
        expect(parts[1]).toBe(firmNumber)
        expect(parts[2]).toBe(caseNumber)
        
        // Verify padding
        expect(parts[1]).toMatch(/^\d{3}$/)
        expect(parts[2]).toMatch(/^\d{4}$/)
      }
    ), { numRuns: 200 })
  })
})