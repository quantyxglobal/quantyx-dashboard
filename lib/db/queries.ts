import { SupabaseDB, getSupabaseClient } from '@/lib/supabase-db'

// Type definitions for compatibility
type Case = any
type File = any

/**
 * Get all cases for a specific firm
 * Used by firm users to view their organization's cases
 * For employees, only returns cases assigned to them via case_assignments table
 */
export async function getFirmCases(firmId: string, userId?: string, userRole?: string): Promise<Case[]> {
  const supabase = getSupabaseClient()
  
  try {
    // If user is an employee, get cases from case_assignments
    if (userRole === 'EMPLOYEE' && userId) {
      const { data: assignments, error: assignError } = await supabase
        .from('case_assignments')
        .select(`
          case:cases(*)
        `)
        .eq('user_id', userId)

      if (assignError) {
        console.error('[QUERIES] getFirmCases (employee) failed:', assignError)
        return []
      }

      // Extract cases and filter by organization
      const cases = assignments
        ?.map(item => item.case)
        .filter(Boolean)
        .filter((caseItem: any) => caseItem.organization_id === firmId) || []

      return cases as Case[]
    }

    // For non-employees, get all cases for the firm
    const { data: cases, error } = await supabase
      .from('cases')
      .select('*')
      .eq('organization_id', firmId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[QUERIES] getFirmCases failed:', error)
      return []
    }

    return (cases || []) as Case[]
  } catch (error) {
    console.error('[QUERIES] getFirmCases failed:', error)
    return []
  }
}

/**
 * Get all cases across all firms
 * Used by admin users to view all cases in the system
 */
export async function getAllCases() {
  const supabase = getSupabaseClient()
  
  try {
    const { data: cases, error } = await supabase
      .from('cases')
      .select(`
        *,
        organization:organizations(
          id,
          name,
          display_name,
          firm_number
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[QUERIES] getAllCases failed:', error)
      return []
    }

    return cases || []
  } catch (error) {
    console.error('[QUERIES] getAllCases failed:', error)
    return []
  }
}

/**
 * Get a specific case by ID with authorization check
 * Returns null if case doesn't exist or user is not authorized
 * 
 * @param caseId - The case ID to retrieve
 * @param userId - The requesting user's ID
 * @param userRole - The requesting user's role ('admin', 'employee', or 'client')
 */
export async function getCaseById(
  caseId: string,
  userId: string,
  userRole: string
): Promise<(Case & { 
  files: File[], 
  organization: { id: string, name: string }, 
  services: { service_id: string, service: { id: string, name: string, description?: string | null } }[] 
}) | null> {
  const supabase = getSupabaseClient()
  
  try {
    // Get case with organization
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select(`
        *,
        organization:organizations!inner(
          id, 
          name, 
          address_line1, 
          address_line2, 
          city, 
          state, 
          country
        )
      `)
      .eq('id', caseId)
      .single()

    if (caseError || !caseData) {
      return null
    }

    // Check access - Admin and Employee can access all, clients only their org
    if (userRole !== 'admin' && userRole !== 'employee') {
      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', userId)
        .single()
      
      const user = userData as Record<string, any> | null
      const caseOrgId = (caseData as Record<string, any>).organization_id
      if (user?.organization_id !== caseOrgId) {
        return null
      }
    }

    // Get files for the case
    const { data: files } = await supabase
      .from('files')
      .select('*')
      .eq('case_id', caseId)

    // Get services for the case
    const { data: caseServices } = await supabase
      .from('case_services')
      .select(`
        service_id,
        service:services(id, name, description, slug)
      `)
      .eq('case_id', caseId)

    return {
      ...((caseData as Record<string, any>)),
      files: (files || []) as File[],
      services: (caseServices || []).map((cs: any) => ({
        service_id: cs.service_id,
        service: cs.service
      }))
    } as any
  } catch (error) {
    console.error('[QUERIES] getCaseById failed:', error)
    return null
  }
}

/**
 * Get all files for a case with authorization check
 * Returns null if case doesn't exist or user is not authorized
 * 
 * @param caseId - The case ID to retrieve files for
 * @param userId - The requesting user's ID
 * @param userRole - The requesting user's role ('admin', 'employee', or 'client')
 */
export async function getCaseFiles(
  caseId: string,
  userId: string,
  userRole: string
): Promise<File[] | null> {
  const caseData = await getCaseById(caseId, userId, userRole)
  if (!caseData) return null
  
  return caseData.files
}

/**
 * Check if a user can access a specific file
 * Returns true if user is authorized, false otherwise
 * 
 * @param fileId - The file ID to check access for
 * @param userId - The requesting user's ID
 * @param userRole - The requesting user's role ('admin', 'employee', or 'client')
 */
export async function canAccessFile(
  fileId: string,
  userId: string,
  userRole: string
): Promise<boolean> {
  const supabase = getSupabaseClient()
  
  const { data: file, error } = await supabase
    .from('files')
    .select(`
      id,
      case:cases(
        id,
        organization_id
      )
    `)
    .eq('id', fileId)
    .single()
  
  if (error || !file) return false
  
  // Admin and Employee can access all files
  if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'EMPLOYEE') return true
  
  // Client can only access files from their own firm's cases
  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .single()
  
  const user = userData as Record<string, any> | null
  const fileCase = (file as Record<string, any>).case as Record<string, any>
  return user?.organization_id === fileCase.organization_id
}
