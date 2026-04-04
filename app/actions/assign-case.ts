'use server'

import { auth } from '@/auth'
import { SupabaseDB, getSupabaseClient } from '@/lib/supabase-db'
import { revalidatePath } from 'next/cache'

/**
 * Assign a case to multiple employees
 * Only ADMIN and SUPER_ADMIN can assign cases
 */
export async function assignCaseToEmployees(caseId: string, employeeIds: string[]) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    // Get current user to verify role
    const currentUser = await SupabaseDB.getUserById(session.user.id)
    
    if (!currentUser || ((currentUser as any).role !== 'ADMIN' && (currentUser as any).role !== 'SUPER_ADMIN')) {
      return { success: false, error: 'Only admins can assign cases' }
    }

    // Get the case to verify it exists
    const caseData = await SupabaseDB.getCaseById(caseId)
    
    if (!caseData) {
      return { success: false, error: 'Case not found' }
    }

    // Get current assignments for audit log
    const currentAssignments = await SupabaseDB.getCaseAssignments(caseId)
    const oldEmployeeIds = currentAssignments.map((a: any) => a.user_id)

    // If assigning to employees, verify they exist and are employees
    if (employeeIds.length > 0) {
      for (const employeeId of employeeIds) {
        const employee = await SupabaseDB.getUserById(employeeId)
        
        if (!employee) {
          return { success: false, error: `Employee not found: ${employeeId}` }
        }

        if ((employee as any).role !== 'EMPLOYEE') {
          return { success: false, error: `User ${(employee as any).email} is not an employee` }
        }

        // For ADMIN users, verify employee is in same organization
        if ((currentUser as any).role === 'ADMIN' && (employee as any).organization_id !== (currentUser as any).organization_id) {
          return { success: false, error: `Cannot assign to employee ${(employee as any).email} from different organization` }
        }
      }
    }

    // Update the case assignments using the new junction table
    await SupabaseDB.updateCaseAssignments(caseId, employeeIds, session.user.id)

    // Create audit log
    await SupabaseDB.createAuditLog({
      action: 'ASSIGNMENT',
      entity_type: 'case',
      entity_id: caseId,
      user_id: session.user.id,
      organization_id: (currentUser as any).organization_id || '',
      old_values: { assigned_employee_ids: oldEmployeeIds },
      new_values: { assigned_employee_ids: employeeIds }
    })

    // Revalidate relevant paths
    revalidatePath(`/admin/case/${caseId}`)
    revalidatePath(`/superadmin/case/${caseId}`)
    revalidatePath('/admin')
    revalidatePath('/superadmin')

    return { success: true }
  } catch (error) {
    console.error('[ASSIGN_CASE] Error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Legacy function for backward compatibility - assigns to single employee
 * @deprecated Use assignCaseToEmployees instead
 */
export async function assignCaseToEmployee(caseId: string, employeeId: string | null) {
  return assignCaseToEmployees(caseId, employeeId ? [employeeId] : [])
}
