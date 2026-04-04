import { SupabaseDB } from './supabase-db'

/**
 * Case ID Generator Service
 * 
 * Generates unique case IDs following the QGM_XXX_YYYY format:
 * - QGM_ is the fixed prefix
 * - XXX is the firm's 3-digit number (from organization.firm_number)
 * - YYYY is the 4-digit sequential case number starting at 0001 for each firm
 * 
 * Features:
 * - Thread-safe sequence generation using Supabase
 * - Firm-specific case numbering starting at 0001
 * - Sequential numbering within each firm
 * - Reset case numbering to 0001 for each new firm
 */
export class CaseIdGeneratorService {
  /**
   * Generates a unique case ID for the specified organization
   * @param organizationId - The UUID of the organization
   * @returns Promise<string> - The generated case ID in QGM_XXX_YYYY format
   * @throws Error if organization not found or sequence generation fails
   */
  async generateCaseId(organizationId: string): Promise<string> {
    return await SupabaseDB.generateCaseId(organizationId)
  }

  /**
   * Gets the next available case sequence number for a specific organization
   * @param organizationId - The UUID of the organization
   * @returns Promise<number> - The next case sequence number for the organization
   */
  async getNextCaseSequence(organizationId: string): Promise<number> {
    return await SupabaseDB.getNextCaseSequence(organizationId)
  }

  /**
   * Gets the next available firm sequence number
   * Used when creating a new firm
   * @returns Promise<number> - The next firm sequence number
   */
  async getNextFirmSequence(): Promise<number> {
    return await SupabaseDB.getNextFirmSequence()
  }

  /**
   * Validates a case ID format
   * @param caseId - The case ID to validate
   * @returns boolean - True if the case ID follows QGM_XXX_YYYY format
   */
  static validateCaseIdFormat(caseId: string): boolean {
    const caseIdRegex = /^QGM_\d{3}_\d{4}$/
    return caseIdRegex.test(caseId)
  }

  /**
   * Parses a case ID to extract firm number and case sequence
   * @param caseId - The case ID to parse
   * @returns Object with firmNumber and caseSequence, or null if invalid
   */
  static parseCaseId(caseId: string): { firmNumber: string; caseSequence: number } | null {
    if (!this.validateCaseIdFormat(caseId)) {
      return null
    }

    const parts = caseId.split('_')
    const firmNumber = parts[1]
    const caseSequence = parseInt(parts[2], 10)

    return { firmNumber, caseSequence }
  }
}

// Lazy-loaded singleton instance
let _caseIdGeneratorServiceInstance: CaseIdGeneratorService | null = null

// Export a default instance getter for convenience
export const getCaseIdGeneratorService = (): CaseIdGeneratorService => {
  if (!_caseIdGeneratorServiceInstance) {
    _caseIdGeneratorServiceInstance = new CaseIdGeneratorService()
  }
  return _caseIdGeneratorServiceInstance
}

// For backward compatibility - lazy getter
export const caseIdGeneratorService = new Proxy({} as CaseIdGeneratorService, {
  get(target, prop) {
    return getCaseIdGeneratorService()[prop as keyof CaseIdGeneratorService]
  }
})