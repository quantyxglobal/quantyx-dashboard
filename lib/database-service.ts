/**
 * Centralized Database Service using Supabase
 * 
 * This service provides a unified interface for database operations
 * using Supabase directly for fast, reliable performance.
 */

import { SupabaseDB } from '@/lib/supabase-db'

export class DatabaseService {
  /**
   * Get user with organization information
   */
  static async getUserWithOrganization(userId: string) {
    return await SupabaseDB.getUserWithOrganization(userId)
  }

  /**
   * Get user with organization and cases
   */
  static async getUserWithOrganizationAndCases(userId: string, caseLimit: number = 50) {
    return await SupabaseDB.getUserWithOrganizationAndCases(userId, caseLimit)
  }

  /**
   * Get basic user information
   */
  static async getUser(userId: string) {
    return await SupabaseDB.getUser(userId)
  }

  /**
   * Get all organizations with case counts
   */
  static async getOrganizationsWithCaseCounts() {
    return await SupabaseDB.getOrganizationsWithCaseCounts()
  }

  /**
   * Get all cases with organization information
   * For employees, only returns cases assigned to them
   */
  static async getAllCasesWithOrganization(userId?: string, userRole?: string) {
    return await SupabaseDB.getAllCasesWithOrganization(userId, userRole)
  }
}